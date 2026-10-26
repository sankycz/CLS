import { useState } from 'react';
import { addVitals, removeIntervention, removeMedication } from '../model/casualty';
import { INTERVENTION_LABEL, PHASE_LABEL } from '../model/labels';
import { formatTime } from '../model/reports';
import { zoneLabel } from '../model/zones';
import type { Avpu, Casualty, Vitals } from '../model/types';
import type { FsmEvent } from '../model/fsm';
import { TqPanel } from './TqTimers';
import type { Act } from './ZoneSheet';
import { Button, Choice, Section, Stepper } from './ui';

type Draft = Omit<Vitals, 'id' | 'at'>;

export const VitalsForm = ({ casualty, act }: { casualty: Casualty; act: Act }) => {
  const last = casualty.vitals[casualty.vitals.length - 1];
  const [draft, setDraft] = useState<Draft>(() => ({
    pulseSite: last?.pulseSite ?? 'radial',
    pulse: last?.pulse,
    rr: last?.rr,
    spo2: last?.spo2,
    avpu: last?.avpu ?? casualty.assessment.avpu,
    pain: last?.pain,
  }));
  const set = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));

  return (
    <Section title="Vitální funkce">
      <div className="grid-2">
        <Stepper label="Tep" unit="/min" value={draft.pulse} min={0} max={250} step={5} onChange={(pulse) => set({ pulse })} />
        <Stepper label="Dech" unit="/min" value={draft.rr} min={0} max={60} step={2} onChange={(rr) => set({ rr })} />
        <Stepper label="SpO2" unit="%" value={draft.spo2} min={50} max={100} onChange={(spo2) => set({ spo2 })} />
        <Stepper label="Bolest" unit="0–10" value={draft.pain} min={0} max={10} onChange={(pain) => set({ pain })} />
        <Stepper label="TK sys." unit="mmHg" value={draft.bpSys} min={0} max={250} step={5} onChange={(bpSys) => set({ bpSys })} />
        <Stepper label="TK dia." unit="mmHg" value={draft.bpDia} min={0} max={150} step={5} onChange={(bpDia) => set({ bpDia })} />
      </div>
      <Choice
        label="Místo pulzu"
        columns={3}
        value={draft.pulseSite}
        onChange={(pulseSite) => set({ pulseSite })}
        options={[
          { value: 'radial', label: 'Radiální' },
          { value: 'carotid', label: 'Karotida' },
          { value: 'femoral', label: 'Femorální' },
        ]}
      />
      <Choice<Avpu>
        label="AVPU"
        columns={4}
        value={draft.avpu}
        onChange={(avpu) => set({ avpu })}
        options={[
          { value: 'A', label: 'A' },
          { value: 'V', label: 'V' },
          { value: 'P', label: 'P', tone: 'warn' },
          { value: 'U', label: 'U', tone: 'danger' },
        ]}
      />
      <Button tone="ok" big onClick={() => act((c, now) => addVitals(c, { ...draft, at: now }, now))}>
        Zapsat měření
      </Button>
      {casualty.vitals.length > 0 && (
        <ul className="log">
          {[...casualty.vitals].reverse().map((v) => (
            <li key={v.id}>
              {formatTime(v.at)} · TF {v.pulse ?? '—'} · DF {v.rr ?? '—'} · SpO2 {v.spo2 ?? '—'} · TK {v.bpSys ? `${v.bpSys}/${v.bpDia ?? '?'}` : '—'} ·{' '}
              {v.avpu ?? '—'} · bolest {v.pain ?? '—'}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
};

export const InterventionLog = ({ casualty, act }: { casualty: Casualty; act: Act }) => {
  const entries = [
    ...casualty.interventions.map((item) => ({
      id: item.id,
      at: item.at,
      text: `${INTERVENTION_LABEL[item.kind]}${item.zoneId ? ` – ${zoneLabel(item.zoneId)}` : ''}${item.detail ? ` (${item.detail})` : ''}`,
      phase: PHASE_LABEL[item.phase],
      remove: () => act((c, now) => removeIntervention(c, item.id, now)),
    })),
    ...casualty.meds.map((med) => ({
      id: med.id,
      at: med.at,
      text: `${med.name} ${med.dose} ${med.route}`,
      phase: 'lék',
      remove: () => act((c, now) => removeMedication(c, med.id, now)),
    })),
  ].sort((a, b) => b.at - a.at);

  return (
    <Section title="Záznam zásahů">
      {entries.length === 0 ? (
        <p className="muted">Zatím žádné zásahy.</p>
      ) : (
        <ul className="log log-edit">
          {entries.map((entry) => (
            <li key={entry.id}>
              <span>
                <strong>{formatTime(entry.at)}</strong> {entry.text} <span className="muted">· {entry.phase}</span>
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-small"
                onClick={() => {
                  if (window.confirm(`Smazat záznam „${entry.text}“?`)) entry.remove();
                }}
              >
                Smazat
              </button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
};

export const Tacevac = ({ casualty, act, send, now }: { casualty: Casualty; act: Act; send: (event: FsmEvent) => void; now: number }) => (
  <div className="tacevac">
    <h2>Tactical Evacuation – monitorace</h2>
    <p className="muted">Opakovaně přehodnocuj. Jakákoli změna stavu = znovu od M.</p>
    <div className="grid-2">
      <Button tone="warn" onClick={() => send({ type: 'REASSESS' })}>
        Změna stavu → MARCH od M
      </Button>
      <Button tone="accent" onClick={() => send({ type: 'REQUEST_REPORT' })}>
        Hlášení MIST / 9-Line
      </Button>
    </div>
    <Section title="Turnikety">
      <TqPanel casualty={casualty} now={now} act={act} />
    </Section>
    <VitalsForm casualty={casualty} act={act} />
    <InterventionLog casualty={casualty} act={act} />
  </div>
);
