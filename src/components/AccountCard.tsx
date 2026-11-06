import { forwardRef } from 'react';
import { motion } from 'motion/react';
import { Minus, Plus, Pencil, RotateCcw, Skull, ArrowRight, Banknote, CloudRain } from 'lucide-react';
import type { Account } from '../lib/types';
import { useActions, useUi } from '../lib/hooks';
import { Button, StageTag } from './ui';
import { daysBetween, fmtD, money, today, tone } from '../lib/utils';

export function Pipeline({ a }: { a: Account }) {
  const { E } = useUi();
  const mp = E.maxP(a), L = E.level(a), hasBuf = E.firm(a.firm_id).has_buffer;
  const steps = Array.from({ length: 2 + mp }, (_, i) => i).filter(i => i !== 1 || hasBuf);
  return (
    <div>
      <div className="pipe">
        {steps.map(i => {
          let c = '';
          if (i < L) c = 'done';
          if (i === L && a.status === 'active') c = 'cur';
          if (i === L && a.status === 'dead') c = 'died';
          if (a.status === 'completed') c = 'fin';
          return <span key={i} className={c} />;
        })}
      </div>
      <div className="pipe-l">{steps.map(i => <span key={i}>{i === 0 ? 'Éval' : i === 1 ? 'Buf' : 'P' + (i - 1)}</span>)}</div>
    </div>
  );
}

export const AccountCard = forwardRef<HTMLDivElement, { a: Account; mini?: boolean }>(function AccountCard({ a, mini }, ref) {
  const { E, open } = useUi();
  const act = useActions();
  const f = E.firm(a.firm_id);
  const cost = E.costOf(a), pays = E.payoutsOf(a), paid = E.paidOf(a), net = paid - cost;
  const age = Math.max(0, daysBetween(a.bought_on, a.end_date || today()));
  const need = E.needFor(a), d = a.days || 0;
  const combo = E.combo(a);
  const dll = E.evs.filter(e => e.account_id === a.id && e.type === 'red').length;

  return (
    <motion.div ref={ref} layout="position" layoutId={'acc-' + a.id} className={`acc ${mini ? 'mini' : ''}`} style={{ ['--fc' as string]: f.color }}
      initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 400, damping: 34 }}>
      <div className="acc-hd">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="acc-nm">{a.name}{dll > 0 && <span className="dll" title="Jours perdants sans perdre le compte (DLL touchée)">DLL {dll}</span>}</div>
          <div className="acc-meta">{f.name}{combo ? ` — ${combo}` : ''}</div>
        </div>
        {a.status === 'dead' ? <StageTag stage="dead">Cramé</StageTag> : <StageTag stage={E.stageKey(a)}>{E.stageLabel(a)}</StageTag>}
      </div>

      <Pipeline a={a} />

      {a.status === 'active' && (
        <div className="days">
          <button className="icon-btn" onClick={() => act.undoDay(a)} aria-label="Retirer un jour" disabled={!d}><Minus size={15} /></button>
          <div className="d-n num">Jour {d}{need != null && <small> / {need}</small>}</div>
          <div className="d-t">{need == null ? 'pas d’objectif de jours' : d >= need ? <span className="pos">objectif atteint</span> : `encore ${need - d} jour${need - d > 1 ? 's' : ''}`}</div>
          <button className="icon-btn plus" onClick={() => act.win(a)} aria-label="Jour gagnant"><Plus size={15} /></button>
        </div>
      )}
      {a.status === 'dead' && <div className="acc-note">Cramé en <b>{E.stepName(E.level(a))}</b>{a.days ? `, jour ${a.days + 1}` : ''}{a.end_date ? `, le ${fmtD(a.end_date)} après ${age} j` : ''}</div>}
      {a.status === 'completed' && <div className="acc-note pos">Terminé : {pays.length} payouts en {age} jours</div>}

      {!mini && (
        <div className="acc-money">
          <span>Coût <b className="num">{money(cost)}</b></span>
          <span>Payouts <b className="num pos">{pays.length} · {money(paid)}</b></span>
          <span>Net <b className={`num ${tone(net)}`}>{money(net)}</b></span>
          <span>Acheté le {fmtD(a.bought_on)}</span>
        </div>
      )}
      {mini && (pays.length > 0 || cost > 0) && (
        <div className="acc-money"><span>Net <b className={`num ${tone(net)}`}>{money(net)}</b></span>{pays.length > 0 && <span>{pays.length} payout{pays.length > 1 ? 's' : ''}</span>}</div>
      )}
      {a.notes && !mini && <div className="acc-note">{a.notes}</div>}

      <div className="acc-acts">
        {a.status === 'active' && a.phase !== 'followup' && (
          <Button size="sm" variant="success" icon={<ArrowRight size={14} />} onClick={() => act.advance(a)}>{a.phase === 'eval' ? 'Éval validée' : 'Buffer validé'}</Button>
        )}
        {a.status === 'active' && a.phase === 'followup' && (
          <Button size="sm" variant="success" icon={<Banknote size={14} />} onClick={() => open({ kind: 'payout', accId: a.id })}>Payout {a.cycle || 1}</Button>
        )}
        {a.status === 'active' && <Button size="sm" variant="danger" icon={<Skull size={14} />} onClick={() => open({ kind: 'die', acc: a })}>Cramé</Button>}
        {a.status === 'active' && <Button size="sm" variant="ghost" icon={<CloudRain size={14} />} onClick={() => act.red(a)} title="DLL touchée : journée perdante sans perdre le compte">DLL</Button>}
        {a.status === 'dead' && <Button size="sm" icon={<RotateCcw size={14} />} onClick={() => open({ kind: 'reset', acc: a })}>Reset</Button>}
        <Button size="sm" variant="ghost" icon={<Pencil size={14} />} onClick={() => open({ kind: 'editAcc', acc: a })} aria-label="Modifier">{mini ? '' : 'Modifier'}</Button>
      </div>
    </motion.div>
  );
});
