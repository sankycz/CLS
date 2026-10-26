import {
  TQ_REASSESS_MS,
  TQ_WARNING_MS,
  activeTourniquets,
  canCLSConvert,
  convertTourniquet,
  reassessTourniquet,
  replaceWithDeliberate,
} from '../model/casualty';
import { formatDuration, formatTime } from '../model/reports';
import { LIMB_LABEL } from '../model/zones';
import type { Casualty, Tourniquet } from '../model/types';
import type { Act } from './ZoneSheet';
import { Button } from './ui';

const tqStatus = (tq: Tourniquet, now: number): 'ok' | 'warn' | 'danger' => {
  const elapsed = now - tq.appliedAt;
  if (elapsed >= TQ_REASSESS_MS) return 'danger';
  return elapsed >= TQ_WARNING_MS ? 'warn' : 'ok';
};

/** Kompaktní pás časovačů v hlavičce. */
export const TqStrip = ({ casualty, now }: { casualty: Casualty; now: number }) => {
  const tqs = activeTourniquets(casualty);
  if (tqs.length === 0) return null;
  return (
    <div className="tq-strip" aria-live="polite">
      {tqs.map((tq) => (
        <span key={tq.id} className={`tq-chip tq-chip-${tqStatus(tq, now)}`}>
          TQ {tq.limb} {formatDuration(now - tq.appliedAt)}
        </span>
      ))}
    </div>
  );
};

export const TqPanel = ({ casualty, now, act }: { casualty: Casualty; now: number; act: Act }) => {
  const tqs = activeTourniquets(casualty);
  if (tqs.length === 0) return <p className="muted">Žádný aktivní turniket.</p>;
  return (
    <div className="tq-panel">
      {tqs.map((tq) => {
        const status = tqStatus(tq, now);
        const remaining = TQ_REASSESS_MS - (now - tq.appliedAt);
        return (
          <div key={tq.id} className={`tq-card tq-card-${status}`}>
            <div className="tq-card-head">
              <strong>
                {LIMB_LABEL[tq.limb]} – {tq.type === 'hasty' ? 'Hasty' : 'Deliberate'} TQ
              </strong>
              <span className="tq-time">{formatDuration(now - tq.appliedAt)}</span>
            </div>
            <div className="muted">
              Přiložen {formatTime(tq.appliedAt)}
              {tq.reassessedAt ? ` · přehodnocen ${formatTime(tq.reassessedAt)}` : ' · NEPŘEHODNOCEN'}
              {remaining > 0 ? ` · do 2 h zbývá ${formatDuration(remaining)}` : ' · přes 2 h – konverze jen zdravotník'}
            </div>
            <div className="grid-2">
              <Button tone="accent" onClick={() => act((c, t) => reassessTourniquet(c, tq.id, t))}>
                Přehodnotit
              </Button>
              {tq.type === 'hasty' && (
                <Button tone="danger" onClick={() => act((c, t) => replaceWithDeliberate(c, tq.id, t))}>
                  Nahradit deliberate TQ
                </Button>
              )}
              {canCLSConvert(tq, now) && (
                <Button
                  tone="warn"
                  onClick={() => {
                    if (window.confirm('Konverze TQ na tlakový obvaz: jen pokud zraněný není v šoku, nejde o amputaci a lze ho průběžně sledovat. Pokračovat?')) {
                      act((c, t) => convertTourniquet(c, tq.id, t));
                    }
                  }}
                >
                  Konvertovat
                </Button>
              )}
            </div>
          </div>
        );
      })}
      <p className="muted small">
        Upozornění běží jen při otevřené aplikaci. Čas přiložení vždy zapiš i na turniket / čelo zraněného (T + čas).
      </p>
    </div>
  );
};
