import { useCallback, useEffect, useRef, useState } from 'react';
import { createCasualty } from './model/casualty';
import { isMarchStep, transition, type FsmEvent } from './model/fsm';
import { PHASE_LABEL } from './model/labels';
import type { Casualty } from './model/types';
import { loadCasualties, requestPersistentStorage, saveCasualties } from './storage/db';
import { useNow } from './hooks/useNow';
import { THEME_LABEL, useTheme } from './hooks/useTheme';
import { useWakeLock } from './hooks/useWakeLock';
import { useTqAlerts } from './hooks/useTqAlerts';
import { haptic } from './hooks/haptic';
import { onServiceWorkerUpdate, applyServiceWorkerUpdate } from './sw-register';
import { Home } from './components/Home';
import { CufExecutor, PhaseQuery } from './components/CareScreens';
import { MarchNav, MarchStepView } from './components/MarchStep';
import { ReportView } from './components/ReportView';
import { InterventionLog, Tacevac } from './components/Tacevac';
import { TqStrip } from './components/TqTimers';
import { ZoneSheet, type Act } from './components/ZoneSheet';
import { Button } from './components/ui';

const DISCLAIMER_KEY = 'cls-disclaimer-v1';

const readDisclaimer = (): boolean => {
  try {
    return localStorage.getItem(DISCLAIMER_KEY) === 'yes';
  } catch {
    return false;
  }
};

const Disclaimer = ({ onAccept }: { onAccept: () => void }) => (
  <div className="sheet-backdrop">
    <div className="sheet disclaimer" role="dialog" aria-label="Upozornění">
      <h2>Výcviková pomůcka</h2>
      <p>
        Aplikace podporuje postup TCCC na úrovni záchranáře CLS (MARCH PAWS, 9-Line MEDEVAC, MIST, DD 1380). Nenahrazuje certifikovaný výcvik, pokyny
        zdravotníka ani platné směrnice CoTCCC / JTS a vlastního útvaru.
      </p>
      <p>Časovače turniketů fungují jen při otevřené aplikaci. Čas přiložení TQ vždy zapiš i fyzicky na zraněného.</p>
      <Button tone="ok" big onClick={onAccept}>
        Rozumím
      </Button>
    </div>
  </div>
);

export const App = () => {
  const [casualties, setCasualties] = useState<Casualty[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [activeId, setActiveId] = useState<string | undefined>();
  const [zoneId, setZoneId] = useState<string | undefined>();
  const [toast, setToast] = useState<string | undefined>();
  const [accepted, setAccepted] = useState(readDisclaimer);
  const [updateReady, setUpdateReady] = useState(false);
  const toastTimer = useRef<number | undefined>(undefined);
  const now = useNow();
  const { theme, cycle } = useTheme();

  useEffect(() => {
    void loadCasualties().then((stored) => {
      setCasualties(stored);
      setLoaded(true);
    });
    void requestPersistentStorage();
    return onServiceWorkerUpdate(() => setUpdateReady(true));
  }, []);

  useEffect(() => {
    if (loaded) void saveCasualties(casualties);
  }, [casualties, loaded]);

  const active = casualties.find((casualty) => casualty.id === activeId);
  useWakeLock(active !== undefined);
  useTqAlerts(casualties, now);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(undefined), 4000);
  }, []);

  const act: Act = useCallback(
    (update) => {
      if (!activeId) return;
      setCasualties((list) => list.map((casualty) => (casualty.id === activeId ? update(casualty, Date.now()) : casualty)));
    },
    [activeId],
  );

  const send = useCallback(
    (event: FsmEvent) => {
      if (!active) return;
      const result = transition(active, event, Date.now());
      if (result.error) {
        haptic([80, 60, 80]);
        showToast(result.error);
        return;
      }
      setCasualties((list) => list.map((casualty) => (casualty.id === active.id ? { ...result.casualty, updatedAt: Date.now() } : casualty)));
      window.scrollTo({ top: 0 });
    },
    [active, showToast],
  );

  const createNew = () => {
    const highest = Math.max(0, ...casualties.map((c) => Number(c.identity.battleRoster.replace(/\D/g, '')) || 0));
    const casualty = createCasualty(Date.now(), highest + 1);
    setCasualties((list) => [...list, casualty]);
    setActiveId(casualty.id);
  };

  const toggleClosed = (id: string) =>
    setCasualties((list) =>
      list.map((casualty) =>
        casualty.id === id ? { ...casualty, closedAt: casualty.closedAt ? undefined : Date.now(), updatedAt: Date.now() } : casualty,
      ),
    );

  const state = active?.fsm.state;
  const showNav = state !== undefined && state !== 'PHASE_QUERY' && state !== 'CUF_EXECUTOR';

  return (
    <div className={`app${state === 'CUF_EXECUTOR' ? ' app-cuf' : ''}`}>
      <header className="topbar">
        {active ? (
          <button type="button" className="btn btn-ghost" onClick={() => { setActiveId(undefined); setZoneId(undefined); }}>
            ◀ Seznam
          </button>
        ) : (
          <span className="brand">CLS · TCCC</span>
        )}
        {active && (
          <div className="topbar-title">
            <strong>{active.identity.battleRoster}</strong>
            <span className={`phase-badge phase-${active.phase}`} title={PHASE_LABEL[active.phase]}>
              {active.phase}
            </span>
          </div>
        )}
        <button type="button" className="btn btn-ghost theme-btn" onClick={cycle} aria-label="Přepnout režim zobrazení">
          {THEME_LABEL[theme]}
        </button>
      </header>

      {active && <TqStrip casualty={active} now={now} />}

      {updateReady && (
        <div className="update-banner">
          Je k dispozici nová verze.
          <Button tone="accent" onClick={applyServiceWorkerUpdate}>
            Načíst
          </Button>
        </div>
      )}

      <main className="content">
        {!loaded && <p className="muted">Načítám…</p>}
        {loaded && !active && (
          <Home
            casualties={casualties}
            now={now}
            onNew={createNew}
            onOpen={setActiveId}
            onToggleClosed={toggleClosed}
            onDelete={(id) => setCasualties((list) => list.filter((casualty) => casualty.id !== id))}
          />
        )}
        {active && state === 'PHASE_QUERY' && <PhaseQuery send={send} />}
        {active && state === 'CUF_EXECUTOR' && <CufExecutor casualty={active} act={act} send={send} />}
        {active && state !== undefined && isMarchStep(state) && (
          <>
            <MarchStepView step={state} casualty={active} act={act} now={now} send={send} openZone={setZoneId} />
            <details className="log-details">
              <summary>Záznam zásahů ({active.interventions.length + active.meds.length})</summary>
              <InterventionLog casualty={active} act={act} />
            </details>
          </>
        )}
        {active && state === 'REPORT_GEN' && <ReportView casualty={active} all={casualties} act={act} send={send} />}
        {active && state === 'TACEVAC' && <Tacevac casualty={active} act={act} send={send} now={now} />}
      </main>

      {active && showNav && (
        <footer className="bottombar">
          <MarchNav casualty={active} send={send} />
          <button type="button" className="btn btn-danger fire-btn" onClick={() => send({ type: 'UNDER_FIRE' })}>
            PALBA!
          </button>
        </footer>
      )}

      {active && zoneId && <ZoneSheet casualty={active} zoneId={zoneId} act={act} onClose={() => setZoneId(undefined)} />}
      {toast && (
        <div className="toast" role="alert" onClick={() => setToast(undefined)}>
          {toast}
        </div>
      )}
      {!accepted && (
        <Disclaimer
          onAccept={() => {
            try {
              localStorage.setItem(DISCLAIMER_KEY, 'yes');
            } catch {
              // localStorage nedostupné
            }
            setAccepted(true);
          }}
        />
      )}
    </div>
  );
};
