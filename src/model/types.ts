// Datové modely zraněného, zranění, zásahů a hlášení.

export type Phase = 'CUF' | 'TFC' | 'TACEVAC';

export type MarchStep =
  | 'MARCH_M'
  | 'MARCH_A'
  | 'MARCH_R'
  | 'MARCH_C'
  | 'MARCH_H'
  | 'PAWS_P'
  | 'PAWS_A'
  | 'PAWS_W'
  | 'PAWS_S';

export type FsmState = 'PHASE_QUERY' | 'CUF_EXECUTOR' | MarchStep | 'REPORT_GEN' | 'TACEVAC';

export type Limb = 'RA' | 'LA' | 'RL' | 'LL';

export type ZoneType = 'head' | 'neck' | 'thoracic' | 'abdominal' | 'junctional' | 'extremity' | 'back';

export type InjuryKind =
  | 'gsw'
  | 'fragment'
  | 'amputation'
  | 'laceration'
  | 'burn'
  | 'blunt'
  | 'fracture'
  | 'eye';

export type Bleeding = 'massive' | 'moderate' | 'minor' | 'none';

export type Avpu = 'A' | 'V' | 'P' | 'U';

export type InterventionKind =
  | 'tq_hasty'
  | 'tq_deliberate'
  | 'wound_packing'
  | 'pressure_dressing'
  | 'direct_pressure'
  | 'dressing'
  | 'burn_dressing'
  | 'jaw_thrust'
  | 'npa'
  | 'recovery_position'
  | 'chest_seal'
  | 'ndc'
  | 'txa'
  | 'hypothermia'
  | 'eye_shield'
  | 'splint'
  | 'pill_pack'
  | 'moved_to_cover'
  | 'tq_reassessed'
  | 'tq_converted'
  | 'override';

export type Injury = {
  id: string;
  zoneId: string;
  kind: InjuryKind;
  bleeding: Bleeding;
  controlled: boolean;
  at: number;
};

export type Intervention = {
  id: string;
  at: number;
  kind: InterventionKind;
  phase: Phase;
  zoneId?: string;
  detail?: string;
  /** Odkaz na související turniket. */
  tourniquetId?: string;
};

export type Tourniquet = {
  id: string;
  limb: Limb;
  type: 'hasty' | 'deliberate';
  appliedAt: number;
  zoneId?: string;
  reassessedAt?: number;
  convertedAt?: number;
  removedAt?: number;
};

export type Vitals = {
  id: string;
  at: number;
  pulse?: number;
  pulseSite: 'radial' | 'carotid' | 'femoral';
  rr?: number;
  spo2?: number;
  bpSys?: number;
  bpDia?: number;
  avpu?: Avpu;
  pain?: number;
};

export type Medication = {
  id: string;
  at: number;
  name: string;
  dose: string;
  route: 'PO' | 'IV' | 'IO' | 'IM';
  category: 'analgesic' | 'antibiotic' | 'txa' | 'other';
};

export type Mechanism =
  | 'artillery'
  | 'blunt'
  | 'burn'
  | 'fall'
  | 'grenade'
  | 'gsw'
  | 'ied'
  | 'landmine'
  | 'mvc'
  | 'rpg'
  | 'other';

/** Odpovědi na kontrolní otázky jednotlivých kroků MARCH PAWS. */
export type Assessment = {
  bloodSweep?: boolean;
  airway?: 'patent' | 'compromised' | 'managed';
  avpu?: Avpu;
  chest?: 'normal' | 'open_wound' | 'tension_suspected';
  radialPulse?: 'strong' | 'weak' | 'absent';
  headInjury?: 'none' | 'suspected';
  hypothermia?: 'done' | 'not_possible';
  pain?: 'none' | 'given' | 'not_possible';
  antibiotics?: 'given' | 'not_indicated' | 'not_possible';
  wounds?: 'done' | 'none';
  splint?: 'done' | 'none';
};

export type Precedence = 'A' | 'B' | 'C' | 'D' | 'E';
export type Nationality = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

export type EvacInfo = {
  location: string;
  frequency: string;
  callsign: string;
  precedence?: Precedence;
  equipment: Array<'A' | 'B' | 'C' | 'D'>;
  patientType?: 'L' | 'A';
  security: 'N' | 'P' | 'E' | 'X';
  marking: 'A' | 'B' | 'C' | 'D' | 'E';
  nationality: Nationality;
  cbrn: 'N' | 'B' | 'C' | '-';
};

export type Identity = {
  battleRoster: string;
  name: string;
  last4: string;
  unit: string;
  sex: 'M' | 'F' | '';
  allergies: string;
};

export type FsmData = {
  state: FsmState;
  completed: MarchStep[];
};

export type Casualty = {
  id: string;
  createdAt: number;
  updatedAt: number;
  injuryAt: number;
  phase: Phase;
  identity: Identity;
  mechanisms: Mechanism[];
  injuries: Injury[];
  interventions: Intervention[];
  tourniquets: Tourniquet[];
  vitals: Vitals[];
  meds: Medication[];
  assessment: Assessment;
  fsm: FsmData;
  evac: EvacInfo;
  notes: string;
  firstResponder: string;
  closedAt?: number;
};
