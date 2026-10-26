import { useEffect, useRef } from 'react';
import { TQ_REASSESS_MS, TQ_WARNING_MS, activeTourniquets } from '../model/casualty';
import { LIMB_LABEL } from '../model/zones';
import type { Casualty } from '../model/types';
import { haptic } from './haptic';

const notify = async (title: string, body: string): Promise<void> => {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration) await registration.showNotification(title, { body, tag: title, requireInteraction: true });
    else new Notification(title, { body });
  } catch {
    // Notifikace selhala – zůstává vizuální a haptické upozornění.
  }
};

/** Upozorní 15 min před a po uplynutí 2 h od přiložení turniketu. Funguje jen při běžící aplikaci. */
export const useTqAlerts = (casualties: Casualty[], now: number): void => {
  const fired = useRef(new Set<string>());

  useEffect(() => {
    casualties
      .filter((casualty) => casualty.closedAt === undefined)
      .forEach((casualty) => {
        activeTourniquets(casualty).forEach((tq) => {
          const elapsed = now - tq.appliedAt;
          const who = `${casualty.identity.battleRoster} ${LIMB_LABEL[tq.limb]}`;
          const levels: Array<[string, number, string]> = [
            ['warn', TQ_WARNING_MS, `${who}: za 15 min uplynou 2 h od přiložení TQ. Proveďte reassessment / konverzi.`],
            ['limit', TQ_REASSESS_MS, `${who}: TQ přiložen 2 h. Konverzi smí provést už jen zdravotník.`],
          ];
          levels.forEach(([level, threshold, message]) => {
            const key = `${tq.id}:${level}`;
            if (elapsed < threshold || fired.current.has(key)) return;
            fired.current.add(key);
            haptic([300, 150, 300, 150, 300]);
            void notify('Turniket – časový limit', message);
          });
        });
      });
  }, [casualties, now]);
};
