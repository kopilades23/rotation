import { useMemo, useState } from 'react';
import { useData } from '../lib/store';
import { Pencil } from 'lucide-react';
import { useUi } from '../lib/hooks';
import { bankroll, filtered, totals } from '../lib/stats';
import { TX_LABEL } from '../lib/logic';
import type { Tx } from '../lib/types';
import { addDays, fmtD, longDate, money, monthLong, parseYmd, pct, tone, plural, today, ymd } from '../lib/utils';
import { FilterBar } from '../components/FilterBar';
import { Dot, Empty, Panel, Segmented } from '../components/ui';

export function Journal() {
  const [mode, setMode] = useState<'days' | 'moves'>('days');
  return mode === 'days' ? <DayByDay setMode={setMode} /> : <Moves setMode={setMode} />;
}

const ModeSwitch = ({ mode, setMode }: { mode: 'days' | 'moves'; setMode: (m: 'days' | 'moves') => void }) => (
  <Segmented id="jmode" value={mode} onChange={setMode} options={[{ value: 'days', label: 'Jour par jour' }, { value: 'moves', label: 'Tous les mouvements' }]} />
);

/** Le mois jour par jour, comme ta feuille Excel : achats, dépenses, payouts, cumuls, bankroll */
function DayByDay({ setMode }: { setMode: (m: 'days' | 'moves') => void }) {
  const { E } = useUi(); const d = useData();
  const [month, setMonth] = useState(today().slice(0, 7));
  const [firm, setFirm] = useState('all');
  const months = useMemo(() => [...new Set([today().slice(0, 7), ...E.txs.map(t => t.date.slice(0, 7))])].sort().reverse(), [E]);
  const B = useMemo(() => bankroll(E, d.settings), [E, d.settings]);
  const bByDay = useMemo(() => new Map((B?.pts || []).map(p => [p.d, p.v])), [B]);
  const rows = useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    const first = month + '-01', last = ymd(new Date(y, m, 0));
    const txs = E.txs.filter(t => t.date >= first && t.date <= last && (firm === 'all' || t.firm_id === firm));
    let cs = 0, cp = 0; const out = [];
    for (let day = first; day <= last; day = addDays(day, 1)) {
      const dt = txs.filter(t => t.date === day);
      const nb = dt.filter(t => t.type === 'purchase' || t.type === 'reset').length;
      const sp = dt.filter(t => t.type !== 'payout').reduce((s, t) => s + +t.amount, 0);
      const pa = dt.filter(t => t.type === 'payout').reduce((s, t) => s + +t.amount, 0);
      const np = dt.filter(t => t.type === 'payout').length;
      cs += sp; cp += pa;
      const wd = parseYmd(day).getDay();
      out.push({ day, nb, sp, pa, np, cs, cp, net: pa - sp, weekend: wd === 0 || wd === 6 });
    }
    return out;
  }, [E, month, firm]);
  const tot = rows.reduce((a, r) => ({ nb: a.nb + r.nb, sp: a.sp + r.sp, pa: a.pa + r.pa, np: a.np + r.np }), { nb: 0, sp: 0, pa: 0, np: 0 });
  const td = today();
  const showB = !!B && firm === 'all';
  const endDay = rows.length ? (rows[rows.length - 1].day > td ? td : rows[rows.length - 1].day) : td;
  const endB = bByDay.get(endDay) ?? null;
  return (
    <>
      <div className="filters">
        <ModeSwitch mode="days" setMode={setMode} />
        <select value={month} onChange={e => setMonth(e.target.value)} aria-label="Mois">{months.map(m => <option key={m} value={m}>{monthLong(m)}</option>)}</select>
        <select value={firm} onChange={e => setFirm(e.target.value)} aria-label="Prop firm"><option value="all">Toutes les firms</option>{E.firms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
      </div>
      <div className="ledger c4" style={{ marginBottom: 16 }}>
        <div><div className="k">Comptes achetés</div><div className="v num">{tot.nb}</div><div className="s">{monthLong(month)}</div></div>
        <div><div className="k">Dépensé</div><div className="v num neg">{money(tot.sp, 2)}</div><div className="s">achats, resets et frais</div></div>
        <div><div className="k">Payouts</div><div className="v num pos">{money(tot.pa, 2)}</div><div className="s">{plural(tot.np, 'payout')}</div></div>
        <div><div className="k">Net du mois</div><div className={`v num ${tone(tot.pa - tot.sp)}`}>{money(tot.pa - tot.sp, 2)}</div><div className="s">{showB && endB != null ? `bankroll ${rows[rows.length - 1].day > td ? 'aujourd’hui' : 'fin de mois'} : ${money(endB, 2)}` : 'payouts − dépenses'}</div></div>
      </div>
      <Panel pad={false}>
        <div className="tw"><table>
          <thead><tr><th>Date</th><th className="r">Comptes achetés</th><th className="r">Dépense</th><th className="r">Dépense cumulée</th><th className="r">Payouts</th><th className="r">Payouts cumulés</th><th className="r">Net du jour</th>{showB && <th className="r">Bankroll</th>}</tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.day} className={`${r.weekend ? 'weekend' : ''} ${r.day === td ? 'today' : ''}`}>
                <td>{parseYmd(r.day).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' })}</td>
                <td className="r num">{r.nb || <span className="dim">0</span>}</td>
                <td className={`r num ${r.sp ? 'neg' : 'dim'}`}>{money(r.sp, 2)}</td>
                <td className="r num muted">{money(r.cs, 2)}</td>
                <td className={`r num ${r.pa ? 'pos' : 'dim'}`}>{money(r.pa, 2)}</td>
                <td className="r num muted">{money(r.cp, 2)}</td>
                <td className={`r num ${r.net ? tone(r.net) : 'dim'}`}>{r.net ? money(r.net, 2) : '—'}</td>
                {showB && <td className="r num">{r.day <= td && bByDay.has(r.day) ? money(bByDay.get(r.day)!, 2) : <span className="dim">—</span>}</td>}
              </tr>
            ))}
            <tr className="total"><td>Total</td><td className="r num">{tot.nb}</td><td className="r num neg">{money(tot.sp, 2)}</td><td /><td className="r num pos">{money(tot.pa, 2)}</td><td /><td className={`r num ${tone(tot.pa - tot.sp)}`}>{money(tot.pa - tot.sp, 2)}</td>{showB && <td />}</tr>
          </tbody>
        </table></div>
      </Panel>
      {!B && <p className="dim" style={{ fontSize: 12.5 }}>Indique ta bankroll de départ (Accueil ou Réglages) pour voir la bankroll jour par jour.</p>}
    </>
  );
}

function Moves({ setMode }: { setMode: (m: 'days' | 'moves') => void }) {
  const { E, filters, open } = useUi();
  const [type, setType] = useState<'all' | 'spend' | 'payout'>('all');
  const F = useMemo(() => filtered(E, filters), [E, filters]);
  const txs = F.txs.filter(t => type === 'all' || (type === 'payout' ? t.type === 'payout' : t.type !== 'payout'))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const T = totals(F.txs);
  const groups = new Map<string, Tx[]>();
  txs.forEach(t => groups.set(t.date, [...(groups.get(t.date) || []), t]));
  const days = [...groups.keys()].slice(0, 400);

  return (
    <>
      <FilterBar />
      <div className="ledger c4" style={{ marginBottom: 16 }}>
        <div><div className="k">Dépensé</div><div className="v num neg">{money(T.spent)}</div><div className="s">{plural(F.txs.filter(t => t.type === 'purchase').length, 'achat')}</div></div>
        <div><div className="k">Payouts</div><div className="v num pos">{money(T.paid)}</div><div className="s">{plural(T.nPay, 'payout')}</div></div>
        <div><div className="k">Net</div><div className={`v num ${tone(T.net)}`}>{money(T.net)}</div><div className="s">payouts − dépenses</div></div>
        <div><div className="k">ROI</div><div className={`v num ${tone(T.roi)}`}>{pct(T.roi)}</div><div className="s">net ÷ dépensé</div></div>
      </div>
      <div className="filters">
        <Segmented id="jt" value={type} onChange={setType} options={[{ value: 'all', label: 'Tout' }, { value: 'spend', label: 'Dépenses' }, { value: 'payout', label: 'Payouts' }]} />
      </div>
      <Panel pad={false}>
        {txs.length ? (
          <div className="tw">
            <table>
              <thead><tr><th>Date</th><th>Firm</th><th>Compte</th><th>Type</th><th className="r">Montant</th><th /></tr></thead>
              <tbody>
                {days.map(d => {
                  const g = groups.get(d)!; const s = g.filter(t => t.type !== 'payout').reduce((x, t) => x + +t.amount, 0), p = g.filter(t => t.type === 'payout').reduce((x, t) => x + +t.amount, 0);
                  return [
                    <tr className="day-h" key={'h' + d}><td colSpan={4}>{longDate(d)}</td>
                      <td className="r num">{s ? <span className="neg">−{money(s)}</span> : null}{s && p ? '  ' : ''}{p ? <span className="pos">+{money(p)}</span> : null}</td><td /></tr>,
                    ...g.map(t => {
                      const pay = t.type === 'payout'; const a = t.account_id ? E.d.accounts[t.account_id] : null;
                      return (
                        <tr key={t.id}>
                          <td className="dim">{fmtD(t.date)}</td>
                          <td><span className="firm-cell"><Dot color={E.firm(t.firm_id).color} />{E.firm(t.firm_id).name}</span></td>
                          <td>{a?.name || <span className="dim">—</span>}</td>
                          <td>{pay ? <span className="pos">Payout</span> : TX_LABEL[t.type]}{pay && t.gross ? <span className="dim"> ({money(t.gross)} à {t.split} %)</span> : null}{t.note ? <span className="dim"> — {t.note}</span> : null}</td>
                          <td className={`r num ${pay ? 'pos' : 'neg'}`}>{pay ? '+' : '−'}{money(t.amount)}</td>
                          <td className="r"><button className="icon-btn" onClick={() => open({ kind: 'expense', tx: t })} aria-label="Modifier"><Pencil size={14} /></button></td>
                        </tr>
                      );
                    }),
                  ];
                })}
              </tbody>
            </table>
          </div>
        ) : <Empty title="Aucune entrée sur cette période" />}
      </Panel>
    </>
  );
}
