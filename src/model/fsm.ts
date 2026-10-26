// Stavový automat postupu TCCC: PHASE_QUERY → CUF_EXECUTOR / MARCH PAWS → REPORT_GEN → TACEVAC.
// Krok MARCH PAWS lze dokončit jen po vyřešení kritických bodů (blokátorů), nebo vědomým přeskočením,
// které se zapíše do záznamu zásahů.

import { activeTourniquets, addIntervention, hasUncontrolledMassiveBleeding, txaIndicated } from './casualty';
import { INJURY_LABEL, STEP_TITLE } from './labels';
import { findZone, zoneLabel } from './zones';
import type { Casualty, FsmState, MarchStep } from './types';

export const MARCH_ORDER: MarchStep[] = [
  'MARCH_M',
  'MARCH_A',
  'MARCH_R',
  'MARCH_C',
  'MARCH_H',
  'PAWS_P',
  'PAWS_A',
  'PAWS_W',
  'PAWS_S',
];

export type FsmEvent =
  | { type: 'UNDER_FIRE' }
  | { type: 'IN_COVER' }
  | { type: 'COMPLETE_STEP'; override?: boolean }
  | { type: 'GOTO'; step: MarchStep }
  | { type: 'REASSESS' }
  | { type: 'REQUEST_REPORT' }
  | { type: 'START_EVAC' }
  | { type: 'RESUME_CARE' };

export type StepCheck = { blockers: string[]; warnings: string[] };

export type TransitionResult = { casualty: Casualty; error?: string };

export const isMarchStep = (state: FsmState): state is MarchStep => (MARCH_ORDER as string[]).includes(state);

export const nextIncompleteStep = (completed: MarchStep[]): MarchStep | undefined =>
  MARCH_ORDER.find((step) => !completed.includes(step));

const hasIntervention = (casualty: Casualty, kind: string, zoneId?: string): boolean =>
  casualty.interventions.some((item) => item.kind === kind && (zoneId === undefined || item.zoneId === zoneId));

const isOpenChestWound = (casualty: Casualty, zoneId: string, kind: string): boolean =>
  findZone(zoneId)?.type === 'thoracic' && (kind === 'gsw' || kind === 'fragment') && !hasIntervention(casualty, 'chest_seal', zoneId);

export const checkStep = (casualty: Casualty, step: MarchStep, now: number): StepCheck => {
  const { assessment } = casualty;
  const blockers: string[] = [];
  const warnings: string[] = [];

  switch (step) {
    case 'MARCH_M': {
      if (!assessment.bloodSweep) blockers.push('Proveďte blood sweep celého těla (zepředu i zezadu).');
      casualty.injuries
        .filter((injury) => injury.bleeding === 'massive' && !injury.controlled)
        .forEach((injury) => blockers.push(`Nezastavené masivní krvácení: ${zoneLabel(injury.zoneId)}.`));
      activeTourniquets(casualty)
        .filter((tq) => tq.type === 'hasty')
        .forEach(() => warnings.push('Hasty TQ z CUF: obnažte ránu a nahraďte deliberate TQ 5–7 cm nad ranou.'));
      break;
    }
    case 'MARCH_A': {
      if (!assessment.avpu) blockers.push('Určete stav vědomí (AVPU).');
      if (!assessment.airway) blockers.push('Zhodnoťte průchodnost dýchacích cest.');
      if (assessment.airway === 'compromised') blockers.push('Dýchací cesty nejsou zajištěny: jaw-thrust, NPA, zotavovací poloha.');
      break;
    }
    case 'MARCH_R': {
      if (!assessment.chest) blockers.push('Obnažte a zkontrolujte hrudník zepředu i zezadu.');
      casualty.injuries
        .filter((injury) => isOpenChestWound(casualty, injury.zoneId, injury.kind))
        .forEach((injury) => blockers.push(`Otevřená rána hrudníku bez chest sealu: ${zoneLabel(injury.zoneId)}.`));
      if (assessment.chest === 'open_wound' && !hasIntervention(casualty, 'chest_seal')) {
        blockers.push('Přiložte ventilový chest seal (vstup i výstup).');
      }
      if (assessment.chest === 'tension_suspected' && !hasIntervention(casualty, 'ndc')) {
        blockers.push('Podezření na tenzní pneumotorax: proveďte jehelní dekompresi (NDC).');
      }
      break;
    }
    case 'MARCH_C': {
      if (!assessment.radialPulse) blockers.push('Zkontrolujte radiální pulz.');
      activeTourniquets(casualty)
        .filter((tq) => tq.reassessedAt === undefined)
        .forEach(() => blockers.push('Přehodnoťte všechny přiložené turnikety (reassessment).'));
      if (hasUncontrolledMassiveBleeding(casualty)) blockers.push('Stále nezastavené masivní krvácení – zpět na M.');
      if (txaIndicated(casualty) && !casualty.meds.some((med) => med.category === 'txa')) {
        warnings.push('Indikace TXA 2 g – vyžádejte zdravotníka (CMC), CLS TXA nepodává.');
      }
      break;
    }
    case 'MARCH_H': {
      if (!assessment.headInjury) blockers.push('Zhodnoťte poranění hlavy (TBI).');
      if (!assessment.hypothermia) blockers.push('Proveďte prevenci hypotermie (nebo uveďte, že nelze).');
      casualty.injuries
        .filter((injury) => injury.kind === 'eye' && !hasIntervention(casualty, 'eye_shield'))
        .forEach(() => warnings.push(`${INJURY_LABEL.eye}: přiložte Rigid Eye Shield, ne tlakový obvaz.`));
      break;
    }
    case 'PAWS_P':
      if (!assessment.pain) blockers.push('Rozhodněte o analgezii.');
      break;
    case 'PAWS_A':
      if (!assessment.antibiotics) blockers.push('Rozhodněte o antibiotikách.');
      break;
    case 'PAWS_W':
      if (!assessment.wounds) blockers.push('Zkontrolujte a ošetřete zbývající rány.');
      break;
    case 'PAWS_S':
      if (!assessment.splint) blockers.push('Zkontrolujte zlomeniny a dlahování.');
      casualty.injuries
        .filter((injury) => injury.kind === 'fracture' && !hasIntervention(casualty, 'splint', injury.zoneId))
        .forEach((injury) => warnings.push(`Zlomenina bez dlahy: ${zoneLabel(injury.zoneId)}.`));
      break;
  }

  activeTourniquets(casualty)
    .filter((tq) => now - tq.appliedAt >= 2 * 60 * 60 * 1000)
    .forEach(() => warnings.push('TQ přiložen déle než 2 h – konverzi smí provést jen zdravotnický personál.'));

  return { blockers: [...new Set(blockers)], warnings: [...new Set(warnings)] };
};

const withFsm = (casualty: Casualty, state: FsmState, completed: MarchStep[], phase = casualty.phase): Casualty => ({
  ...casualty,
  phase,
  fsm: { state, completed },
});

export const transition = (casualty: Casualty, event: FsmEvent, now: number): TransitionResult => {
  const { state, completed } = casualty.fsm;

  switch (event.type) {
    case 'UNDER_FIRE':
      return { casualty: withFsm(casualty, 'CUF_EXECUTOR', completed, 'CUF') };

    case 'IN_COVER': {
      if (state !== 'PHASE_QUERY' && state !== 'CUF_EXECUTOR') return { casualty, error: 'Přechod do krytu jen z CUF.' };
      const logged = state === 'CUF_EXECUTOR' ? addIntervention(casualty, 'moved_to_cover', now) : casualty;
      // Každá změna taktické situace vrací postup na začátek MARCH.
      return { casualty: withFsm(logged, 'MARCH_M', [], 'TFC') };
    }

    case 'COMPLETE_STEP': {
      if (!isMarchStep(state)) return { casualty, error: 'Není aktivní krok MARCH PAWS.' };
      const { blockers } = checkStep(casualty, state, now);
      if (blockers.length > 0 && !event.override) return { casualty, error: blockers.join(' ') };
      const logged =
        blockers.length > 0
          ? addIntervention(casualty, 'override', now, { detail: `${STEP_TITLE[state]}: ${blockers.join(' ')}` })
          : casualty;
      const nextCompleted = completed.includes(state) ? completed : [...completed, state];
      const next = nextIncompleteStep(nextCompleted) ?? 'REPORT_GEN';
      return { casualty: withFsm(logged, next, nextCompleted) };
    }

    case 'GOTO': {
      if (state === 'PHASE_QUERY' || state === 'CUF_EXECUTOR') return { casualty, error: 'Nejdřív přesun do krytu.' };
      const allowed = completed.includes(event.step) || nextIncompleteStep(completed) === event.step;
      if (!allowed) return { casualty, error: 'Kroky MARCH PAWS nelze přeskakovat.' };
      return { casualty: withFsm(casualty, event.step, completed) };
    }

    case 'REASSESS': {
      if (state === 'PHASE_QUERY' || state === 'CUF_EXECUTOR') return { casualty, error: 'Nejdřív přesun do krytu.' };
      return { casualty: withFsm(casualty, 'MARCH_M', []) };
    }

    case 'REQUEST_REPORT': {
      if (state === 'PHASE_QUERY') return { casualty, error: 'Nejdřív určete taktickou fázi.' };
      return { casualty: withFsm(casualty, 'REPORT_GEN', completed) };
    }

    case 'START_EVAC': {
      if (state === 'PHASE_QUERY' || state === 'CUF_EXECUTOR') return { casualty, error: 'Nejdřív přesun do krytu.' };
      return { casualty: withFsm(casualty, 'TACEVAC', completed, 'TACEVAC') };
    }

    case 'RESUME_CARE': {
      if (state !== 'REPORT_GEN' && state !== 'TACEVAC') return { casualty };
      return { casualty: withFsm(casualty, nextIncompleteStep(completed) ?? 'REPORT_GEN', completed) };
    }
  }
};
