// Generování hlášení 9-Line MEDEVAC, MIST a podkladů pro DD Form 1380.

import { effectivePatientType, effectivePrecedence, latestVitals } from './casualty';
import { AVPU_LABEL, BLEEDING_LABEL, INJURY_SHORT, INTERVENTION_LABEL, MECHANISM_LABEL } from './labels';
import { LIMB_LABEL, findZone, zoneLabel } from './zones';
import type { Casualty, EvacInfo, InterventionKind, Limb, Precedence } from './types';

const PHONETIC: Record<string, string> = {
  A: 'ALFA',
  B: 'BRAVO',
  C: 'CHARLIE',
  D: 'DELTA',
  E: 'ECHO',
  F: 'FOXTROT',
  L: 'LIMA',
  N: 'NOVEMBER',
  P: 'PAPA',
  X: 'X-RAY',
};

export const PRECEDENCE_LABEL: Record<Precedence, string> = {
  A: 'Naléhavý (do 90 min)',
  B: 'Naléhavý chirurgický (do 90 min)',
  C: 'Prioritní (do 4 h)',
  D: 'Rutinní (do 24 h)',
  E: 'Dle možností',
};

export const EQUIPMENT_LABEL: Record<EvacInfo['equipment'][number], string> = {
  A: 'Nic',
  B: 'Naviják',
  C: 'Vyprošťovací technika',
  D: 'Ventilátor',
};

export const SECURITY_LABEL: Record<EvacInfo['security'], string> = {
  N: 'Bez nepřítele',
  P: 'Možný nepřítel',
  E: 'Nepřítel v prostoru – opatrně',
  X: 'Nepřítel – nutný ozbrojený doprovod',
};

export const MARKING_LABEL: Record<EvacInfo['marking'], string> = {
  A: 'Panely',
  B: 'Pyrotechnika',
  C: 'Dýmovnice',
  D: 'Bez značení',
  E: 'Jiné',
};

export const NATIONALITY_LABEL: Record<EvacInfo['nationality'], string> = {
  A: 'Vlastní / koaliční voják',
  B: 'Civilista s koaličními silami',
  C: 'Nekoaliční bezpečnostní síly',
  D: 'Nekoaliční civilista',
  E: 'Protivník / zadržený',
  F: 'Dítě',
};

export const CBRN_LABEL: Record<EvacInfo['cbrn'], string> = {
  '-': 'Bez kontaminace',
  N: 'Jaderná',
  B: 'Biologická',
  C: 'Chemická',
};

export const formatTime = (ts: number): string => {
  const date = new Date(ts);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

export const formatDate = (ts: number): string => {
  const date = new Date(ts);
  return `${date.getDate()}. ${date.getMonth() + 1}. ${date.getFullYear()}`;
};

export const formatDuration = (ms: number): string => {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}:${String(minutes).padStart(2, '0')}`;
};

const countBy = <K extends string>(keys: K[]): Array<[K, number]> => {
  const counts = new Map<K, number>();
  keys.forEach((key) => counts.set(key, (counts.get(key) ?? 0) + 1));
  return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b));
};

const formatCounts = (counts: Array<[string, number]>): string => counts.map(([code, n]) => `${n}${code}`).join(' ');

const phoneticCounts = (counts: Array<[string, number]>): string =>
  counts.map(([code, n]) => `${n} ${PHONETIC[code] ?? code}`).join(', ');

export type NineLine = {
  line: number;
  label: string;
  value: string;
  radio: string;
};

export const buildNineLine = (casualties: Casualty[], evac: EvacInfo): NineLine[] => {
  const precedence = countBy(casualties.map(effectivePrecedence));
  const patientType = countBy(casualties.map(effectivePatientType));
  const nationality = countBy(casualties.map((casualty) => casualty.evac.nationality));
  const equipment = evac.equipment.length > 0 ? evac.equipment : ['A' as const];

  return [
    { line: 1, label: 'Místo vyzvednutí (MGRS)', value: evac.location || '—', radio: evac.location || '—' },
    {
      line: 2,
      label: 'Frekvence a volací znak',
      value: [evac.frequency, evac.callsign].filter(Boolean).join(' / ') || '—',
      radio: [evac.frequency, evac.callsign].filter(Boolean).join(' / ') || '—',
    },
    { line: 3, label: 'Počet dle naléhavosti', value: formatCounts(precedence), radio: phoneticCounts(precedence) },
    {
      line: 4,
      label: 'Speciální vybavení',
      value: equipment.join(' '),
      radio: equipment.map((code) => PHONETIC[code]).join(', '),
    },
    { line: 5, label: 'Počet dle typu (L = nosítka, A = chodící)', value: formatCounts(patientType), radio: phoneticCounts(patientType) },
    { line: 6, label: 'Bezpečnost místa vyzvednutí', value: evac.security, radio: PHONETIC[evac.security] ?? evac.security },
    { line: 7, label: 'Způsob označení', value: evac.marking, radio: PHONETIC[evac.marking] ?? evac.marking },
    { line: 8, label: 'Status / národnost', value: formatCounts(nationality), radio: phoneticCounts(nationality) },
    {
      line: 9,
      label: 'CBRN kontaminace',
      value: evac.cbrn === '-' ? 'Žádná' : evac.cbrn,
      radio: evac.cbrn === '-' ? 'NEGATIVE' : PHONETIC[evac.cbrn] ?? evac.cbrn,
    },
  ];
};

export const nineLineText = (lines: NineLine[]): string =>
  [
    '9-LINE MEDEVAC',
    ...lines.flatMap((line) => {
      const text = `L${line.line}: ${line.radio}`;
      return line.line === 5 ? [text, '-- konec povinné části (L1–5 do 25 s) --'] : [text];
    }),
  ].join('\n');

export type Mist = { m: string; i: string; s: string; t: string };

const radialPulseText: Record<NonNullable<Casualty['assessment']['radialPulse']>, string> = {
  strong: 'radiální pulz hmatný',
  weak: 'radiální pulz slabý',
  absent: 'radiální pulz nehmatný',
};

const signsText = (casualty: Casualty): string => {
  const vitals = latestVitals(casualty);
  const parts: string[] = [];
  const avpu = vitals?.avpu ?? casualty.assessment.avpu;
  if (avpu) parts.push(AVPU_LABEL[avpu]);
  if (vitals?.pulse !== undefined) parts.push(`TF ${vitals.pulse}/min (${vitals.pulseSite === 'radial' ? 'rad.' : vitals.pulseSite === 'carotid' ? 'karot.' : 'fem.'})`);
  else if (casualty.assessment.radialPulse) parts.push(radialPulseText[casualty.assessment.radialPulse]);
  if (vitals?.rr !== undefined) parts.push(`DF ${vitals.rr}/min`);
  if (vitals?.spo2 !== undefined) parts.push(`SpO2 ${vitals.spo2} %`);
  if (vitals?.bpSys !== undefined) parts.push(`TK ${vitals.bpSys}/${vitals.bpDia ?? '?'}`);
  if (vitals?.pain !== undefined) parts.push(`bolest ${vitals.pain}/10`);
  if (vitals) parts.push(`(${formatTime(vitals.at)})`);
  return parts.join(', ') || 'neměřeno';
};

const REPORTED_INTERVENTIONS: ReadonlySet<InterventionKind> = new Set<InterventionKind>([
  'tq_hasty',
  'tq_deliberate',
  'wound_packing',
  'pressure_dressing',
  'dressing',
  'burn_dressing',
  'jaw_thrust',
  'npa',
  'recovery_position',
  'chest_seal',
  'ndc',
  'txa',
  'hypothermia',
  'eye_shield',
  'splint',
  'pill_pack',
  'tq_converted',
]);

const interventionPlace = (zoneId: string | undefined, detail: string | undefined): string =>
  [zoneId ? zoneLabel(zoneId) : undefined, detail].filter(Boolean).join(', ');

export const treatmentLines = (casualty: Casualty): string[] => {
  const interventions = casualty.interventions
    .filter((item) => REPORTED_INTERVENTIONS.has(item.kind))
    .map((item) => {
      const tq = casualty.tourniquets.find((t) => t.id === item.tourniquetId);
      const place = tq && !item.zoneId ? LIMB_LABEL[tq.limb] : interventionPlace(item.zoneId, item.detail);
      return { at: item.at, text: `${INTERVENTION_LABEL[item.kind]}${place ? ` – ${place}` : ''}` };
    });
  const meds = casualty.meds.map((med) => ({ at: med.at, text: `${med.name} ${med.dose} ${med.route}` }));
  return [...interventions, ...meds].sort((a, b) => a.at - b.at).map((item) => `${formatTime(item.at)} ${item.text}`);
};

export const buildMist = (casualty: Casualty): Mist => {
  const mechanisms = casualty.mechanisms.map((m) => MECHANISM_LABEL[m]).join(', ') || 'neurčeno';
  const injuries = casualty.injuries
    .map((injury) => {
      const bleeding = injury.bleeding === 'none' ? '' : `, krvácení ${BLEEDING_LABEL[injury.bleeding].split(' ')[0]?.toLowerCase()}${injury.controlled ? ' – zastaveno' : ' – NEZASTAVENO'}`;
      return `${INJURY_SHORT[injury.kind]} ${zoneLabel(injury.zoneId)}${bleeding}`;
    })
    .join('; ');
  return {
    m: `${mechanisms}, čas zranění ${formatTime(casualty.injuryAt)}`,
    i: injuries || 'bez zjištěných zranění',
    s: signsText(casualty),
    t: treatmentLines(casualty).join('; ') || 'bez zásahů',
  };
};

export const mistText = (casualty: Casualty): string => {
  const mist = buildMist(casualty);
  const id = [casualty.identity.battleRoster, casualty.identity.name].filter(Boolean).join(' ');
  return [`MIST – ${id}`, `M: ${mist.m}`, `I: ${mist.i}`, `S: ${mist.s}`, `T: ${mist.t}`].join('\n');
};

export type DdTourniquetRow = { limb: Limb; type: string; time: string };

export type Dd1380 = {
  evacCategory: 'Naléhavý' | 'Prioritní' | 'Rutinní';
  tourniquets: DdTourniquetRow[];
  circulation: { extremityTq: boolean; hemostatic: boolean; pressure: boolean; other: boolean };
  airway: { intact: boolean; npa: boolean };
  breathing: { needleD: boolean; chestSeal: boolean };
  other: { pillPack: boolean; eyeShieldRight: boolean; eyeShieldLeft: boolean; splint: boolean; hypothermia: boolean };
};

const has = (casualty: Casualty, kind: InterventionKind): boolean => casualty.interventions.some((item) => item.kind === kind);

const eyeShieldOn = (casualty: Casualty, side: 'right' | 'left'): boolean =>
  casualty.interventions.some((item) => item.kind === 'eye_shield' && (item.detail ?? '').includes(side === 'right' ? 'pravé' : 'levé'));

export const buildDd1380 = (casualty: Casualty): Dd1380 => {
  const precedence = effectivePrecedence(casualty);
  return {
    evacCategory: precedence === 'A' || precedence === 'B' ? 'Naléhavý' : precedence === 'C' ? 'Prioritní' : 'Rutinní',
    tourniquets: casualty.tourniquets.map((tq) => ({
      limb: tq.limb,
      type: tq.convertedAt ? 'konvertován' : tq.removedAt ? 'nahrazen' : tq.type === 'hasty' ? 'rychlý' : 'cílený',
      time: formatTime(tq.appliedAt),
    })),
    circulation: {
      extremityTq: casualty.tourniquets.length > 0,
      hemostatic: has(casualty, 'wound_packing'),
      pressure: has(casualty, 'pressure_dressing'),
      other: has(casualty, 'dressing') || has(casualty, 'burn_dressing'),
    },
    airway: {
      intact: casualty.assessment.airway === 'patent',
      npa: has(casualty, 'npa'),
    },
    breathing: { needleD: has(casualty, 'ndc'), chestSeal: has(casualty, 'chest_seal') },
    other: {
      pillPack: has(casualty, 'pill_pack'),
      eyeShieldRight: eyeShieldOn(casualty, 'right'),
      eyeShieldLeft: eyeShieldOn(casualty, 'left'),
      splint: has(casualty, 'splint'),
      hypothermia: has(casualty, 'hypothermia'),
    },
  };
};

export const zoneViewOf = (zoneId: string): 'front' | 'back' => findZone(zoneId)?.view ?? 'front';
