// Čisté funkce pro práci se záznamem zraněného. Každá vrací nový objekt.

import { findZone } from './zones';
import type {
  Assessment,
  Bleeding,
  Casualty,
  EvacInfo,
  Injury,
  InjuryKind,
  InterventionKind,
  Limb,
  Medication,
  Precedence,
  Tourniquet,
  Vitals,
} from './types';

export const TQ_REASSESS_MS = 2 * 60 * 60 * 1000;
export const TQ_WARNING_MS = 105 * 60 * 1000;

const HEMORRHAGE_CONTROL: ReadonlySet<InterventionKind> = new Set([
  'tq_hasty',
  'tq_deliberate',
  'wound_packing',
  'pressure_dressing',
]);

const AIRWAY_MANAGEMENT: ReadonlySet<InterventionKind> = new Set(['jaw_thrust', 'npa', 'recovery_position']);

export const newId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const DEFAULT_EVAC: EvacInfo = {
  location: '',
  frequency: '',
  callsign: '',
  equipment: ['A'],
  security: 'N',
  marking: 'C',
  nationality: 'A',
  cbrn: '-',
};

export const createCasualty = (now: number, rosterNumber: number): Casualty => ({
  id: newId(),
  createdAt: now,
  updatedAt: now,
  injuryAt: now,
  phase: 'CUF',
  identity: {
    battleRoster: `Z-${String(rosterNumber).padStart(2, '0')}`,
    name: '',
    last4: '',
    unit: '',
    sex: '',
    allergies: '',
  },
  mechanisms: [],
  injuries: [],
  interventions: [],
  tourniquets: [],
  vitals: [],
  meds: [],
  assessment: {},
  fsm: { state: 'PHASE_QUERY', completed: [] },
  evac: { ...DEFAULT_EVAC, equipment: [...DEFAULT_EVAC.equipment] },
  notes: '',
  firstResponder: '',
});

const touch = (casualty: Casualty, now: number): Casualty => ({ ...casualty, updatedAt: now });

export const addInjury = (
  casualty: Casualty,
  input: { zoneId: string; kind: InjuryKind; bleeding: Bleeding },
  now: number,
): Casualty => {
  // Nové zranění na končetině s aktivním turniketem považujeme za zastavené; uživatel to může přepnout.
  const zone = findZone(input.zoneId);
  const underTourniquet =
    zone?.type === 'extremity' && casualty.tourniquets.some((tq) => tq.removedAt === undefined && tq.limb === zone.limb);
  const injury: Injury = { id: newId(), at: now, controlled: input.bleeding === 'none' || underTourniquet, ...input };
  return touch({ ...casualty, injuries: [...casualty.injuries, injury] }, now);
};

export const removeInjury = (casualty: Casualty, injuryId: string, now: number): Casualty =>
  touch({ ...casualty, injuries: casualty.injuries.filter((injury) => injury.id !== injuryId) }, now);

export const setInjuryControlled = (casualty: Casualty, injuryId: string, controlled: boolean, now: number): Casualty =>
  touch(
    {
      ...casualty,
      injuries: casualty.injuries.map((injury) => (injury.id === injuryId ? { ...injury, controlled } : injury)),
    },
    now,
  );

/** Turniket stavějí krvácení na celé končetině pod místem přiložení, ostatní prostředky jen v dané zóně. */
const controlBleeding = (injuries: Injury[], zoneId: string | undefined, limb: Limb | undefined): Injury[] =>
  injuries.map((injury) => {
    const sameZone = zoneId !== undefined && injury.zoneId === zoneId;
    const sameLimb = limb !== undefined && findZone(injury.zoneId)?.type === 'extremity' && findZone(injury.zoneId)?.limb === limb;
    return sameZone || sameLimb ? { ...injury, controlled: true } : injury;
  });

export const addIntervention = (
  casualty: Casualty,
  kind: InterventionKind,
  now: number,
  options: { zoneId?: string; detail?: string; limb?: Limb } = {},
): Casualty => {
  const zone = findZone(options.zoneId);
  const isTourniquet = kind === 'tq_hasty' || kind === 'tq_deliberate';
  const limb = options.limb ?? (isTourniquet ? zone?.limb : undefined);

  let tourniquets = casualty.tourniquets;
  let tourniquetId: string | undefined;
  if (isTourniquet && limb) {
    const tourniquet: Tourniquet = {
      id: newId(),
      limb,
      type: kind === 'tq_hasty' ? 'hasty' : 'deliberate',
      appliedAt: now,
      zoneId: options.zoneId,
    };
    tourniquetId = tourniquet.id;
    tourniquets = [...tourniquets, tourniquet];
  }

  const injuries = HEMORRHAGE_CONTROL.has(kind)
    ? controlBleeding(casualty.injuries, options.zoneId, isTourniquet ? limb : undefined)
    : casualty.injuries;

  const assessment: Assessment =
    AIRWAY_MANAGEMENT.has(kind) && casualty.assessment.airway !== 'patent'
      ? { ...casualty.assessment, airway: 'managed' }
      : casualty.assessment;

  return touch(
    {
      ...casualty,
      injuries,
      tourniquets,
      assessment,
      interventions: [
        ...casualty.interventions,
        { id: newId(), at: now, kind, phase: casualty.phase, zoneId: options.zoneId, detail: options.detail, tourniquetId },
      ],
    },
    now,
  );
};

export const removeIntervention = (casualty: Casualty, interventionId: string, now: number): Casualty => {
  const removed = casualty.interventions.find((item) => item.id === interventionId);
  return touch(
    {
      ...casualty,
      interventions: casualty.interventions.filter((item) => item.id !== interventionId),
      tourniquets: removed?.tourniquetId
        ? casualty.tourniquets.filter((tq) => tq.id !== removed.tourniquetId)
        : casualty.tourniquets,
    },
    now,
  );
};

const updateTourniquet = (casualty: Casualty, id: string, patch: Partial<Tourniquet>): Tourniquet[] =>
  casualty.tourniquets.map((tq) => (tq.id === id ? { ...tq, ...patch } : tq));

export const reassessTourniquet = (casualty: Casualty, tourniquetId: string, now: number): Casualty => {
  const tq = casualty.tourniquets.find((item) => item.id === tourniquetId);
  if (!tq) return casualty;
  const withLog = addIntervention(casualty, 'tq_reassessed', now, { zoneId: tq.zoneId, limb: tq.limb });
  return { ...withLog, tourniquets: updateTourniquet(withLog, tourniquetId, { reassessedAt: now }) };
};

/** Rychlý TQ nahrazen cíleným TQ 5–7 cm nad ranou. Původní turniket se uzavře, vznikne nový. */
export const replaceWithDeliberate = (casualty: Casualty, tourniquetId: string, now: number): Casualty => {
  const tq = casualty.tourniquets.find((item) => item.id === tourniquetId);
  if (!tq) return casualty;
  const closed = { ...casualty, tourniquets: updateTourniquet(casualty, tourniquetId, { removedAt: now, reassessedAt: now }) };
  return addIntervention(closed, 'tq_deliberate', now, { limb: tq.limb, zoneId: tq.zoneId, detail: 'náhrada za rychlý TQ' });
};

/** Konverze TQ na tlakový obvaz / tamponádu. CLS smí konvertovat jen do 2 h od přiložení. */
export const convertTourniquet = (casualty: Casualty, tourniquetId: string, now: number): Casualty => {
  const tq = casualty.tourniquets.find((item) => item.id === tourniquetId);
  if (!tq) return casualty;
  const withLog = addIntervention(casualty, 'tq_converted', now, { zoneId: tq.zoneId, limb: tq.limb, detail: 'na tlakový obvaz' });
  return { ...withLog, tourniquets: updateTourniquet(withLog, tourniquetId, { convertedAt: now, removedAt: now, reassessedAt: now }) };
};

export const activeTourniquets = (casualty: Casualty): Tourniquet[] =>
  casualty.tourniquets.filter((tq) => tq.removedAt === undefined);

export const canCLSConvert = (tq: Tourniquet, now: number): boolean => now - tq.appliedAt < TQ_REASSESS_MS;

export const setAssessment = (casualty: Casualty, patch: Assessment, now: number): Casualty =>
  touch({ ...casualty, assessment: { ...casualty.assessment, ...patch } }, now);

export const addVitals = (casualty: Casualty, vitals: Omit<Vitals, 'id'>, now: number): Casualty =>
  touch({ ...casualty, vitals: [...casualty.vitals, { ...vitals, id: newId() }] }, now);

export const addMedication = (casualty: Casualty, med: Omit<Medication, 'id'>, now: number): Casualty =>
  touch({ ...casualty, meds: [...casualty.meds, { ...med, id: newId() }] }, now);

export const removeMedication = (casualty: Casualty, medId: string, now: number): Casualty =>
  touch({ ...casualty, meds: casualty.meds.filter((med) => med.id !== medId) }, now);

export const latestVitals = (casualty: Casualty): Vitals | undefined =>
  [...casualty.vitals].sort((a, b) => b.at - a.at)[0];

/** Hrubé skóre krvácení pro vizuální indikaci. */
export const bleedingScore = (casualty: Casualty): number =>
  casualty.injuries.reduce((score, injury) => {
    const weights: Record<Bleeding, [number, number]> = {
      massive: [10, 3],
      moderate: [4, 1],
      minor: [1, 0],
      none: [0, 0],
    };
    const [uncontrolled, controlled] = weights[injury.bleeding];
    return score + (injury.controlled ? controlled : uncontrolled);
  }, 0);

export const hasUncontrolledMassiveBleeding = (casualty: Casualty): boolean =>
  casualty.injuries.some((injury) => injury.bleeding === 'massive' && !injury.controlled);

export const isInShock = (casualty: Casualty): boolean => {
  const pulse = casualty.assessment.radialPulse;
  return pulse === 'weak' || pulse === 'absent';
};

/** Indikace TXA dle CoTCCC: předpokládaná masivní transfuze nebo hemoragický šok. Podává zdravotník. */
export const txaIndicated = (casualty: Casualty): boolean =>
  isInShock(casualty) ||
  casualty.injuries.some((injury) => injury.bleeding === 'massive') ||
  casualty.injuries.some((injury) => injury.kind === 'amputation');

const isTorsoPenetrating = (injury: Injury): boolean => {
  const type = findZone(injury.zoneId)?.type;
  const penetrating = injury.kind === 'gsw' || injury.kind === 'fragment';
  return penetrating && (type === 'thoracic' || type === 'abdominal' || type === 'back' || type === 'junctional' || type === 'neck');
};

export const suggestPrecedence = (casualty: Casualty): Precedence => {
  const { assessment } = casualty;
  const avpu = assessment.avpu ?? latestVitals(casualty)?.avpu;
  const airwayOrBreathing =
    assessment.airway === 'compromised' ||
    assessment.airway === 'managed' ||
    assessment.chest === 'tension_suspected' ||
    assessment.chest === 'open_wound';
  if (airwayOrBreathing || isInShock(casualty) || avpu === 'P' || avpu === 'U') return 'A';
  if (casualty.tourniquets.length > 0 || casualty.injuries.some((i) => i.bleeding === 'massive' || isTorsoPenetrating(i))) {
    return 'B';
  }
  if (casualty.injuries.some((i) => i.bleeding === 'moderate' || i.kind === 'fracture' || i.kind === 'burn' || i.kind === 'eye')) {
    return 'C';
  }
  return 'D';
};

export const suggestPatientType = (casualty: Casualty): 'L' | 'A' => {
  const avpu = casualty.assessment.avpu ?? latestVitals(casualty)?.avpu;
  const legInjury = casualty.injuries.some((injury) => {
    const limb = findZone(injury.zoneId)?.limb;
    return (limb === 'RL' || limb === 'LL') && (injury.kind === 'fracture' || injury.kind === 'amputation' || injury.bleeding !== 'none');
  });
  const legTq = casualty.tourniquets.some((tq) => tq.limb === 'RL' || tq.limb === 'LL');
  const torso = casualty.injuries.some(isTorsoPenetrating);
  const unstable = isInShock(casualty) || (avpu !== undefined && avpu !== 'A') || casualty.assessment.chest !== undefined && casualty.assessment.chest !== 'normal';
  return legInjury || legTq || torso || unstable ? 'L' : 'A';
};

export const effectivePrecedence = (casualty: Casualty): Precedence => casualty.evac.precedence ?? suggestPrecedence(casualty);

export const effectivePatientType = (casualty: Casualty): 'L' | 'A' => casualty.evac.patientType ?? suggestPatientType(casualty);
