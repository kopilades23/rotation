import { motion } from 'motion/react';
import { pct } from '../lib/utils';

export interface FlowStep { key: string; label: string; n: number; rate: number; open: number }

/** Le parcours des comptes : achetés → éval → buffer → payouts. Hauteur = nombre de comptes arrivés à l'étape. */
export function Flow({ steps }: { steps: FlowStep[] }) {
  const W = 1000, H = 190, n = steps.length;
  const max = Math.max(1, ...steps.map(s => s.n));
  const cell = W / n, bw = Math.min(64, cell * 0.36);
  const hOf = (v: number) => Math.max(3, (v / max) * (H - 8));
  const color = (k: string) => (k.startsWith('p') ? '#ecd49c' : k === 'buffer' ? '#2fd3bf' : '#8d7dff');
  return (
    <div className="flow"><div className="flow-in">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Parcours des comptes, de l'achat aux payouts">
        <defs>
          {steps.slice(0, -1).map((s, i) => (
            <linearGradient key={s.key} id={`fl-${i}`} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor={color(s.key)} stopOpacity=".3" />
              <stop offset="1" stopColor={color(steps[i + 1].key)} stopOpacity=".14" />
            </linearGradient>
          ))}
        </defs>
        <line x1="0" x2={W} y1={H - 0.5} y2={H - 0.5} stroke="rgba(255,255,255,.1)" />
        {steps.slice(0, -1).map((s, i) => {
          const x1 = (i + 0.5) * cell + bw / 2, x2 = (i + 1.5) * cell - bw / 2;
          const y1 = H - hOf(s.n), y2 = H - hOf(steps[i + 1].n);
          const mx = (x1 + x2) / 2;
          const d = `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2} L${x2},${H} L${x1},${H} Z`;
          return (
            <motion.path key={s.key} d={d} fill={`url(#fl-${i})`}
              initial={{ opacity: 0, clipPath: 'inset(0 100% 0 0)' }} animate={{ opacity: 1, clipPath: 'inset(0 0% 0 0)' }}
              transition={{ delay: 0.25 + i * 0.09, duration: 0.6, ease: [0.16, 1, 0.3, 1] }} />
          );
        })}
        {steps.map((s, i) => {
          const h = hOf(s.n), x = (i + 0.5) * cell - bw / 2;
          return (
            <motion.rect key={s.key} x={x} width={bw} rx={8} fill={color(s.key)} style={{ filter: `drop-shadow(0 0 14px ${color(s.key)}55)` }}
              initial={{ y: H, height: 0 }} animate={{ y: H - h, height: h }}
              transition={{ delay: i * 0.09, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}>
              <title>{`${s.label} : ${s.n}`}</title>
            </motion.rect>
          );
        })}
      </svg>
      <div className="flow-labels" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {steps.map((s, i) => (
          <motion.div key={s.key} className="flow-c" style={{ textAlign: 'center' }}
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.09 }}>
            <div className="flow-n num">{s.n}</div>
            <div className="flow-l">{s.label}</div>
            <div className="flow-r">
              {i === 0 ? <span>&nbsp;</span> : isFinite(s.rate) ? <><b>{pct(s.rate, 0)}</b> réussite</> : <span>—</span>}
            </div>
            {s.open > 0 && <div className="flow-r">{s.open} en cours</div>}
          </motion.div>
        ))}
      </div>
    </div></div>
  );
}
