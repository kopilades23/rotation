import { useMemo } from 'react';
import { useUi } from '../lib/hooks';
import { evalDeathDays, filtered, groupRows, monthly, monthlyBankroll, payoutHistogram, timing, tradeStats } from '../lib/stats';
import { useData } from '../lib/store';
import { money, monthLong, num, pct, tone, plural } from '../lib/utils';
import { FilterBar } from '../components/FilterBar';
import { Dot, Empty, Panel } from '../components/ui';
import { Bars } from '../components/charts';

const days = (n: number) => (isFinite(n) ? `${num(n, 1)} j` : '—');

export function Stats() {
  const { E, filters } = useUi();
  const d = useData();
  const MB = useMemo(() => monthlyBankroll(E, d.settings), [E, d.settings]);
  const showB = MB.size > 0 && filters.firm === 'all';
  const F = useMemo(() => filtered(E, filters), [E, filters]);
  const M = useMemo(() => monthly(E, F.txs, F.accs, F.evs), [E, F]);
  const tm = useMemo(() => timing(E, F.accs), [E, F]);
  const tr = useMemo(() => tradeStats(F.evs), [F]);
  const plans = useMemo(() => groupRows(E, F.accs, F.txs, 'plan'), [E, F]);
  const hist = useMemo(() => payoutHistogram(F.txs.filter(t => t.type === 'payout').map(t => +t.amount)), [F]);
  const ed = useMemo(() => evalDeathDays(E, F.accs), [E, F]);
  const best = M.length ? M.reduce((a, b) => (b.net > a.net ? b : a)) : null;
  const worst = M.length ? M.reduce((a, b) => (b.net < a.net ? b : a)) : null;
  const pays = F.txs.filter(t => t.type === 'payout').map(t => +t.amount);

  return (
    <>
      <FilterBar />
      <div className="ledger c3">
        <div><div className="k">Pour valider l’éval</div><div className="v num">{days(tm.passEval)}</div><div className="s">en moyenne, depuis l’achat</div></div>
        <div><div className="k">Jusqu’au 1er payout</div><div className="v num">{days(tm.firstPay)}</div><div className="s">sur {plural(tm.nFirst, 'compte')}</div></div>
        <div><div className="k">Entre deux payouts</div><div className="v num">{days(tm.between)}</div><div className="s">même compte</div></div>
        <div><div className="k">Vie d’un compte cramé</div><div className="v num">{days(tm.lifeDead)}</div><div className="s">de l’achat à la perte</div></div>
        <div><div className="k">Série en cours</div><div className={`v num ${tr.n ? (tr.curWin ? 'pos' : 'neg') : ''}`}>{tr.n ? `${tr.cur} ${tr.curWin ? 'gagnés' : 'perdus'}` : '—'}</div><div className="s">jours consécutifs</div></div>
        <div><div className="k">Meilleure série</div><div className="v num pos">{tr.bestWin || '—'}</div><div className="s">pire série perdante : {tr.worstLoss || '—'}</div></div>
        <div><div className="k">Meilleur payout</div><div className="v num" style={{ color: 'var(--gold)' }}>{money(pays.length ? Math.max(...pays) : NaN)}</div><div className="s">sur {plural(pays.length, 'payout')}</div></div>
        <div><div className="k">Meilleur mois</div><div className={`v num ${best ? tone(best.net) : ''}`}>{best ? money(best.net) : '—'}</div><div className="s">{best ? monthLong(best.k) : ''}</div></div>
        <div><div className="k">Pire mois</div><div className={`v num ${worst ? tone(worst.net) : ''}`}>{worst ? money(worst.net) : '—'}</div><div className="s">{worst ? monthLong(worst.k) : ''}</div></div>
      </div>

      <div className="section-t"><h2>Mois par mois</h2><span>réussite = jours gagnés ÷ jours tradés notés</span></div>
      <Panel pad={false}>
        {M.length ? (
          <div className="tw"><table>
            <thead><tr><th>Mois</th><th className="r">Comptes achetés</th><th className="r">Dépensé</th><th className="r">Payouts</th><th className="r">Net</th><th className="r">ROI</th><th className="r">Réussite</th><th className="r">Cramés</th>{showB && <><th className="r">Bankroll début</th><th className="r">Bankroll fin</th></>}</tr></thead>
            <tbody>{M.map(r => (
              <tr key={r.k}>
                <td><b style={{ fontWeight: 600 }}>{monthLong(r.k)}</b></td>
                <td className="r num">{r.bought}</td>
                <td className="r num neg">{money(r.spent)}</td>
                <td className="r num pos">{money(r.paid)} <span className="dim">({r.nPay})</span></td>
                <td className={`r num ${tone(r.net)}`}><b>{money(r.net)}</b></td>
                <td className={`r num ${tone(r.roi)}`}>{pct(r.roi, 0)}</td>
                <td className="r num">{pct(r.winRate, 0)}</td>
                <td className="r num">{r.deaths}</td>
                {showB && <><td className="r num muted">{MB.get(r.k) ? money(MB.get(r.k)!.open, 2) : '—'}</td><td className="r num"><b>{MB.get(r.k) ? money(MB.get(r.k)!.close, 2) : '—'}</b></td></>}
              </tr>))}</tbody>
          </table></div>
        ) : <Empty title="Pas encore de données" />}
      </Panel>

      <div className="grid g2" style={{ marginTop: 16 }}>
        <Panel title="Réussite par jour de la semaine" sub={`${tr.n} jours tradés notés (gagnés, rouges ou cramés)`}>
          {tr.n ? <Bars data={tr.weekday.filter(w => w.wins + w.losses).map(w => ({ label: `${w.name} (${w.wins + w.losses})`, value: Math.round(w.rate * 100) }))} color="#6f8cf0" name="Réussite" fmt={v => v + ' %'} height={240} /> : <Empty title="Aucun jour tradé noté" />}
        </Panel>
        <Panel title="Répartition des payouts" sub="montant reçu après split">
          {hist.length ? <Bars data={hist.map(h => ({ label: `${Math.round(h.from)}–${Math.round(h.to)} $`, value: h.n }))} color="#c98500" name="Payouts" height={240} /> : <Empty title="Aucun payout sur la période" />}
        </Panel>
      </div>

      <div className="section-t"><h2>Par plan</h2><span>firm, taille et règles du compte</span></div>
      <Panel pad={false}>
        {plans.length ? (
          <div className="tw"><table>
            <thead><tr><th>Plan</th><th className="r">Comptes</th><th className="r">Actifs</th><th className="r">Éval réussie</th><th className="r">1er payout atteint</th><th className="r">Dépensé</th><th className="r">Payouts</th><th className="r">Net</th><th className="r">ROI</th><th className="r">Coût par payout</th><th className="r">Payout moyen</th></tr></thead>
            <tbody>{plans.map(r => (
              <tr key={r.key}>
                <td><span className="firm-cell"><Dot color={r.color} /><b style={{ fontWeight: 600 }}>{r.name}</b></span></td>
                <td className="r num">{r.bought}</td><td className="r num">{r.active}</td>
                <td className="r num">{pct(r.evalRate, 0)}</td>
                <td className="r num">{r.reachedP1}{r.bought ? <span className="dim"> ({pct(r.reachedP1 / r.bought, 0)})</span> : null}</td>
                <td className="r num neg">{money(r.T.spent)}</td><td className="r num pos">{money(r.T.paid)}</td>
                <td className={`r num ${tone(r.T.net)}`}><b>{money(r.T.net)}</b></td><td className={`r num ${tone(r.T.roi)}`}>{pct(r.T.roi, 0)}</td>
                <td className="r num">{money(r.costPerPayout, 0)}</td><td className="r num">{money(r.avgPayout, 0)}</td>
              </tr>))}</tbody>
          </table></div>
        ) : <Empty title="Pas encore de données" />}
      </Panel>

      <div className="section-t"><h2>Jour de perte en éval</h2><span>{plural(ed.total, 'compte cramé', 'comptes cramés')} en éval{ed.pDay.length ? ', modèle d’après ta probabilité par jour' : ''}</span></div>
      <Panel pad={false}>
        {ed.rows.length ? (
          <div className="tw"><table>
            <thead><tr><th>Cramé au</th><th className="r">Comptes</th><th className="r">Part réelle</th><th className="r">Part selon ton modèle</th></tr></thead>
            <tbody>{ed.rows.map(r => <tr key={r.d}><td>Jour {r.d} de l’éval</td><td className="r num">{r.n}</td><td className="r num">{pct(r.share)}</td><td className="r num warn">{pct(r.model)}</td></tr>)}</tbody>
          </table></div>
        ) : <Empty title="Aucun compte cramé en éval sur la période" />}
      </Panel>
    </>
  );
}
