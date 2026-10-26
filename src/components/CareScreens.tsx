// Obrazovky fáze určení situace a Care Under Fire.

import { addIntervention, activeTourniquets } from '../model/casualty';
import { LIMB_LABEL } from '../model/zones';
import type { Casualty, Limb } from '../model/types';
import type { FsmEvent } from '../model/fsm';
import type { Act } from './ZoneSheet';
import { Button } from './ui';

export const PhaseQuery = ({ send }: { send: (event: FsmEvent) => void }) => (
  <div className="phase-query">
    <h2 className="huge">Jste pod přímou palbou?</h2>
    <Button tone="danger" big onClick={() => send({ type: 'UNDER_FIRE' })}>
      ANO – POD PALBOU
    </Button>
    <Button tone="ok" big onClick={() => send({ type: 'IN_COVER' })}>
      NE – JSEM V KRYTU
    </Button>
  </div>
);

const LIMBS: Limb[] = ['RA', 'LA', 'RL', 'LL'];

export const CufExecutor = ({
  casualty,
  act,
  send,
}: {
  casualty: Casualty;
  act: Act;
  send: (event: FsmEvent) => void;
}) => {
  const applied = new Set(activeTourniquets(casualty).map((tq) => tq.limb));
  return (
    <div className="cuf">
      <div className="cuf-banner">
        <strong>PÉČE POD PALBOU</strong>
        <span>Palebná převaha · kryj se · nezraň se</span>
      </div>
      <p className="cuf-hint">Život ohrožující krvácení z končetiny → RYCHLÝ TQ co nejvýše přes oděv, pevně utáhnout. Dýchací cesty teď neřeš.</p>
      <h3>Rychlý TQ – končetina</h3>
      <div className="grid-2 cuf-limbs">
        {LIMBS.map((limb) => (
          <Button
            key={limb}
            tone="danger"
            big
            onClick={() => act((c, t) => addIntervention(c, 'tq_hasty', t, { limb }))}
          >
            {LIMB_LABEL[limb]}
            {applied.has(limb) ? ' ✓' : ''}
          </Button>
        ))}
      </div>
      <Button tone="ok" big onClick={() => send({ type: 'IN_COVER' })}>
        V KRYTU → TAKTICKÁ PÉČE (TFC)
      </Button>
    </div>
  );
};
