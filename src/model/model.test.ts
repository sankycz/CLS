import { describe, expect, it } from 'vitest';
import {
  TQ_REASSESS_MS,
  addInjury,
  addIntervention,
  canCLSConvert,
  convertTourniquet,
  createCasualty,
  reassessTourniquet,
  removeIntervention,
  setAssessment,
  suggestPatientType,
  suggestPrecedence,
} from './casualty';
import { checkStep, transition } from './fsm';
import { buildMist, buildNineLine, nineLineText } from './reports';
import type { Casualty } from './types';

const T0 = new Date(2026, 9, 26, 14, 30).getTime();

const inCover = (casualty: Casualty): Casualty => transition(casualty, { type: 'IN_COVER' }, T0).casualty;

describe('FSM', () => {
  it('pod palbou přejde do CUF_EXECUTOR a z krytu na MARCH_M', () => {
    const start = createCasualty(T0, 1);
    const cuf = transition(start, { type: 'UNDER_FIRE' }, T0).casualty;
    expect(cuf.fsm.state).toBe('CUF_EXECUTOR');
    expect(cuf.phase).toBe('CUF');

    const tfc = transition(cuf, { type: 'IN_COVER' }, T0).casualty;
    expect(tfc.fsm.state).toBe('MARCH_M');
    expect(tfc.phase).toBe('TFC');
    expect(tfc.interventions.some((item) => item.kind === 'moved_to_cover')).toBe(true);
  });

  it('nedovolí dokončit M při nezastaveném masivním krvácení', () => {
    let casualty = inCover(createCasualty(T0, 1));
    casualty = setAssessment(casualty, { bloodSweep: true }, T0);
    casualty = addInjury(casualty, { zoneId: 'thigh_right_prox', kind: 'gsw', bleeding: 'massive' }, T0);

    const blocked = transition(casualty, { type: 'COMPLETE_STEP' }, T0);
    expect(blocked.error).toMatch(/masivní krvácení/);
    expect(blocked.casualty.fsm.state).toBe('MARCH_M');

    casualty = addIntervention(casualty, 'tq_deliberate', T0, { zoneId: 'thigh_right_prox' });
    const next = transition(casualty, { type: 'COMPLETE_STEP' }, T0);
    expect(next.error).toBeUndefined();
    expect(next.casualty.fsm.state).toBe('MARCH_A');
  });

  it('turniket na končetině zastaví krvácení distálně na stejné končetině', () => {
    let casualty = createCasualty(T0, 1);
    casualty = addInjury(casualty, { zoneId: 'leg_right', kind: 'fragment', bleeding: 'massive' }, T0);
    casualty = addInjury(casualty, { zoneId: 'leg_left', kind: 'fragment', bleeding: 'massive' }, T0);
    casualty = addIntervention(casualty, 'tq_hasty', T0, { limb: 'RL' });
    expect(casualty.injuries.map((injury) => injury.controlled)).toEqual([true, false]);
    expect(casualty.tourniquets).toHaveLength(1);
  });

  it('nové zranění na končetině s turniketem je vedeno jako zastavené', () => {
    let casualty = addIntervention(createCasualty(T0, 1), 'tq_hasty', T0, { limb: 'RL' });
    casualty = addInjury(casualty, { zoneId: 'thigh_right_dist', kind: 'gsw', bleeding: 'massive' }, T0);
    casualty = addInjury(casualty, { zoneId: 'thigh_left_dist', kind: 'gsw', bleeding: 'massive' }, T0);
    expect(casualty.injuries.map((injury) => injury.controlled)).toEqual([true, false]);
  });

  it('přeskočení s blokátory je možné jen vědomě a zapíše se', () => {
    const casualty = inCover(createCasualty(T0, 1));
    const result = transition(casualty, { type: 'COMPLETE_STEP', override: true }, T0);
    expect(result.casualty.fsm.state).toBe('MARCH_A');
    expect(result.casualty.interventions.some((item) => item.kind === 'override')).toBe(true);
  });

  it('nelze skočit dopředu přes nedokončené kroky', () => {
    const casualty = inCover(createCasualty(T0, 1));
    expect(transition(casualty, { type: 'GOTO', step: 'MARCH_R' }, T0).error).toBeDefined();
  });

  it('REASSESS vrací na M a maže dokončené kroky', () => {
    let casualty = inCover(createCasualty(T0, 1));
    casualty = transition(casualty, { type: 'COMPLETE_STEP', override: true }, T0).casualty;
    casualty = transition(casualty, { type: 'REASSESS' }, T0).casualty;
    expect(casualty.fsm).toEqual({ state: 'MARCH_M', completed: [] });
  });

  it('otevřená rána hrudníku blokuje R, dokud není chest seal', () => {
    let casualty = createCasualty(T0, 1);
    casualty = addInjury(casualty, { zoneId: 'chest_upper_left', kind: 'gsw', bleeding: 'minor' }, T0);
    casualty = setAssessment(casualty, { chest: 'open_wound' }, T0);
    expect(checkStep(casualty, 'MARCH_R', T0).blockers.length).toBeGreaterThan(0);
    casualty = addIntervention(casualty, 'chest_seal', T0, { zoneId: 'chest_upper_left' });
    expect(checkStep(casualty, 'MARCH_R', T0).blockers).toEqual([]);
  });

  it('C vyžaduje reassessment turniketu', () => {
    let casualty = createCasualty(T0, 1);
    casualty = addIntervention(casualty, 'tq_hasty', T0, { limb: 'LA' });
    casualty = setAssessment(casualty, { radialPulse: 'strong' }, T0);
    expect(checkStep(casualty, 'MARCH_C', T0).blockers).toHaveLength(1);
    const tqId = casualty.tourniquets[0]!.id;
    casualty = reassessTourniquet(casualty, tqId, T0 + 60_000);
    expect(checkStep(casualty, 'MARCH_C', T0).blockers).toEqual([]);
  });
});

describe('turnikety', () => {
  it('CLS smí konvertovat jen do 2 h', () => {
    const casualty = addIntervention(createCasualty(T0, 1), 'tq_hasty', T0, { limb: 'RA' });
    const tq = casualty.tourniquets[0]!;
    expect(canCLSConvert(tq, T0 + TQ_REASSESS_MS - 1)).toBe(true);
    expect(canCLSConvert(tq, T0 + TQ_REASSESS_MS)).toBe(false);
  });

  it('smazání zásahu odstraní i turniket', () => {
    const casualty = addIntervention(createCasualty(T0, 1), 'tq_hasty', T0, { limb: 'RA' });
    const cleared = removeIntervention(casualty, casualty.interventions[0]!.id, T0);
    expect(cleared.tourniquets).toEqual([]);
  });

  it('konverze uzavře turniket', () => {
    const casualty = addIntervention(createCasualty(T0, 1), 'tq_deliberate', T0, { limb: 'RA' });
    const converted = convertTourniquet(casualty, casualty.tourniquets[0]!.id, T0 + 1000);
    expect(converted.tourniquets[0]!.removedAt).toBe(T0 + 1000);
  });
});

describe('hlášení', () => {
  const wounded = (): Casualty => {
    let casualty = createCasualty(T0, 3);
    casualty = { ...casualty, mechanisms: ['gsw'] };
    casualty = addInjury(casualty, { zoneId: 'thigh_left_prox', kind: 'gsw', bleeding: 'massive' }, T0);
    casualty = addIntervention(casualty, 'tq_deliberate', T0 + 60_000, { zoneId: 'thigh_left_prox' });
    return casualty;
  };

  it('navrhne naléhavost a typ pacienta', () => {
    const casualty = wounded();
    expect(suggestPrecedence(casualty)).toBe('B');
    expect(suggestPatientType(casualty)).toBe('L');
    expect(suggestPrecedence(setAssessment(casualty, { radialPulse: 'absent' }, T0))).toBe('A');
  });

  it('sestaví 9-Line pro více zraněných', () => {
    const second = createCasualty(T0, 4);
    const lines = buildNineLine([wounded(), second], { ...second.evac, location: '33UVR1234567890' });
    expect(lines).toHaveLength(9);
    expect(lines[2]!.value).toBe('1B 1D');
    expect(lines[4]!.value).toBe('1A 1L');
    const text = nineLineText(lines);
    expect(text).toContain('L1: 33UVR1234567890');
    expect(text).toContain('L3: 1 BRAVO, 1 DELTA');
  });

  it('MIST obsahuje mechanismus, zranění a časované zásahy', () => {
    const mist = buildMist(wounded());
    expect(mist.m).toContain('14:30');
    expect(mist.i).toContain('GSW Levé stehno proximálně');
    expect(mist.i).toContain('zastaveno');
    expect(mist.t).toContain('14:31 Deliberate TQ');
  });
});
