// Obsah jednotlivých kroků MARCH PAWS včetně kontrolních otázek a navigace.

import { useState } from 'react';
import { addIntervention, addMedication, hasUncontrolledMassiveBleeding, isInShock, setAssessment, txaIndicated } from '../model/casualty';
import { MARCH_ORDER, checkStep, type FsmEvent } from '../model/fsm';
import { STEP_LETTER, STEP_TITLE } from '../model/labels';
import type { Assessment, Casualty, MarchStep, ZoneType } from '../model/types';
import { BodyMap, ZoneList } from './BodyMap';
import { TqPanel } from './TqTimers';
import type { Act } from './ZoneSheet';
import { Button, Choice, Guidance, Section } from './ui';

type StepProps = {
  casualty: Casualty;
  act: Act;
  now: number;
  openZone: (zoneId: string) => void;
};

const useAssess = (act: Act) => (patch: Assessment) => act((c, now) => setAssessment(c, patch, now));

const MapBlock = ({ casualty, openZone, highlight }: { casualty: Casualty; openZone: (id: string) => void; highlight?: ZoneType[] }) => (
  <>
    <BodyMap casualty={casualty} onSelect={openZone} highlight={highlight} />
    <ZoneList onSelect={openZone} filter={highlight} />
  </>
);

const StepM = ({ casualty, act, now, openZone }: StepProps) => {
  const assess = useAssess(act);
  return (
    <>
      <Guidance
        items={[
          'Blood sweep: hlava → krk → trup → podpaží a třísla → končetiny, zepředu i zezadu.',
          'Klepni na místo krvácení a zapiš zranění a zásah.',
          'Končetina: deliberate TQ 5–7 cm nad ranou. Nestačí-li, druhý TQ těsně nad prvním.',
          'Krk, podpaží, tříslo: wound packing + min. 3 min tlak, pak tlakový obvaz.',
        ]}
      />
      <MapBlock casualty={casualty} openZone={openZone} />
      <Choice
        label="Blood sweep"
        value={casualty.assessment.bloodSweep ? 'done' : undefined}
        onChange={() => assess({ bloodSweep: true })}
        options={[{ value: 'done', label: 'Blood sweep proveden', tone: 'ok' }]}
      />
      {hasUncontrolledMassiveBleeding(casualty) && (
        <Section tone="danger">
          <strong>Nezastavené masivní krvácení!</strong>
        </Section>
      )}
      <Section title="Turnikety">
        <TqPanel casualty={casualty} now={now} act={act} />
      </Section>
    </>
  );
};

const StepA = ({ casualty, act }: StepProps) => {
  const assess = useAssess(act);
  const log = (kind: 'jaw_thrust' | 'npa' | 'recovery_position') => act((c, now) => addIntervention(c, kind, now));
  return (
    <>
      <Choice
        label="Vědomí (AVPU)"
        columns={2}
        value={casualty.assessment.avpu}
        onChange={(avpu) => assess({ avpu })}
        options={[
          { value: 'A', label: 'A – bdělý' },
          { value: 'V', label: 'V – na hlas' },
          { value: 'P', label: 'P – na bolest', tone: 'warn' },
          { value: 'U', label: 'U – nereaguje', tone: 'danger' },
        ]}
      />
      <Choice
        label="Dýchací cesty"
        value={casualty.assessment.airway}
        onChange={(airway) => assess({ airway })}
        options={[
          { value: 'patent', label: 'Průchodné', hint: 'mluví, dýchá bez chrčení', tone: 'ok' },
          { value: 'compromised', label: 'Ohrožené', hint: 'chrčení, bezvědomí, krev v ústech', tone: 'danger' },
          { value: 'managed', label: 'Zajištěno', hint: 'po zásahu průchodné' },
        ]}
      />
      <Section title="Zásahy">
        <div className="grid-2">
          <Button onClick={() => log('jaw_thrust')}>Jaw-thrust / Chin-lift</Button>
          <Button onClick={() => log('npa')}>Zavést NPA</Button>
          <Button onClick={() => log('recovery_position')}>Zotavovací poloha</Button>
        </div>
        <Guidance
          items={[
            'NPA 28 Fr: velikost od nosní dírky k ušnímu lalůčku, lubrikovat, zavádět kolmo k obličeji, úkosem k přepážce.',
            'V bezvědomí bez obstrukce: NPA + zotavovací poloha.',
            'Při vědomí s poraněním obličeje: nech zraněného sedět v předklonu, jak mu to vyhovuje.',
          ]}
        />
      </Section>
    </>
  );
};

const StepR = ({ casualty, act, openZone }: StepProps) => {
  const assess = useAssess(act);
  return (
    <>
      <Choice
        label="Hrudník (obnaž a prohlédni zepředu i zezadu)"
        value={casualty.assessment.chest}
        onChange={(chest) => assess({ chest })}
        options={[
          { value: 'normal', label: 'Bez poranění', tone: 'ok' },
          { value: 'open_wound', label: 'Otevřená rána hrudníku', hint: '→ ventilový chest seal', tone: 'warn' },
          {
            value: 'tension_suspected',
            label: 'Podezření na tenzní PNO',
            hint: 'zhoršující se dušnost při poranění trupu → NDC',
            tone: 'danger',
          },
        ]}
      />
      <Guidance
        items={[
          'Chest seal / NDC zapiš klepnutím na oblast hrudníku na mapě.',
          'NDC: 5. mezižebří v přední axilární čáře, nebo 2. mezižebří v medioklavikulární čáře. Jehla 14G nebo 10G, 3,25″.',
          'Po chest sealu sleduj dýchání – tenzní PNO se může rozvinout i později.',
        ]}
      />
      <MapBlock casualty={casualty} openZone={openZone} highlight={['thoracic']} />
    </>
  );
};

const StepC = ({ casualty, act, now }: StepProps) => {
  const assess = useAssess(act);
  const txaGiven = casualty.meds.some((med) => med.category === 'txa');
  return (
    <>
      <Choice
        label="Radiální pulz"
        value={casualty.assessment.radialPulse}
        onChange={(radialPulse) => assess({ radialPulse })}
        options={[
          { value: 'strong', label: 'Hmatný, dobře plněný', tone: 'ok' },
          { value: 'weak', label: 'Slabý', hint: 'známka šoku', tone: 'warn' },
          { value: 'absent', label: 'Nehmatný', hint: 'hemoragický šok', tone: 'danger' },
        ]}
      />
      {isInShock(casualty) && (
        <Section tone="danger">
          <strong>Známky šoku.</strong> Zkontroluj všechny zdroje krvácení, polož zraněného, chraň před chladem, vyžádej zdravotníka a urgentní evakuaci.
        </Section>
      )}
      <Section title="Reassessment turniketů a obvazů">
        <TqPanel casualty={casualty} now={now} act={act} />
      </Section>
      {txaIndicated(casualty) && (
        <Section title="TXA" tone="warn">
          <p>Indikace TXA 2 g (hemoragický šok / předpoklad masivní transfuze). TXA podává zdravotník (CMC) i.v./i.o.</p>
          <Button
            tone={txaGiven ? 'ok' : 'default'}
            disabled={txaGiven}
            onClick={() =>
              act((c, t) => addIntervention(addMedication(c, { at: t, name: 'TXA', dose: '2 g', route: 'IV', category: 'txa' }, t), 'txa', t))
            }
          >
            {txaGiven ? 'TXA zapsáno ✓' : 'Zapsat: TXA podal zdravotník'}
          </Button>
        </Section>
      )}
    </>
  );
};

const StepH = ({ casualty, act }: StepProps) => {
  const assess = useAssess(act);
  return (
    <>
      <Choice
        label="Poranění hlavy"
        value={casualty.assessment.headInjury}
        onChange={(headInjury) => assess({ headInjury })}
        options={[
          { value: 'none', label: 'Bez známek TBI', tone: 'ok' },
          { value: 'suspected', label: 'Podezření na TBI', hint: 'porucha vědomí, zvracení, nerovné zornice', tone: 'warn' },
        ]}
      />
      <Choice
        label="Prevence hypotermie"
        value={casualty.assessment.hypothermia}
        onChange={(hypothermia) => {
          assess({ hypothermia });
          if (hypothermia === 'done' && casualty.assessment.hypothermia !== 'done') act((c, t) => addIntervention(c, 'hypothermia', t));
        }}
        options={[
          { value: 'done', label: 'Provedeno', hint: 'izolace od země, mokrý oděv pryč, Ready-Heat / Blizzard', tone: 'ok' },
          { value: 'not_possible', label: 'Nelze (chybí vybavení)', tone: 'warn' },
        ]}
      />
      <Guidance
        items={[
          'Podchlazení zhoršuje srážlivost krve – chraň před chladem i v teplém klimatu.',
          'Penetrující poranění oka: Rigid Eye Shield (bez tlaku) a Combat Pill Pack s antibiotikem.',
          'Při podezření na TBI opakovaně kontroluj AVPU.',
        ]}
      />
    </>
  );
};

const StepP = ({ casualty, act }: StepProps) => {
  const assess = useAssess(act);
  return (
    <>
      <Choice
        label="Analgezie"
        value={casualty.assessment.pain}
        onChange={(pain) => {
          assess({ pain });
          if (pain === 'given' && casualty.assessment.pain !== 'given') {
            act((c, t) => {
              const withMeds = addMedication(
                addMedication(c, { at: t, name: 'Meloxicam', dose: '15 mg', route: 'PO', category: 'analgesic' }, t),
                { at: t, name: 'Paracetamol', dose: '2× 650 mg', route: 'PO', category: 'analgesic' },
                t,
              );
              return addIntervention(withMeds, 'pill_pack', t, { detail: 'analgetika' });
            });
          }
        }}
        options={[
          { value: 'given', label: 'Podán Combat Pill Pack', hint: 'meloxicam 15 mg + paracetamol 2× 650 mg p.o.', tone: 'ok' },
          { value: 'none', label: 'Bez bolesti / nepotřebuje' },
          { value: 'not_possible', label: 'Nelze', hint: 'bezvědomí, nemůže polykat, šok, alergie', tone: 'warn' },
        ]}
      />
      <Guidance items={['Pill Pack jen u zraněného při vědomí, který dokáže polykat.', 'Silnější analgezii (ketamin, fentanyl) podává zdravotník.']} />
    </>
  );
};

const StepAntibiotics = ({ casualty, act }: StepProps) => {
  const assess = useAssess(act);
  return (
    <Choice
      label="Antibiotika (otevřené bojové rány)"
      value={casualty.assessment.antibiotics}
      onChange={(antibiotics) => {
        assess({ antibiotics });
        if (antibiotics === 'given' && casualty.assessment.antibiotics !== 'given') {
          act((c, t) => addMedication(c, { at: t, name: 'Moxifloxacin', dose: '400 mg', route: 'PO', category: 'antibiotic' }, t));
        }
      }}
      options={[
        { value: 'given', label: 'Moxifloxacin 400 mg p.o.', hint: 'jednorázově z Pill Packu', tone: 'ok' },
        { value: 'not_indicated', label: 'Bez otevřené rány' },
        { value: 'not_possible', label: 'Nelze', hint: 'nemůže polykat, alergie', tone: 'warn' },
      ]}
    />
  );
};

const StepW = ({ casualty, act, openZone }: StepProps) => {
  const assess = useAssess(act);
  return (
    <>
      <Guidance items={['Znovu prohlédni celé tělo.', 'Rány kryj sterilním krytím, popáleniny suchým popáleninovým krytím.', 'Vyhřezlé útroby nevracej – kryj vlhkým krytím.']} />
      <MapBlock casualty={casualty} openZone={openZone} />
      <Choice
        label="Další rány"
        value={casualty.assessment.wounds}
        onChange={(wounds) => assess({ wounds })}
        options={[
          { value: 'done', label: 'Ošetřeny', tone: 'ok' },
          { value: 'none', label: 'Žádné další rány' },
        ]}
      />
    </>
  );
};

const StepS = ({ casualty, act, openZone }: StepProps) => {
  const assess = useAssess(act);
  return (
    <>
      <Guidance items={['Dlahu zapiš klepnutím na končetinu.', 'Zkontroluj CMS (cirkulace, motorika, citlivost) před a po dlahování.', 'Dlahuj kloub nad a pod zlomeninou.']} />
      <MapBlock casualty={casualty} openZone={openZone} highlight={['extremity']} />
      <Choice
        label="Zlomeniny"
        value={casualty.assessment.splint}
        onChange={(splint) => assess({ splint })}
        options={[
          { value: 'done', label: 'Zadlahováno', tone: 'ok' },
          { value: 'none', label: 'Bez zlomenin' },
        ]}
      />
    </>
  );
};

const STEP_COMPONENT: Record<MarchStep, (props: StepProps) => React.JSX.Element> = {
  MARCH_M: StepM,
  MARCH_A: StepA,
  MARCH_R: StepR,
  MARCH_C: StepC,
  MARCH_H: StepH,
  PAWS_P: StepP,
  PAWS_A: StepAntibiotics,
  PAWS_W: StepW,
  PAWS_S: StepS,
};

export const MarchStepView = ({ step, send, ...props }: StepProps & { step: MarchStep; send: (event: FsmEvent) => void }) => {
  const [confirmOverride, setConfirmOverride] = useState(false);
  const { blockers, warnings } = checkStep(props.casualty, step, props.now);
  const StepContent = STEP_COMPONENT[step];
  const index = MARCH_ORDER.indexOf(step);

  return (
    <div className="march-step">
      <h2 className="step-title">
        <span className="step-letter">{STEP_LETTER[step]}</span>
        {STEP_TITLE[step]}
        <span className="muted step-count">
          {index + 1}/{MARCH_ORDER.length}
        </span>
      </h2>
      <StepContent {...props} />

      {warnings.length > 0 && (
        <Section tone="warn">
          <ul className="plain">
            {warnings.map((warning) => (
              <li key={warning}>⚠ {warning}</li>
            ))}
          </ul>
        </Section>
      )}

      <div className="step-footer">
        {blockers.length > 0 && (
          <ul className="blockers">
            {blockers.map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ul>
        )}
        {blockers.length === 0 ? (
          <Button tone="ok" big onClick={() => send({ type: 'COMPLETE_STEP' })}>
            {step === 'PAWS_S' ? 'Hotovo → Hlášení' : 'Hotovo → další krok'}
          </Button>
        ) : confirmOverride ? (
          <div className="grid-2">
            <Button tone="ghost" onClick={() => setConfirmOverride(false)}>
              Zpět
            </Button>
            <Button
              tone="warn"
              onClick={() => {
                setConfirmOverride(false);
                send({ type: 'COMPLETE_STEP', override: true });
              }}
            >
              Opravdu pokračovat (zapíše se)
            </Button>
          </div>
        ) : (
          <Button tone="ghost" onClick={() => setConfirmOverride(true)}>
            Pokračovat přes upozornění…
          </Button>
        )}
      </div>
    </div>
  );
};

export const MarchNav = ({ casualty, send }: { casualty: Casualty; send: (event: FsmEvent) => void }) => {
  const { state, completed } = casualty.fsm;
  const nextIncomplete = MARCH_ORDER.find((step) => !completed.includes(step));
  return (
    <nav className="march-nav" aria-label="MARCH PAWS">
      {MARCH_ORDER.map((step, index) => {
        const reachable = completed.includes(step) || step === nextIncomplete;
        return (
          <button
            key={step}
            type="button"
            className={`march-dot${state === step ? ' current' : ''}${completed.includes(step) ? ' done' : ''}${index === 5 ? ' paws-start' : ''}`}
            disabled={!reachable}
            aria-label={STEP_TITLE[step]}
            aria-current={state === step ? 'step' : undefined}
            onClick={() => send({ type: 'GOTO', step })}
          >
            {STEP_LETTER[step]}
          </button>
        );
      })}
      <button type="button" className={`march-dot report${state === 'REPORT_GEN' ? ' current' : ''}`} onClick={() => send({ type: 'REQUEST_REPORT' })}>
        9L
      </button>
    </nav>
  );
};
