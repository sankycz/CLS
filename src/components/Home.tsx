import { useState } from 'react';
import { activeTourniquets, effectivePrecedence } from '../model/casualty';
import { PHASE_LABEL, STEP_TITLE } from '../model/labels';
import { formatDuration, formatTime } from '../model/reports';
import { isMarchStep } from '../model/fsm';
import type { Casualty } from '../model/types';
import { Button } from './ui';

const stateLabel = (casualty: Casualty): string => {
  const { state } = casualty.fsm;
  if (isMarchStep(state)) return STEP_TITLE[state];
  if (state === 'PHASE_QUERY') return 'Určení situace';
  if (state === 'CUF_EXECUTOR') return 'Pod palbou';
  if (state === 'REPORT_GEN') return 'Hlášení';
  return 'Evakuace';
};

const exportJson = (casualties: Casualty[]) => {
  const blob = new Blob([JSON.stringify(casualties, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `cls-zaznamy-${new Date().toISOString().slice(0, 16).replace(':', '')}.json`;
  link.click();
  URL.revokeObjectURL(url);
};

export const Home = ({
  casualties,
  now,
  onNew,
  onOpen,
  onToggleClosed,
  onDelete,
}: {
  casualties: Casualty[];
  now: number;
  onNew: () => void;
  onOpen: (id: string) => void;
  onToggleClosed: (id: string) => void;
  onDelete: (id: string) => void;
}) => {
  const [notificationState, setNotificationState] = useState(() => ('Notification' in window ? Notification.permission : 'unsupported'));
  const open = casualties.filter((c) => c.closedAt === undefined);
  const closed = casualties.filter((c) => c.closedAt !== undefined);

  const renderCard = (casualty: Casualty) => {
    const tqs = activeTourniquets(casualty);
    const oldest = tqs.reduce<number | undefined>((min, tq) => (min === undefined || tq.appliedAt < min ? tq.appliedAt : min), undefined);
    return (
      <li key={casualty.id} className={`casualty-card prec-${effectivePrecedence(casualty)}`}>
        <button type="button" className="casualty-main" onClick={() => onOpen(casualty.id)}>
          <span className="casualty-id">
            {casualty.identity.battleRoster}
            {casualty.identity.name ? ` · ${casualty.identity.name}` : ''}
          </span>
          <span className="muted">
            {PHASE_LABEL[casualty.phase]} · {stateLabel(casualty)} · zranění {formatTime(casualty.injuryAt)}
          </span>
          <span className="casualty-meta">
            <span className="prec-badge">{effectivePrecedence(casualty)}</span>
            {casualty.injuries.length} zranění
            {oldest !== undefined && <span className="tq-chip tq-chip-ok">TQ ×{tqs.length} · {formatDuration(now - oldest)}</span>}
          </span>
        </button>
        <div className="casualty-actions">
          <Button tone="ghost" onClick={() => onToggleClosed(casualty.id)}>
            {casualty.closedAt ? 'Obnovit' : 'Předán'}
          </Button>
          {casualty.closedAt && (
            <Button
              tone="ghost"
              onClick={() => {
                if (window.confirm(`Trvale smazat záznam ${casualty.identity.battleRoster}?`)) onDelete(casualty.id);
              }}
            >
              Smazat
            </Button>
          )}
        </div>
      </li>
    );
  };

  return (
    <div className="home">
      <Button tone="danger" big onClick={onNew}>
        + NOVÝ ZRANĚNÝ
      </Button>

      {open.length > 0 && (
        <>
          <h2>Ošetřovaní ({open.length})</h2>
          <ul className="casualty-list">{open.map(renderCard)}</ul>
        </>
      )}
      {closed.length > 0 && (
        <details className="closed">
          <summary>Předaní ({closed.length})</summary>
          <ul className="casualty-list">{closed.map(renderCard)}</ul>
        </details>
      )}

      <section className="section">
        <h3>Nastavení</h3>
        {notificationState === 'default' && (
          <Button onClick={() => void Notification.requestPermission().then(setNotificationState)}>Povolit upozornění na turnikety</Button>
        )}
        {notificationState === 'denied' && <p className="muted">Upozornění jsou v prohlížeči zakázaná – zůstává vibrace a vizuální signál.</p>}
        {casualties.length > 0 && <Button onClick={() => exportJson(casualties)}>Export záznamů (JSON)</Button>}
        <p className="muted small">
          Aplikace funguje offline. Data zůstávají jen v tomto zařízení (IndexedDB + záloha v localStorage), nikam se neodesílají. Pro instalaci zvol v prohlížeči
          „Přidat na plochu“.
        </p>
      </section>
    </div>
  );
};
