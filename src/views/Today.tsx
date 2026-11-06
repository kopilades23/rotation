import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronLeft, ChevronRight, Camera, Copy, Plus, ArrowRight, Banknote, Skull } from 'lucide-react';
import { useActions, useUi } from '../lib/hooks';
import { EVENT_LABEL, type Engine } from '../lib/logic';
import { addDays, fmtD, longDate, money, parseYmd, today, ymd, plural } from '../lib/utils';
import { Button, Empty, Panel, Segmented, StageTag, useToast, Dot } from '../components/ui';
import type { Phase } from '../lib/types';

export interface DayItem { id: string; date: string; ts: number; type: string; accId: string | null; name: string; firmId: string; combo: string; phase: Phase | null; cycle: number; day: number; amount: number | null }

export const stageShort = (phase: Phase | null, cycle: number) => (phase === 'eval' ? 'éval' : phase === 'buffer' ? 'buffer' : phase === 'followup' ? `follow-up vers P${cycle || 1}` : '');

export function activity(E: Engine, from: string, to: string): DayItem[] {
  const inR = (d: string) => d >= from && d <= to;
  const out: DayItem[] = []; const seen = new Set<string>();
  const acc = (id: string | null) => (id ? E.d.accounts[id] : undefined);
  E.evs.filter(e => inR(e.date)).forEach(e => {
    const a = acc(e.account_id);
    out.push({ id: e.id, date: e.date, ts: e.ts, type: e.type, accId: e.account_id, name: a?.name || '', firmId: e.firm_id || a?.firm_id || '', combo: a ? E.combo(a) : '', phase: e.phase, cycle: e.cycle || 1, day: e.day || 0, amount: e.amount });
    if (e.type === 'died' && e.account_id) seen.add('died:' + e.account_id);
    if (e.type === 'payout' && e.tx_id) seen.add('pay:' + e.tx_id);
  });
  E.txs.filter(t => inR(t.date)).forEach(t => {
    const a = acc(t.account_id);
    if (t.type === 'payout') { if (!seen.has('pay:' + t.id)) out.push({ id: 'tx' + t.id, date: t.date, ts: 0, type: 'payout', accId: t.account_id, name: a?.name || '', firmId: t.firm_id, combo: a ? E.combo(a) : '', phase: null, cycle: 1, day: 0, amount: +t.amount }); }
    else if (t.type === 'purchase' || t.type === 'reset') out.push({ id: 'tx' + t.id, date: t.date, ts: 0, type: t.type === 'reset' ? 'reset' : 'bought', accId: t.account_id, name: a?.name || '', firmId: t.firm_id, combo: a ? E.combo(a) : '', phase: null, cycle: 1, day: 0, amount: +t.amount });
  });
  E.accounts.filter(a => a.status === 'dead' && a.end_date && inR(a.end_date) && !seen.has('died:' + a.id)).forEach(a =>
    out.push({ id: 'd' + a.id, date: a.end_date!, ts: 0, type: 'died', accId: a.id, name: a.name, firmId: a.firm_id, combo: E.combo(a), phase: a.phase, cycle: a.cycle, day: a.days, amount: null }));
  return out.sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : (y.ts || 0) - (x.ts || 0)));
}

export function summarize(evs: DayItem[]) {
  const c = (t: string) => evs.filter(e => e.type === t).length;
  const wins = evs.filter(e => e.type === 'win');
  const died = evs.filter(e => e.type === 'died');
  const won = wins.length + c('pass_eval') + c('buffer_done');
  const lost = died.length + c('red');
  const diedBy: Record<string, number> = {};
  died.forEach(e => { const k = stageShort(e.phase, e.cycle) || '?'; diedBy[k] = (diedBy[k] || 0) + 1; });
  const paid = evs.filter(e => e.type === 'payout').reduce((s, e) => s + (e.amount || 0), 0);
  const buys = evs.filter(e => e.type === 'bought' || e.type === 'reset');
  return { won, lost, trades: won + lost, pass: c('pass_eval'), buf: c('buffer_done'), fu: wins.filter(e => e.phase === 'followup').length, died: died.length, diedBy, paid, nPay: c('payout'), nBuy: buys.length, spent: buys.reduce((s, e) => s + (e.amount || 0), 0) };
}

export const itemText = (e: DayItem) => {
  if (e.type === 'win') return `Jour gagnant — ${stageShort(e.phase, e.cycle)}, jour ${e.day + 1}`;
  if (e.type === 'red') return `DLL touchée — ${stageShort(e.phase, e.cycle)}, compte toujours actif`;
  if (e.type === 'died') return `Compte cramé — ${stageShort(e.phase, e.cycle)}${e.day ? `, jour ${e.day + 1}` : ''}`;
  if (e.type === 'pass_eval') return 'Éval validée, passe en buffer';
  if (e.type === 'buffer_done') return 'Buffer validé, passe en follow-up';
  if (e.type === 'payout') return `Payout de ${money(e.amount)}`;
  if (e.type === 'bought') return `Achat — ${money(e.amount)}`;
  if (e.type === 'reset') return `Reset — ${money(e.amount)}`;
  return EVENT_LABEL[e.type as keyof typeof EVENT_LABEL] || e.type;
};
export const itemColor = (t: string) => ({ win: '#1fa878', pass_eval: '#1fa878', buffer_done: '#2bb3c0', payout: '#f0c060', died: '#e66767', red: '#e0683a', bought: '#6f8cf0', reset: '#6f8cf0' } as Record<string, string>)[t] || '#6c768f';

export function Today() {
  const { E, open } = useUi();
  const act = useActions();
  const toast = useToast();
  const [date, setDate] = useState(today());
  const [span, setSpan] = useState<'day' | 'week'>('day');
  const wk = span === 'week';
  let from = date, to = date;
  if (wk) { const x = parseYmd(date); const dow = (x.getDay() + 6) % 7; from = addDays(ymd(x), -dow); to = addDays(from, 6); }
  const evs = useMemo(() => activity(E, from, to), [E, from, to]);
  const S = summarize(evs);
  const isToday = !wk && date === today();
  const traded = new Set(evs.filter(e => ['win', 'red', 'pass_eval', 'buffer_done', 'died', 'payout'].includes(e.type)).map(e => e.accId));
  const todo = isToday ? E.accounts.filter(a => a.status === 'active' && !traded.has(a.id)).sort((a, b) => E.progress(b) - E.progress(a)) : [];
  const label = wk ? `Semaine du ${fmtD(from)} au ${fmtD(to)}` : longDate(date);

  const text = () => {
    const L = [label, `Trades : ${S.trades} (${S.won} gagnés, ${S.lost} perdus)`, `Évals validées : ${S.pass} · Buffers validés : ${S.buf} · Jours follow-up gagnés : ${S.fu}`,
      `Comptes cramés : ${S.died}${S.died ? ' (' + Object.entries(S.diedBy).map(([k, n]) => `${n} en ${k}`).join(', ') + ')' : ''}`,
      `Payouts : ${S.nPay} · ${money(S.paid)} · Achats : ${S.nBuy} · ${money(S.spent)}`, ''];
    [...evs].reverse().forEach(e => L.push(`${wk ? fmtD(e.date) + ' ' : ''}${e.name} (${E.firm(e.firmId).name}) — ${itemText(e)}`));
    return L.join('\n');
  };
  const copy = async () => { try { await navigator.clipboard.writeText(text()); toast('Résumé copié'); } catch { toast('Copie impossible dans ce navigateur', 'error'); } };
  const move = (k: number) => setDate(addDays(date, k * (wk ? 7 : 1)));

  return (
    <>
      <div className="daynav">
        <button className="icon-btn" onClick={() => move(-1)} aria-label="Précédent"><ChevronLeft size={18} /></button>
        <div className="dl">{label}</div>
        <button className="icon-btn" onClick={() => move(1)} aria-label="Suivant"><ChevronRight size={18} /></button>
        <Button size="sm" variant={isToday ? 'primary' : 'soft'} onClick={() => setDate(today())}>Aujourd’hui</Button>
        <Segmented id="span" value={span} onChange={setSpan} options={[{ value: 'day', label: 'Jour' }, { value: 'week', label: 'Semaine' }]} />
        <span className="grow" />
        <Button size="sm" icon={<Copy size={14} />} onClick={copy}>Copier le résumé</Button>
        <Button size="sm" icon={<Camera size={14} />} onClick={() => open({ kind: 'share', mode: 'day', payload: { label, from, to, evs, S } })}>Image à partager</Button>
      </div>

      <div className="ledger c4">
        <div><div className="k">Trades</div><div className="v num">{S.trades}</div><div className="s">{S.won} gagnés, {S.lost} perdus</div></div>
        <div><div className="k">Réussite</div><div className="v num">{S.trades ? Math.round((S.won / S.trades) * 100) + ' %' : '—'}</div><div className="s">jours gagnés ÷ trades</div></div>
        <div><div className="k">Évals validées</div><div className={`v num ${S.pass ? 'pos' : ''}`}>{S.pass}</div><div className="s">passent en buffer</div></div>
        <div><div className="k">Buffers validés</div><div className={`v num ${S.buf ? 'pos' : ''}`}>{S.buf}</div><div className="s">passent en follow-up</div></div>
        <div><div className="k">Jours follow-up gagnés</div><div className={`v num ${S.fu ? 'pos' : ''}`}>{S.fu}</div><div className="s">vers les payouts</div></div>
        <div><div className="k">Comptes cramés</div><div className={`v num ${S.died ? 'neg' : ''}`}>{S.died}</div><div className="s">{Object.entries(S.diedBy).map(([k, n]) => `${n} en ${k}`).join(', ') || 'aucun'}</div></div>
        <div><div className="k">Payouts</div><div className={`v num ${S.paid ? 'pos' : ''}`}>{money(S.paid)}</div><div className="s">{plural(S.nPay, 'payout')}</div></div>
        <div><div className="k">Achats</div><div className={`v num ${S.spent ? 'neg' : ''}`}>{money(S.spent)}</div><div className="s">{plural(S.nBuy, 'compte')}</div></div>
      </div>

      {isToday && (
        <>
          <div className="section-t"><h2>À trader aujourd’hui</h2><span>{todo.length ? `${plural(todo.length, 'compte actif', 'comptes actifs')} sans résultat noté aujourd’hui, les plus avancés en premier` : ''}</span></div>
          {todo.length ? (
            <div className="todo">
              <AnimatePresence initial={false}>
                {todo.map(a => {
                  const need = E.needFor(a);
                  return (
                    <motion.div key={a.id} layout className="todo-r" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: 40, transition: { duration: 0.22 } }}>
                      <div><div className="acc-nm">{a.name}</div><div className="acc-meta firm-cell"><Dot color={E.firm(a.firm_id).color} />{E.firm(a.firm_id).name}{E.combo(a) ? ` — ${E.combo(a)}` : ''}</div></div>
                      <div className="row"><StageTag stage={a.phase}>{E.stageLabel(a)}</StageTag><span className="dim num" style={{ fontSize: 12.5 }}>jour {(a.days || 0) + 1}{need != null ? ` sur ${need}` : ''}</span></div>
                      <div className="acts">
                        <Button size="sm" variant="success" icon={<Plus size={14} />} onClick={() => act.win(a)}>Gagné</Button>
                        {a.phase !== 'followup'
                          ? <Button size="sm" icon={<ArrowRight size={14} />} onClick={() => act.advance(a)}>{a.phase === 'eval' ? 'Éval validée' : 'Buffer validé'}</Button>
                          : <Button size="sm" icon={<Banknote size={14} />} onClick={() => open({ kind: 'payout', accId: a.id })}>Payout</Button>}
                        <Button size="sm" variant="ghost" onClick={() => act.red(a)} title="Journée perdante sans perdre le compte">DLL</Button>
                        <Button size="sm" variant="danger" icon={<Skull size={14} />} onClick={() => open({ kind: 'die', acc: a })}>Cramé</Button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          ) : <Panel><Empty title="Tout est noté pour aujourd’hui">Chaque compte actif a un résultat aujourd’hui.</Empty></Panel>}
        </>
      )}

      <div className="section-t"><h2>Ce qui s’est passé</h2><span>{plural(evs.length, 'entrée')}</span></div>
      <Panel>
        {evs.length ? (
          <div className="tl">
            {evs.map(e => (
              <div className="tl-r" key={e.id}>
                <div className="tl-time num">{wk ? fmtD(e.date).slice(0, 5) + ' ' : ''}{e.ts ? new Date(e.ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}</div>
                <div className="tl-dot"><i style={{ background: itemColor(e.type) }} /></div>
                <div>
                  <div className="tl-what" style={{ color: e.type === 'died' ? 'var(--neg)' : e.type === 'payout' ? 'var(--gold)' : undefined }}>{itemText(e)}</div>
                  <div className="tl-sub firm-cell"><b style={{ color: 'var(--text)', fontWeight: 600 }}>{e.name}</b><Dot color={E.firm(e.firmId).color} />{E.firm(e.firmId).name}{e.combo ? ` — ${e.combo}` : ''}</div>
                </div>
              </div>
            ))}
          </div>
        ) : <Empty title={`Rien de noté ${wk ? 'cette semaine' : 'ce jour-là'}`}>Les résultats se notent depuis les comptes : + pour un jour gagnant, Éval validée, Buffer validé, Payout ou Cramé.</Empty>}
      </Panel>
      <p className="dim" style={{ fontSize: 12.5, marginTop: 10 }}>Les lignes sans heure viennent des achats, payouts et comptes cramés notés sans passer par les boutons du jour (imports par exemple).</p>
    </>
  );
}
