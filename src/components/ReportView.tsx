import { useState } from 'react';
import { suggestPatientType, suggestPrecedence } from '../model/casualty';
import { INJURY_SHORT, MECHANISM_LABEL } from '../model/labels';
import {
  CBRN_LABEL,
  EQUIPMENT_LABEL,
  MARKING_LABEL,
  NATIONALITY_LABEL,
  PRECEDENCE_LABEL,
  SECURITY_LABEL,
  buildDd1380,
  buildMist,
  buildNineLine,
  formatDate,
  formatTime,
  mistText,
  nineLineText,
  treatmentLines,
} from '../model/reports';
import { LIMB_LABEL, zoneLabel } from '../model/zones';
import type { Casualty, EvacInfo, Identity, Mechanism } from '../model/types';
import type { FsmEvent } from '../model/fsm';
import { BodyMap } from './BodyMap';
import type { Act } from './ZoneSheet';
import { Button, Choice, CopyButton, Section } from './ui';

type Tab = '9line' | 'mist' | 'dd1380' | 'data';

const TABS: Array<[Tab, string]> = [
  ['9line', '9-Line'],
  ['mist', 'MIST'],
  ['dd1380', 'DD 1380'],
  ['data', 'Údaje'],
];

const options = <K extends string>(labels: Record<K, string>) =>
  (Object.entries(labels) as Array<[K, string]>).map(([value, label]) => ({ value, label: `${value} – ${label}` }));

const TextField = ({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) => (
  <label className="field">
    <span>{label}</span>
    <input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
  </label>
);

const NineLineTab = ({ casualty, all, act }: { casualty: Casualty; all: Casualty[]; act: Act }) => {
  const [includeAll, setIncludeAll] = useState(false);
  const open = all.filter((c) => c.closedAt === undefined);
  const included = includeAll ? open : [casualty];
  const evac = casualty.evac;
  const setEvac = (patch: Partial<EvacInfo>) => act((c, now) => ({ ...c, evac: { ...c.evac, ...patch }, updatedAt: now }));
  const lines = buildNineLine(included, evac);

  return (
    <>
      <div className="report-lines">
        {lines.map((line) => (
          <div key={line.line} className={`report-line${line.line <= 5 ? ' mandatory' : ''}`}>
            <span className="line-no">L{line.line}</span>
            <span className="line-label">{line.label}</span>
            <strong className="line-value">{line.radio}</strong>
          </div>
        ))}
      </div>
      <p className="muted small">L1–5 odvysílat do 25 s. L6–9 lze dohlásit za letu.</p>
      <div className="grid-2">
        <CopyButton text={nineLineText(lines)} label="Kopírovat 9-Line" />
        {open.length > 1 && (
          <Button pressed={includeAll} onClick={() => setIncludeAll(!includeAll)}>
            {includeAll ? `Všichni (${open.length}) ✓` : `Zahrnout všech ${open.length}`}
          </Button>
        )}
      </div>

      <Section title="Doplnit řádky">
        <TextField label="L1 – Místo (MGRS)" value={evac.location} placeholder="33U VR 12345 67890" onChange={(location) => setEvac({ location })} />
        <div className="grid-2">
          <TextField label="L2 – Frekvence" value={evac.frequency} onChange={(frequency) => setEvac({ frequency })} />
          <TextField label="L2 – Volací znak" value={evac.callsign} onChange={(callsign) => setEvac({ callsign })} />
        </div>
        <Choice
          label={`L3 – Naléhavost (návrh: ${suggestPrecedence(casualty)})`}
          value={evac.precedence ?? suggestPrecedence(casualty)}
          onChange={(precedence) => setEvac({ precedence })}
          options={options(PRECEDENCE_LABEL)}
        />
        <Choice
          label="L4 – Speciální vybavení"
          columns={2}
          value={evac.equipment[0]}
          onChange={(code) => setEvac({ equipment: [code] })}
          options={options(EQUIPMENT_LABEL)}
        />
        <Choice
          label={`L5 – Typ (návrh: ${suggestPatientType(casualty)})`}
          columns={2}
          value={evac.patientType ?? suggestPatientType(casualty)}
          onChange={(patientType) => setEvac({ patientType })}
          options={[
            { value: 'L', label: 'L – nosítka' },
            { value: 'A', label: 'A – chodící' },
          ]}
        />
        <Choice label="L6 – Bezpečnost" value={evac.security} onChange={(security) => setEvac({ security })} options={options(SECURITY_LABEL)} />
        <Choice label="L7 – Označení" columns={2} value={evac.marking} onChange={(marking) => setEvac({ marking })} options={options(MARKING_LABEL)} />
        <Choice label="L8 – Status" value={evac.nationality} onChange={(nationality) => setEvac({ nationality })} options={options(NATIONALITY_LABEL)} />
        <Choice label="L9 – CBRN" columns={2} value={evac.cbrn} onChange={(cbrn) => setEvac({ cbrn })} options={options(CBRN_LABEL)} />
      </Section>
    </>
  );
};

const MistTab = ({ casualty }: { casualty: Casualty }) => {
  const mist = buildMist(casualty);
  return (
    <>
      <div className="report-lines">
        {(
          [
            ['M', 'Mechanismus', mist.m],
            ['I', 'Zranění', mist.i],
            ['S', 'Známky / vitální funkce', mist.s],
            ['T', 'Ošetření', mist.t],
          ] as const
        ).map(([letter, label, value]) => (
          <div key={letter} className="report-line">
            <span className="line-no">{letter}</span>
            <span className="line-label">{label}</span>
            <strong className="line-value">{value}</strong>
          </div>
        ))}
      </div>
      <CopyButton text={mistText(casualty)} label="Kopírovat MIST" />
    </>
  );
};

const Check = ({ on, label }: { on: boolean; label: string }) => <span className={`dd-check${on ? ' on' : ''}`}>{on ? '☒' : '☐'} {label}</span>;

const Dd1380Tab = ({ casualty }: { casualty: Casualty }) => {
  const dd = buildDd1380(casualty);
  const { identity } = casualty;
  return (
    <div className="dd1380">
      <div className="dd-head">
        <strong>TCCC CARD (DD 1380)</strong>
        <span>EVAC: {dd.evacCategory}</span>
      </div>
      <div className="dd-grid">
        <span>Battle roster: {identity.battleRoster}</span>
        <span>Jméno: {identity.name || '—'}</span>
        <span>Last 4: {identity.last4 || '—'}</span>
        <span>Pohlaví: {identity.sex || '—'}</span>
        <span>Datum: {formatDate(casualty.injuryAt)}</span>
        <span>Čas: {formatTime(casualty.injuryAt)}</span>
        <span>Jednotka: {identity.unit || '—'}</span>
        <span>Alergie: {identity.allergies || '—'}</span>
      </div>
      <div className="dd-section">
        <strong>Mechanismus:</strong> {casualty.mechanisms.map((m) => MECHANISM_LABEL[m]).join(', ') || '—'}
      </div>
      <div className="dd-section dd-maps">
        <BodyMap casualty={casualty} onSelect={() => undefined} />
        <ul className="plain small">
          {casualty.injuries.map((injury) => (
            <li key={injury.id}>
              {INJURY_SHORT[injury.kind]} – {zoneLabel(injury.zoneId)}
            </li>
          ))}
        </ul>
      </div>
      <div className="dd-section">
        <strong>TQ:</strong>{' '}
        {dd.tourniquets.length === 0 ? '—' : dd.tourniquets.map((tq, i) => <span key={i} className="dd-tq">{LIMB_LABEL[tq.limb]}: {tq.type} {tq.time}</span>)}
      </div>
      <div className="dd-section">
        <strong>C:</strong> <Check on={dd.circulation.extremityTq} label="TQ končetina" /> <Check on={dd.circulation.hemostatic} label="Hemostatické krytí" />{' '}
        <Check on={dd.circulation.pressure} label="Tlakový obvaz" /> <Check on={dd.circulation.other} label="Jiné krytí" />
      </div>
      <div className="dd-section">
        <strong>A:</strong> <Check on={dd.airway.intact} label="Průchodné" /> <Check on={dd.airway.npa} label="NPA" />
      </div>
      <div className="dd-section">
        <strong>B:</strong> <Check on={dd.breathing.needleD} label="Needle-D" /> <Check on={dd.breathing.chestSeal} label="Chest seal" />
      </div>
      <div className="dd-section">
        <strong>Vitální funkce:</strong>
        {casualty.vitals.length === 0 ? (
          ' —'
        ) : (
          <table className="vitals-table">
            <thead>
              <tr>
                <th>Čas</th>
                <th>TF</th>
                <th>TK</th>
                <th>DF</th>
                <th>SpO2</th>
                <th>AVPU</th>
                <th>Bolest</th>
              </tr>
            </thead>
            <tbody>
              {casualty.vitals.map((v) => (
                <tr key={v.id}>
                  <td>{formatTime(v.at)}</td>
                  <td>{v.pulse ?? '—'}</td>
                  <td>{v.bpSys ? `${v.bpSys}/${v.bpDia ?? '?'}` : '—'}</td>
                  <td>{v.rr ?? '—'}</td>
                  <td>{v.spo2 ?? '—'}</td>
                  <td>{v.avpu ?? '—'}</td>
                  <td>{v.pain ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="dd-section">
        <strong>Léky:</strong> {casualty.meds.map((m) => `${m.name} ${m.dose} ${m.route} ${formatTime(m.at)}`).join('; ') || '—'}
      </div>
      <div className="dd-section">
        <strong>Ostatní:</strong> <Check on={dd.other.pillPack} label="Combat Pill Pack" /> <Check on={dd.other.eyeShieldRight} label="Eye shield P" />{' '}
        <Check on={dd.other.eyeShieldLeft} label="Eye shield L" /> <Check on={dd.other.splint} label="Dlaha" /> <Check on={dd.other.hypothermia} label="Hypotermie" />
      </div>
      <div className="dd-section">
        <strong>Záznam zásahů:</strong>
        <ul className="plain small">
          {treatmentLines(casualty).map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </div>
      <div className="dd-section">
        <strong>Poznámky:</strong> {casualty.notes || '—'}
      </div>
      <div className="dd-section">
        <strong>Poskytl první pomoc:</strong> {casualty.firstResponder || '—'}
      </div>
      <Button onClick={() => window.print()}>Tisk / PDF</Button>
    </div>
  );
};

const MECHANISMS = Object.keys(MECHANISM_LABEL) as Mechanism[];

const toLocalInput = (ts: number): string => {
  const date = new Date(ts - new Date(ts).getTimezoneOffset() * 60000);
  return date.toISOString().slice(0, 16);
};

const DataTab = ({ casualty, act }: { casualty: Casualty; act: Act }) => {
  const setIdentity = (patch: Partial<Identity>) => act((c, now) => ({ ...c, identity: { ...c.identity, ...patch }, updatedAt: now }));
  const toggleMechanism = (mechanism: Mechanism) =>
    act((c, now) => ({
      ...c,
      mechanisms: c.mechanisms.includes(mechanism) ? c.mechanisms.filter((m) => m !== mechanism) : [...c.mechanisms, mechanism],
      updatedAt: now,
    }));
  const { identity } = casualty;
  return (
    <>
      <Section title="Identifikace">
        <div className="grid-2">
          <TextField label="Battle roster #" value={identity.battleRoster} onChange={(battleRoster) => setIdentity({ battleRoster })} />
          <TextField label="Last 4" value={identity.last4} onChange={(last4) => setIdentity({ last4 })} />
        </div>
        <TextField label="Jméno" value={identity.name} onChange={(name) => setIdentity({ name })} />
        <TextField label="Jednotka" value={identity.unit} onChange={(unit) => setIdentity({ unit })} />
        <TextField label="Alergie" value={identity.allergies} placeholder="NKDA" onChange={(allergies) => setIdentity({ allergies })} />
        <Choice
          label="Pohlaví"
          columns={2}
          value={identity.sex || undefined}
          onChange={(sex) => setIdentity({ sex })}
          options={[
            { value: 'M', label: 'Muž' },
            { value: 'F', label: 'Žena' },
          ]}
        />
        <label className="field">
          <span>Čas zranění</span>
          <input
            type="datetime-local"
            value={toLocalInput(casualty.injuryAt)}
            onChange={(event) => {
              const value = new Date(event.target.value).getTime();
              if (!Number.isNaN(value)) act((c, now) => ({ ...c, injuryAt: value, updatedAt: now }));
            }}
          />
        </label>
      </Section>
      <Section title="Mechanismus zranění">
        <div className="grid-2">
          {MECHANISMS.map((mechanism) => (
            <Button key={mechanism} pressed={casualty.mechanisms.includes(mechanism)} onClick={() => toggleMechanism(mechanism)}>
              {MECHANISM_LABEL[mechanism]}
            </Button>
          ))}
        </div>
      </Section>
      <Section title="Poznámky">
        <textarea
          className="notes"
          value={casualty.notes}
          rows={4}
          onChange={(event) => {
            const notes = event.target.value;
            act((c, now) => ({ ...c, notes, updatedAt: now }));
          }}
        />
        <TextField
          label="Poskytl první pomoc (jméno, last 4)"
          value={casualty.firstResponder}
          onChange={(firstResponder) => act((c, now) => ({ ...c, firstResponder, updatedAt: now }))}
        />
      </Section>
    </>
  );
};

export const ReportView = ({
  casualty,
  all,
  act,
  send,
}: {
  casualty: Casualty;
  all: Casualty[];
  act: Act;
  send: (event: FsmEvent) => void;
}) => {
  const [tab, setTab] = useState<Tab>('9line');
  return (
    <div className="report">
      <div className="tabs" role="tablist">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" role="tab" className="btn" aria-selected={tab === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      {tab === '9line' && <NineLineTab casualty={casualty} all={all} act={act} />}
      {tab === 'mist' && <MistTab casualty={casualty} />}
      {tab === 'dd1380' && <Dd1380Tab casualty={casualty} />}
      {tab === 'data' && <DataTab casualty={casualty} act={act} />}
      <div className="grid-2 report-actions">
        <Button onClick={() => send({ type: 'RESUME_CARE' })}>Zpět do péče</Button>
        {casualty.fsm.state === 'TACEVAC' ? null : (
          <Button tone="accent" onClick={() => send({ type: 'START_EVAC' })}>
            Zahájit TACEVAC →
          </Button>
        )}
      </div>
    </div>
  );
};
