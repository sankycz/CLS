import { useState } from 'react';
import { activeTourniquets } from '../model/casualty';
import { ZONES, findZone, type Shape, type Zone } from '../model/zones';
import type { Casualty, Injury, ZoneType } from '../model/types';
import { haptic } from '../hooks/haptic';

type Severity = 'critical' | 'moderate' | 'minor' | 'other' | 'controlled';

const SEVERITY_ORDER: Severity[] = ['critical', 'moderate', 'minor', 'other', 'controlled'];

const injurySeverity = (injury: Injury): Severity => {
  if (injury.bleeding === 'none') return 'other';
  if (injury.controlled) return 'controlled';
  return injury.bleeding === 'massive' ? 'critical' : injury.bleeding;
};

const zoneSeverity = (injuries: Injury[]): Severity | undefined =>
  injuries
    .map(injurySeverity)
    .sort((a, b) => SEVERITY_ORDER.indexOf(a) - SEVERITY_ORDER.indexOf(b))[0];

const ShapeEl = ({ shape, className }: { shape: Shape; className: string }) =>
  shape.kind === 'rect' ? (
    <rect className={className} x={shape.x} y={shape.y} width={shape.w} height={shape.h} rx={shape.r} />
  ) : (
    <ellipse className={className} cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} />
  );

const centerOf = (shape: Shape): { x: number; y: number } =>
  shape.kind === 'rect' ? { x: shape.x + shape.w / 2, y: shape.y + shape.h / 2 } : { x: shape.cx, y: shape.cy };

/** Turniket kreslíme jako pásek v horní části zóny, kde byl přiložen (výchozí: proximální část končetiny). */
const PROXIMAL_ZONE: Record<string, string> = { RA: 'arm_upper_right', LA: 'arm_upper_left', RL: 'thigh_right_prox', LL: 'thigh_left_prox' };

export const BodyMap = ({
  casualty,
  onSelect,
  highlight,
  selectedId,
}: {
  casualty: Casualty;
  onSelect: (zoneId: string) => void;
  highlight?: ZoneType[];
  selectedId?: string;
}) => {
  const [view, setView] = useState<'front' | 'back'>('front');
  const zones = ZONES.filter((zone) => zone.view === view);

  const tqBands = activeTourniquets(casualty)
    .map((tq) => {
      const base = findZone(tq.zoneId) ?? findZone(PROXIMAL_ZONE[tq.limb]);
      if (!base || base.type !== 'extremity') return undefined;
      const zoneId = base.view === view ? base.id : view === 'back' ? `${base.id}_post` : base.id.replace(/_post$/, '');
      const zone = findZone(zoneId);
      return zone && zone.shape.kind === 'rect' ? { tq, shape: zone.shape } : undefined;
    })
    .filter((band) => band !== undefined);

  const renderZone = (zone: Zone) => {
    const injuries = casualty.injuries.filter((injury) => injury.zoneId === zone.id);
    const severity = zoneSeverity(injuries);
    const dimmed = highlight && !highlight.includes(zone.type);
    const classes = [
      'zone',
      severity ? `sev-${severity}` : '',
      dimmed ? 'zone-dim' : '',
      selectedId === zone.id ? 'zone-selected' : '',
    ].join(' ');
    const center = centerOf(zone.shape);
    return (
      <g
        key={zone.id}
        role="button"
        tabIndex={0}
        aria-label={`${zone.label}${injuries.length ? `, zranění: ${injuries.length}` : ''}`}
        onClick={() => {
          haptic();
          onSelect(zone.id);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') onSelect(zone.id);
        }}
      >
        <ShapeEl shape={zone.shape} className={classes} />
        {injuries.length > 0 && (
          <g className="zone-badge" pointerEvents="none">
            <circle cx={center.x} cy={center.y} r={7} />
            <text x={center.x} y={center.y + 3.5} textAnchor="middle">
              {injuries.length}
            </text>
          </g>
        )}
      </g>
    );
  };

  return (
    <div className="bodymap">
      <div className="bodymap-toggle" role="tablist">
        {(['front', 'back'] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={view === option}
            className="btn"
            onClick={() => {
              haptic();
              setView(option);
            }}
          >
            {option === 'front' ? 'Zepředu' : 'Zezadu'}
          </button>
        ))}
      </div>
      <svg viewBox="0 0 200 420" className="bodymap-svg" aria-label={`Mapa těla ${view === 'front' ? 'zepředu' : 'zezadu'}`}>
        <text className="bodymap-side" x={8} y={20}>
          {view === 'front' ? 'P' : 'L'}
        </text>
        <text className="bodymap-side" x={184} y={20}>
          {view === 'front' ? 'L' : 'P'}
        </text>
        {zones.map(renderZone)}
        {tqBands.map(({ tq, shape }) => (
          <g key={tq.id} pointerEvents="none" className={`tq-band tq-${tq.type}`}>
            <rect x={shape.x - 3} y={shape.y + 4} width={shape.w + 6} height={7} rx={2} />
            <text x={shape.x + shape.w / 2} y={shape.y + 10} textAnchor="middle">
              TQ
            </text>
          </g>
        ))}
      </svg>
      <div className="legend">
        <span className="lg lg-critical">nezastavené masivní</span>
        <span className="lg lg-moderate">střední</span>
        <span className="lg lg-minor">mírné</span>
        <span className="lg lg-controlled">zastaveno</span>
        <span className="lg lg-other">bez krvácení</span>
      </div>
    </div>
  );
};

/** Seznam zón jako záložní ovládání pro malé oblasti (podpaží, tříslo) v rukavicích. */
export const ZoneList = ({ onSelect, filter }: { onSelect: (zoneId: string) => void; filter?: ZoneType[] }) => (
  <details className="zone-list">
    <summary>Vybrat oblast ze seznamu</summary>
    <div className="zone-list-grid">
      {ZONES.filter((zone) => !filter || filter.includes(zone.type)).map((zone) => (
        <button key={zone.id} type="button" className="btn" onClick={() => onSelect(zone.id)}>
          {zone.label}
        </button>
      ))}
    </div>
  </details>
);
