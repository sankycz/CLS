// Anatomické zóny SVG mapy těla. Souřadnice ve viewBoxu 0 0 200 420.
// Přední pohled: pravá strana zraněného je vlevo na displeji. Zadní pohled: pravá strana vpravo.

import type { InterventionKind, Limb, ZoneType } from './types';

export type Shape =
  | { kind: 'rect'; x: number; y: number; w: number; h: number; r: number }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number };

export type Zone = {
  id: string;
  label: string;
  view: 'front' | 'back';
  type: ZoneType;
  shape: Shape;
  limb?: Limb;
  /** Místo pro jehelní dekompresi hrudníku. */
  ndcSite?: string;
};

const rect = (x: number, y: number, w: number, h: number, r = 6): Shape => ({ kind: 'rect', x, y, w, h, r });

const mirror = (shape: Shape): Shape =>
  shape.kind === 'rect' ? { ...shape, x: 200 - shape.x - shape.w } : { ...shape, cx: 200 - shape.cx };

type LimbPart = { key: string; label: string; shape: Shape; limb: Limb };

// Končetiny pravé strany zraněného v předním pohledu.
const RIGHT_LIMB_PARTS: LimbPart[] = [
  { key: 'arm_upper_right', label: 'Pravá paže', shape: rect(36, 76, 22, 70, 10), limb: 'RA' },
  { key: 'forearm_right', label: 'Pravé předloktí', shape: rect(32, 148, 24, 64, 10), limb: 'RA' },
  { key: 'hand_right', label: 'Pravá ruka', shape: rect(30, 214, 24, 26, 8), limb: 'RA' },
  { key: 'thigh_right_prox', label: 'Pravé stehno proximálně', shape: rect(68, 220, 31, 48, 8), limb: 'RL' },
  { key: 'thigh_right_dist', label: 'Pravé stehno distálně', shape: rect(70, 270, 28, 42, 8), limb: 'RL' },
  { key: 'leg_right', label: 'Pravé koleno a bérec', shape: rect(72, 314, 24, 78, 9), limb: 'RL' },
  { key: 'foot_right', label: 'Pravé chodidlo', shape: rect(68, 394, 30, 18, 7), limb: 'RL' },
];

const toLeft = (part: LimbPart): LimbPart => ({
  key: part.key.replace('right', 'left'),
  label: part.label.replace('Pravá', 'Levá').replace('Pravé', 'Levé'),
  shape: mirror(part.shape),
  limb: part.limb === 'RA' ? 'LA' : 'LL',
});

const LIMB_PARTS: LimbPart[] = [...RIGHT_LIMB_PARTS, ...RIGHT_LIMB_PARTS.map(toLeft)];

const frontLimbs: Zone[] = LIMB_PARTS.map((part) => ({
  id: part.key,
  label: part.label,
  view: 'front',
  type: 'extremity',
  shape: part.shape,
  limb: part.limb,
}));

const backLimbs: Zone[] = LIMB_PARTS.map((part) => ({
  id: `${part.key}_post`,
  label: `${part.label} (zezadu)`,
  view: 'back',
  type: 'extremity',
  shape: mirror(part.shape),
  limb: part.limb,
}));

const FRONT_TRUNK: Zone[] = [
  { id: 'head_cranium', label: 'Hlava a obličej', view: 'front', type: 'head', shape: { kind: 'ellipse', cx: 100, cy: 32, rx: 21, ry: 26 } },
  { id: 'neck_junctional', label: 'Krk', view: 'front', type: 'neck', shape: rect(89, 58, 22, 17, 4) },
  {
    id: 'chest_upper_right',
    label: 'Hrudník vpravo nahoře',
    view: 'front',
    type: 'thoracic',
    shape: rect(66, 76, 34, 42),
    ndcSite: '2. mezižebří vpravo, medioklavikulární čára',
  },
  {
    id: 'chest_upper_left',
    label: 'Hrudník vlevo nahoře',
    view: 'front',
    type: 'thoracic',
    shape: rect(100, 76, 34, 42),
    ndcSite: '2. mezižebří vlevo, medioklavikulární čára',
  },
  {
    id: 'chest_lower_right',
    label: 'Hrudník vpravo dole / bok',
    view: 'front',
    type: 'thoracic',
    shape: rect(66, 118, 34, 32),
    ndcSite: '5. mezižebří vpravo, přední axilární čára',
  },
  {
    id: 'chest_lower_left',
    label: 'Hrudník vlevo dole / bok',
    view: 'front',
    type: 'thoracic',
    shape: rect(100, 118, 34, 32),
    ndcSite: '5. mezižebří vlevo, přední axilární čára',
  },
  { id: 'axilla_right', label: 'Pravé podpaží', view: 'front', type: 'junctional', shape: rect(58, 80, 9, 26, 3), limb: 'RA' },
  { id: 'axilla_left', label: 'Levé podpaží', view: 'front', type: 'junctional', shape: rect(133, 80, 9, 26, 3), limb: 'LA' },
  { id: 'abdomen', label: 'Břicho', view: 'front', type: 'abdominal', shape: rect(68, 150, 64, 46) },
  { id: 'groin_right', label: 'Pravé tříslo', view: 'front', type: 'junctional', shape: rect(68, 196, 32, 23), limb: 'RL' },
  { id: 'groin_left', label: 'Levé tříslo', view: 'front', type: 'junctional', shape: rect(100, 196, 32, 23), limb: 'LL' },
];

const BACK_TRUNK: Zone[] = [
  { id: 'head_back', label: 'Týl', view: 'back', type: 'head', shape: { kind: 'ellipse', cx: 100, cy: 32, rx: 21, ry: 26 } },
  { id: 'neck_back', label: 'Zadní strana krku', view: 'back', type: 'neck', shape: rect(89, 58, 22, 17, 4) },
  { id: 'back_upper_left', label: 'Záda vlevo nahoře', view: 'back', type: 'thoracic', shape: rect(66, 76, 34, 52) },
  { id: 'back_upper_right', label: 'Záda vpravo nahoře', view: 'back', type: 'thoracic', shape: rect(100, 76, 34, 52) },
  { id: 'back_lower', label: 'Bedra', view: 'back', type: 'back', shape: rect(66, 128, 68, 54) },
  { id: 'buttock_left', label: 'Levá hýždě', view: 'back', type: 'junctional', shape: rect(68, 182, 32, 37), limb: 'LL' },
  { id: 'buttock_right', label: 'Pravá hýždě', view: 'back', type: 'junctional', shape: rect(100, 182, 32, 37), limb: 'RL' },
];

export const ZONES: Zone[] = [...FRONT_TRUNK, ...frontLimbs, ...BACK_TRUNK, ...backLimbs];

const ZONE_BY_ID = new Map(ZONES.map((zone) => [zone.id, zone]));

export const findZone = (id: string | undefined): Zone | undefined => (id ? ZONE_BY_ID.get(id) : undefined);

export const zoneLabel = (id: string | undefined): string => findZone(id)?.label ?? 'Neurčeno';

export const ZONE_TYPE_LABEL: Record<ZoneType, string> = {
  head: 'Hlava – nestlačitelná oblast',
  neck: 'Krk – junkční oblast',
  thoracic: 'Hrudník',
  abdominal: 'Břicho – nestlačitelná oblast',
  junctional: 'Junkční oblast',
  extremity: 'Končetina',
  back: 'Trup zezadu – nestlačitelná oblast',
};

const ZONE_INTERVENTIONS: Record<ZoneType, InterventionKind[]> = {
  head: ['pressure_dressing', 'dressing', 'eye_shield', 'burn_dressing'],
  neck: ['direct_pressure', 'wound_packing', 'pressure_dressing', 'dressing'],
  thoracic: ['chest_seal', 'ndc', 'dressing', 'burn_dressing'],
  abdominal: ['dressing', 'pressure_dressing', 'burn_dressing'],
  junctional: ['direct_pressure', 'wound_packing', 'pressure_dressing', 'dressing'],
  extremity: ['tq_deliberate', 'tq_hasty', 'wound_packing', 'pressure_dressing', 'dressing', 'splint', 'burn_dressing'],
  back: ['dressing', 'pressure_dressing', 'burn_dressing'],
};

export const interventionsForZone = (zone: Zone): InterventionKind[] =>
  ZONE_INTERVENTIONS[zone.type].filter((kind) => kind !== 'ndc' || zone.ndcSite !== undefined);

export const LIMB_LABEL: Record<Limb, string> = {
  RA: 'Pravá ruka',
  LA: 'Levá ruka',
  RL: 'Pravá noha',
  LL: 'Levá noha',
};
