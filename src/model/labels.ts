// České popisky číselníků a zkratky pro hlášení.

import type { Avpu, Bleeding, InjuryKind, InterventionKind, MarchStep, Mechanism, Phase } from './types';

export const INJURY_LABEL: Record<InjuryKind, string> = {
  gsw: 'Střelné poranění (GSW)',
  fragment: 'Střepina',
  amputation: 'Amputace',
  laceration: 'Tržná rána',
  burn: 'Popálenina',
  blunt: 'Tupé poranění',
  fracture: 'Zlomenina (podezření)',
  eye: 'Poranění oka',
};

export const INJURY_SHORT: Record<InjuryKind, string> = {
  gsw: 'GSW',
  fragment: 'FRAG',
  amputation: 'AMP',
  laceration: 'LAC',
  burn: 'BURN',
  blunt: 'BLUNT',
  fracture: 'FX',
  eye: 'EYE',
};

export const BLEEDING_LABEL: Record<Bleeding, string> = {
  massive: 'Masivní (pulzující / proudící)',
  moderate: 'Střední',
  minor: 'Mírné',
  none: 'Bez krvácení',
};

export const INTERVENTION_LABEL: Record<InterventionKind, string> = {
  tq_hasty: 'Hasty TQ',
  tq_deliberate: 'Deliberate TQ (5–7 cm nad ranou)',
  wound_packing: 'Wound packing (Combat Gauze)',
  pressure_dressing: 'Tlakový obvaz',
  direct_pressure: 'Přímý tlak',
  dressing: 'Krytí rány',
  burn_dressing: 'Popáleninové krytí',
  jaw_thrust: 'Jaw-thrust / Chin-lift',
  npa: 'NPA (nosní vzduchovod)',
  recovery_position: 'Zotavovací poloha',
  chest_seal: 'Ventilový chest seal',
  ndc: 'Jehelní dekomprese (NDC)',
  txa: 'TXA 2 g (zdravotník)',
  hypothermia: 'Prevence hypotermie',
  eye_shield: 'Rigid Eye Shield',
  splint: 'Dlaha (SAM Splint)',
  pill_pack: 'Combat Wound Medication Pack',
  moved_to_cover: 'Přesun do krytu',
  tq_reassessed: 'Reassessment TQ',
  tq_converted: 'Konverze TQ',
  override: 'Pokračováno přes upozornění',
};

export const MECHANISM_LABEL: Record<Mechanism, string> = {
  artillery: 'Dělostřelectvo',
  blunt: 'Tupý úder',
  burn: 'Popálení',
  fall: 'Pád',
  grenade: 'Granát',
  gsw: 'Střelné (GSW)',
  ied: 'IED',
  landmine: 'Mina',
  mvc: 'Dopravní nehoda (MVC)',
  rpg: 'RPG',
  other: 'Jiné',
};

export const AVPU_LABEL: Record<Avpu, string> = {
  A: 'A – bdělý',
  V: 'V – reaguje na hlas',
  P: 'P – reaguje na bolest',
  U: 'U – nereaguje',
};

export const PHASE_LABEL: Record<Phase, string> = {
  CUF: 'Care Under Fire',
  TFC: 'Tactical Field Care',
  TACEVAC: 'Tactical Evacuation',
};

export const STEP_LETTER: Record<MarchStep, string> = {
  MARCH_M: 'M',
  MARCH_A: 'A',
  MARCH_R: 'R',
  MARCH_C: 'C',
  MARCH_H: 'H',
  PAWS_P: 'P',
  PAWS_A: 'A',
  PAWS_W: 'W',
  PAWS_S: 'S',
};

export const STEP_TITLE: Record<MarchStep, string> = {
  MARCH_M: 'Masivní krvácení',
  MARCH_A: 'Dýchací cesty',
  MARCH_R: 'Dýchání a hrudník',
  MARCH_C: 'Cirkulace a šok',
  MARCH_H: 'Hlava a hypotermie',
  PAWS_P: 'Bolest',
  PAWS_A: 'Antibiotika',
  PAWS_W: 'Ošetření dalších ran',
  PAWS_S: 'Dlahování',
};
