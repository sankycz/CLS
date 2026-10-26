import { useState } from 'react';
import { addInjury, addIntervention, removeInjury, setInjuryControlled } from '../model/casualty';
import { BLEEDING_LABEL, INJURY_LABEL, INTERVENTION_LABEL } from '../model/labels';
import { formatTime } from '../model/reports';
import { ZONE_TYPE_LABEL, findZone, interventionsForZone } from '../model/zones';
import type { Bleeding, Casualty, InjuryKind, InterventionKind } from '../model/types';
import { Button } from './ui';

export type Act = (update: (casualty: Casualty, now: number) => Casualty) => void;

const KINDS_BY_TYPE: Record<string, InjuryKind[]> = {
  head: ['gsw', 'fragment', 'laceration', 'blunt', 'burn', 'eye'],
  extremity: ['gsw', 'fragment', 'amputation', 'laceration', 'fracture', 'burn', 'blunt'],
};
const DEFAULT_KINDS: InjuryKind[] = ['gsw', 'fragment', 'laceration', 'burn', 'blunt'];

const BLEEDINGS: Bleeding[] = ['massive', 'moderate', 'minor', 'none'];

const INTERVENTION_HINT: Partial<Record<InterventionKind, string>> = {
  tq_deliberate: 'Na kůži 5–7 cm nad ranou, ne přes kloub. Utahovat, dokud krvácení neustane a nezmizí distální pulz.',
  tq_hasty: 'Co nejvýše na končetině a co nejtěsněji, přes oděv.',
  wound_packing: 'Vyplnit ránu až ke zdroji krvácení, pak min. 3 min přímý tlak.',
  chest_seal: 'Ventilovou náplast na vstup i výstup. Sledovat rozvoj tenzního PNO.',
  direct_pressure: 'Dočasné opatření, než bude k dispozici tamponáda nebo tlakový obvaz.',
  splint: 'Před a po dlahování zkontrolovat CMS (cirkulace, motorika, citlivost).',
  eye_shield: 'Pevný kryt, žádný tlak na oko.',
};

export const ZoneSheet = ({ casualty, zoneId, act, onClose }: { casualty: Casualty; zoneId: string; act: Act; onClose: () => void }) => {
  const zone = findZone(zoneId);
  const [kind, setKind] = useState<InjuryKind | undefined>();
  const [pending, setPending] = useState<InterventionKind | undefined>();
  if (!zone) return null;

  const injuries = casualty.injuries.filter((injury) => injury.zoneId === zoneId);
  const interventions = casualty.interventions.filter((item) => item.zoneId === zoneId);
  const kinds = (KINDS_BY_TYPE[zone.type] ?? DEFAULT_KINDS).filter((k) => k !== 'amputation' || zone.type === 'extremity');

  const record = (interventionKind: InterventionKind, detail?: string) => {
    act((c, now) => addIntervention(c, interventionKind, now, { zoneId, detail }));
    setPending(undefined);
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={zone.label} onClick={(event) => event.stopPropagation()}>
        <header className="sheet-head">
          <div>
            <h2>{zone.label}</h2>
            <p className="muted">{ZONE_TYPE_LABEL[zone.type]}</p>
          </div>
          <Button tone="ghost" onClick={onClose}>
            Zavřít ✕
          </Button>
        </header>

        {injuries.length > 0 && (
          <section className="section">
            <h3>Zranění</h3>
            {injuries.map((injury) => (
              <div key={injury.id} className={`injury-row ${injury.bleeding === 'massive' && !injury.controlled ? 'injury-critical' : ''}`}>
                <div>
                  <strong>{INJURY_LABEL[injury.kind]}</strong>
                  <div className="muted">
                    {BLEEDING_LABEL[injury.bleeding]} · {formatTime(injury.at)}
                  </div>
                </div>
                {injury.bleeding !== 'none' && (
                  <Button
                    tone={injury.controlled ? 'ok' : 'danger'}
                    onClick={() => act((c, now) => setInjuryControlled(c, injury.id, !injury.controlled, now))}
                  >
                    {injury.controlled ? 'Zastaveno ✓' : 'Krvácí!'}
                  </Button>
                )}
                <Button tone="ghost" onClick={() => act((c, now) => removeInjury(c, injury.id, now))}>
                  Smazat
                </Button>
              </div>
            ))}
          </section>
        )}

        <section className="section">
          <h3>Přidat zranění</h3>
          {!kind ? (
            <div className="grid-2">
              {kinds.map((k) => (
                <Button key={k} onClick={() => setKind(k)}>
                  {INJURY_LABEL[k]}
                </Button>
              ))}
            </div>
          ) : (
            <>
              <p>
                <strong>{INJURY_LABEL[kind]}</strong> – krvácení?
              </p>
              <div className="grid-2">
                {BLEEDINGS.map((bleeding) => (
                  <Button
                    key={bleeding}
                    tone={bleeding === 'massive' ? 'danger' : bleeding === 'moderate' ? 'warn' : 'default'}
                    onClick={() => {
                      act((c, now) => addInjury(c, { zoneId, kind, bleeding }, now));
                      setKind(undefined);
                    }}
                  >
                    {BLEEDING_LABEL[bleeding]}
                  </Button>
                ))}
              </div>
              <Button tone="ghost" onClick={() => setKind(undefined)}>
                Zpět
              </Button>
            </>
          )}
        </section>

        <section className="section">
          <h3>Zásahy</h3>
          {zone.ndcSite && <p className="muted">Místo NDC: {zone.ndcSite}. Jehla 14G nebo 10G, 3,25″.</p>}
          {pending === 'eye_shield' ? (
            <div className="grid-2">
              <Button onClick={() => record('eye_shield', 'pravé oko')}>Pravé oko</Button>
              <Button onClick={() => record('eye_shield', 'levé oko')}>Levé oko</Button>
            </div>
          ) : (
            <div className="grid-2">
              {interventionsForZone(zone).map((interventionKind) => (
                <Button
                  key={interventionKind}
                  tone={interventionKind.startsWith('tq_') ? 'danger' : 'default'}
                  onClick={() => (interventionKind === 'eye_shield' ? setPending('eye_shield') : record(interventionKind))}
                >
                  {INTERVENTION_LABEL[interventionKind]}
                </Button>
              ))}
            </div>
          )}
          <ul className="hints">
            {interventionsForZone(zone)
              .filter((k) => INTERVENTION_HINT[k])
              .map((k) => (
                <li key={k}>
                  <strong>{INTERVENTION_LABEL[k]}:</strong> {INTERVENTION_HINT[k]}
                </li>
              ))}
          </ul>
          {interventions.length > 0 && (
            <ul className="log">
              {interventions.map((item) => (
                <li key={item.id}>
                  {formatTime(item.at)} {INTERVENTION_LABEL[item.kind]}
                  {item.detail ? ` (${item.detail})` : ''}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};
