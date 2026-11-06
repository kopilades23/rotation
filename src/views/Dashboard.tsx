import { useMemo, useState } from 'react';
import { Camera, Target, Pencil } from 'lucide-react';
import { useUi } from '../lib/hooks';
import { useData } from '../lib/store';
import { bankroll, dailyNet, deathsByStage, drawdownDaily, groupRows, overview, series, totals, tradeStats } from '../lib/stats';
import { addDays, money, pct, num, tone, plural, today, signedMoney, numOrNull, fmtD } from '../lib/utils';
import { Button, Empty, Odometer, Panel, Segmented } from '../components/ui';
import { Flow } from '../components/Flow';
import { BankrollChart, Bars, CumChart, Heatmap, HBars, SpendPaidChart } from '../components/charts';
import { FilterBar } from '../components/FilterBar';

type Range = '1m' | '3m' | 'ytd' | 'all';

export function Dashboard() {
  const { E, filters, open } = useUi();
  const d = useData();
  const O = useMemo(() => overview(E, filters, d.settings), [E, filters, d.settings]);
  const B = useMemo(() => bankroll(E, d.settings), [E, d.settings]);
  const S = useMemo(() => series(O.F), [O]);
  const dd = useMemo(() => drawdownDaily(O.F.txs), [O]);
  const firms = useMemo(() => groupRows(E, O.F.accs, O.F.txs, 'firm'), [E, O]);
  const deaths = useMemo(() => deathsByStage(E, O.accs), [E, O]);
  const heat = useMemo(() => dailyNet(O.F.allTxs), [O]);
  const allTrades = useMemo(() => tradeStats(E.evs), [E]);
  const month = useMemo(() => totals(E.txs.filter(t => t.date.slice(0, 7) === today().slice(0, 7))), [E]);
  const [range, setRange] = useState<Range>('all');
  const [editStart, setEditStart] = useState(false);
  const T = O.T;

  const pts = useMemo(() => {
    if (!B) return [];
    const from = range === '1m' ? addDays(today(), -30) : range === '3m' ? addDays(today(), -91) : range === 'ytd' ? today().slice(0, 4) + '-01-01' : '';
    const p = B.pts.filter(x => x.d >= from);
    return p.length > 1 ? p : B.pts;
  }, [B, range]);

  const empty = !E.accounts.length && !E.txs.length;

  return (
    <>
      {/* ---------- Bankroll ---------- */}
      <section className="hero">
        <div className="hero-top">
          <div style={{ minWidth: 0 }}>
            <div className="hero-l">
              {B ? <>Bankroll actuelle<button className="icon-btn" style={{ width: 26, height: 26 }} onClick={() => setEditStart(v => !v)} aria-label="Modifier la bankroll de départ" title="Modifier la bankroll de départ"><Pencil size={13} /></button></> : 'Résultat net depuis le début'}
            </div>
            <div className="hero-v num">
              <Odometer text={money(B ? B.current : T.net, 2).replace(/\s\$$/, '')} /><span className="cur">$</span>
            </div>
            {B ? (
              <div className="hero-chips">
                <span className={`chip ${tone(B.delta)}`}><b className="num">{signedMoney(Math.round(B.delta * 100) / 100)}</b> depuis le départ ({pct(B.deltaPct)})</span>
                <span className={`chip ${tone(B.monthDelta)}`}>Ce mois <b className="num">{signedMoney(Math.round(B.monthDelta * 100) / 100)}</b> ({pct(B.monthPct)})</span>
                <span className="chip">Départ <b className="num">{money(B.start, 2)}</b> le {fmtD(B.from)}</span>
              </div>
            ) : null}
          </div>
          {B && (
            <div className="hero-side">
              <Segmented id="brange" value={range} onChange={setRange} options={[{ value: '1m', label: '1 mois' }, { value: '3m', label: '3 mois' }, { value: 'ytd', label: 'Année' }, { value: 'all', label: 'Tout' }]} />
              {B.goal ? <GoalRing current={B.current} goal={B.goal} start={B.start} /> : <span className="dim" style={{ fontSize: 12.5 }}>Fixe un objectif dans Réglages pour suivre ta progression</span>}
            </div>
          )}
        </div>
        {(!B || editStart) && <StartForm onDone={() => setEditStart(false)} />}
        {B && pts.length > 1 && <div className="hero-chart"><BankrollChart data={pts} start={B.start} goal={B.goal} /></div>}
      </section>

      {/* ---------- État actuel ---------- */}
      <div className="tape">
        <div><div className="k">Comptes actifs</div><div className="v num">{O.nowActive}</div><div className="s">{O.byPhase.eval} en éval, {O.byPhase.buffer} en buffer, {O.byPhase.followup} en follow-up</div></div>
        <div><div className="k">Prochains payouts possibles</div><div className="v num champ">{money(O.pipelineValue, 0)}</div><div className="s">si les {O.inFollow} comptes en follow-up paient</div></div>
        <div><div className="k">Capital en jeu</div><div className="v num">{money(O.capitalInPlay, 0)}</div><div className="s">coût des comptes actifs</div></div>
        <div><div className="k">Ce mois-ci</div><div className={`v num ${tone(month.net)}`}>{signedMoney(Math.round(month.net))}</div><div className="s">{money(month.spent, 0)} dépensés, {money(month.paid, 0)} reçus</div></div>
        <div><div className="k">Jours gagnants</div><div className="v num">{pct(allTrades.winRate, 0)}</div><div className="s">{allTrades.n ? `série en cours : ${allTrades.cur} ${allTrades.curWin ? 'gagné' : 'perdu'}${allTrades.cur > 1 ? 's' : ''}` : 'aucun jour noté'}</div></div>
      </div>

      {empty ? (
        <div style={{ marginTop: 40 }}>
          <Panel><Empty title="Ton journal est vide" action={<Button variant="primary" onClick={() => open({ kind: 'buy' })}>Acheter des comptes</Button>}>
            Note ton premier achat de compte, ou importe ton historique Excel dans Réglages.
          </Empty></Panel>
        </div>
      ) : (
        <>
          <div className="section-t"><h2>Sur la période</h2><span>choisis les dates et la firm, tout ce qui suit s’adapte</span></div>
          <FilterBar />
          {O.allT.net < 0 && (
            <div className="note warn"><Target size={16} /><span>Point mort : il te manque <b className="num">{money(-O.allT.net)}</b> de payouts pour couvrir toutes tes dépenses{filters.firm !== 'all' ? ` chez ${E.firm(filters.firm).name}` : ''}.</span></div>
          )}

          <Panel title="Parcours des comptes" sub={`${plural(O.accs.length, 'compte acheté', 'comptes achetés')}. Réussite calculée sur les comptes déjà passés ou cramés à chaque étape.`}
            actions={<Button size="sm" variant="ghost" icon={<Camera size={14} />} onClick={() => open({ kind: 'share', mode: 'dash', payload: { O, firms, B } })}>Image à partager</Button>}>
            {O.accs.length ? <Flow steps={O.funnel} /> : <Empty title="Aucun compte acheté sur cette période" />}
          </Panel>

          <div className="ledger c4" style={{ marginTop: 16 }}>
            <div><div className="k">Résultat net</div><div className={`v num ${tone(T.net)}`}>{money(T.net, 0)}</div><div className="s">ROI {pct(T.roi)}, multiple {isFinite(T.multiple) ? num(T.multiple, 2) + '×' : '—'}</div></div>
            <div><div className="k">Dépensé</div><div className="v num">{money(T.spent, 0)}</div><div className="s">{plural(T.nBuy, 'achat ou reset', 'achats et resets')}</div></div>
            <div><div className="k">Payouts reçus</div><div className="v num pos">{money(T.paid, 0)}</div><div className="s">{plural(T.nPay, 'payout')}, moyenne {money(O.avgPayout, 0)}</div></div>
            <div><div className="k">Plus forte baisse</div><div className="v num">{money(-dd, 0)}</div><div className="s">du résultat cumulé, jour par jour</div></div>
            <div><div className="k">Coût par payout</div><div className="v num">{money(O.costPerPayout, 0)}</div><div className="s">dépensé ÷ nombre de payouts</div></div>
            <div><div className="k">Coût par compte financé</div><div className="v num">{money(O.costPerFunded, 0)}</div><div className="s">{plural(O.funded.length, 'compte financé', 'comptes financés')}</div></div>
            <div><div className="k">Payouts par compte financé</div><div className="v num">{num(O.payoutsPerFunded, 2)}</div><div className="s">{plural(O.paidAcc.length, 'compte payé', 'comptes payés')} au moins 1 fois</div></div>
            <div><div className="k">Meilleur payout</div><div className="v num champ">{money(O.bestPayout, 0)}</div><div className="s">médiane {money(O.medianPayout, 0)}</div></div>
          </div>

          <div className="grid g-wide" style={{ marginTop: 16 }}>
            <Panel title="Résultat net cumulé" sub={S.daily ? 'par jour' : 'par mois'}>
              <CumChart data={S.rows} height={280} />
            </Panel>
            <Panel title="Résultat par prop firm" sub="payouts moins dépenses">
              {firms.length ? <HBars data={firms.slice(0, 8).map(r => ({ name: r.name, value: r.T.net, color: r.color }))} /> : <Empty title="Rien sur cette période" />}
            </Panel>
          </div>

          <div className="grid g2" style={{ marginTop: 16 }}>
            <Panel title="Payouts et dépenses" sub={S.daily ? 'par jour' : 'par mois'} actions={<div className="legend"><span><i style={{ background: 'var(--c-paid)' }} />Payouts</span><span><i style={{ background: 'var(--c-spent)' }} />Dépensé</span></div>}>
              <SpendPaidChart data={S.rows} />
            </Panel>
            <Panel title="Où les comptes crament" sub="par étape au moment de la perte">
              {deaths.length ? <Bars data={deaths.map(x => ({ label: x.name, value: x.n }))} color="#ff7b7b" name="Comptes cramés" height={270} /> : <Empty title="Aucun compte cramé" />}
            </Panel>
          </div>

          <div className="grid g-wide" style={{ marginTop: 16 }}>
            <Panel title="Calendrier des résultats" sub="net par jour, 26 dernières semaines">
              <Heatmap map={heat} />
            </Panel>
            <Panel title={S.daily ? 'Comptes achetés par jour' : 'Comptes achetés par mois'}>
              <Bars data={S.rows.map(r => ({ label: r.label, value: r.bought }))} color="#8d7dff" name="Comptes" height={200} />
            </Panel>
          </div>
        </>
      )}
    </>
  );
}

function GoalRing({ current, goal, start }: { current: number; goal: number; start: number }) {
  // progression entre le départ et l'objectif
  const p = goal > start ? Math.max(0, Math.min(1, (current - start) / (goal - start))) : current >= goal ? 1 : 0;
  const R = 26, C = 2 * Math.PI * R;
  return (
    <div className="goal-ring">
      <div className="goal-t"><b className="num">{money(goal, 0)}</b>{current >= goal ? 'objectif atteint' : `reste ${money(goal - current, 0)}`}</div>
      <svg width="66" height="66" viewBox="0 0 66 66" aria-label={`Objectif atteint à ${Math.round(p * 100)} %`}>
        <circle cx="33" cy="33" r={R} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="5" />
        <circle cx="33" cy="33" r={R} fill="none" stroke="url(#gr)" strokeWidth="5" strokeLinecap="round" transform="rotate(-90 33 33)"
          strokeDasharray={C} strokeDashoffset={C * (1 - p)} style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(.16,1,.3,1)', filter: 'drop-shadow(0 0 6px rgba(236,212,156,.5))' }} />
        <defs><linearGradient id="gr" x1="0" x2="1"><stop offset="0" stopColor="#c9a35b" /><stop offset="1" stopColor="#f6e6bd" /></linearGradient></defs>
        <text x="33" y="37.5" textAnchor="middle" fill="#f3f4f7" fontSize="13" fontWeight="620" style={{ fontStretch: '110%' }}>{Math.round(p * 100)}%</text>
      </svg>
    </div>
  );
}

function StartForm({ onDone }: { onDone: () => void }) {
  const d = useData(); const { E } = useUi();
  const firstTx = E.txs.map(t => t.date).sort()[0];
  const [amount, setAmount] = useState(d.settings.start_bankroll != null ? String(d.settings.start_bankroll) : '');
  const [date, setDate] = useState(d.settings.start_date || firstTx || today());
  const [goal, setGoal] = useState(d.settings.goal != null ? String(d.settings.goal) : '');
  return (
    <form className="start-form" style={{ marginTop: 18 }} onSubmit={async e => { e.preventDefault(); const v = numOrNull(amount); if (v == null) return; await d.saveSettings({ start_bankroll: v, start_date: date || null, goal: numOrNull(goal) }); onDone(); }}>
      <label className="field"><span className="field-l">Bankroll de départ ($)</span><input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="2574" autoFocus /></label>
      <label className="field"><span className="field-l">À partir du</span><input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
      <label className="field"><span className="field-l">Objectif ($, facultatif)</span><input type="number" step="1" value={goal} onChange={e => setGoal(e.target.value)} placeholder="5000" /></label>
      <Button variant="primary" type="submit">Enregistrer</Button>
      <div className="field-h" style={{ flexBasis: '100%' }}>Ta bankroll actuelle = ce montant + tous tes payouts − toutes tes dépenses à partir de cette date.</div>
    </form>
  );
}
