import { useMemo, useState } from 'react';
import { useUi } from '../lib/hooks';
import { planModel } from '../lib/stats';
import { money, num, pct } from '../lib/utils';
import { Dot, Empty, Panel } from '../components/ui';
import { RateBars, SurvivalChart } from '../components/charts';

export function Model() {
  const { E, setTab } = useUi();
  const [sel, setSel] = useState('all');
  const planKeys = useMemo(() => [...new Set(E.accounts.map(E.planKey))].sort(), [E]);
  const accs = useMemo(() => E.accounts.filter(a => sel === 'all' || (sel.startsWith('firm:') && a.firm_id === sel.slice(5)) || (sel.startsWith('plan:') && E.planKey(a) === sel.slice(5))), [E, sel]);
  const rows = useMemo(() => E.stageStats(accs), [E, accs]);
  const cards = useMemo(() => planKeys.filter(k => sel === 'all' || (sel.startsWith('plan:') && k === sel.slice(5)) || (sel.startsWith('firm:') && E.accounts.some(a => a.firm_id === sel.slice(5) && E.planKey(a) === k))).map(k => planModel(E, k)), [E, planKeys, sel]);
  const comp = accs.filter(a => a.status === 'completed').length;

  let ca = 1, cm: number | null = 1;
  const surv = [{ label: 'Achetés', actual: 1, model: 1 as number | null }, ...rows.map(r => {
    ca *= isFinite(r.actual) ? r.actual : 1;
    cm = cm != null && isFinite(r.model) ? cm * r.model : null;
    return { label: r.i === 0 ? 'Éval' : r.i === 1 ? 'Buffer' : `P${r.i - 1}`, actual: ca, model: cm };
  })];
  let ra = 1, rm: number | null = 1;

  return (
    <>
      <div className="filters">
        <select value={sel} onChange={e => setSel(e.target.value)} aria-label="Groupe analysé">
          <option value="all">Tous les comptes</option>
          <optgroup label="Prop firm">{E.firms.filter(f => E.accounts.some(a => a.firm_id === f.id)).map(f => <option key={f.id} value={'firm:' + f.id}>{f.name}</option>)}</optgroup>
          <optgroup label="Plan">{planKeys.map(k => <option key={k} value={'plan:' + k}>{k}</option>)}</optgroup>
        </select>
        <span className="dim" style={{ fontSize: 12.5, maxWidth: 720 }}>Depuis le début. Les probabilités du modèle viennent de tes plans dans <a href="#reglages" onClick={e => { e.preventDefault(); setTab('settings'); }}>Réglages</a>. Un compte encore dans une étape n’est compté qu’une fois passé ou cramé.</span>
      </div>

      <Panel pad={false}>
        {accs.length ? (
          <div className="tw"><table>
            <thead><tr><th>Étape</th><th className="r">Tentées</th><th className="r">Passées</th><th className="r">Cramées ici</th><th className="r">En cours</th><th className="r">Réussite réelle</th><th className="r">Modèle</th><th className="r">Écart</th><th className="r">Pertes prévues</th><th className="r">Arrivée réelle</th><th className="r">Arrivée modèle</th></tr></thead>
            <tbody>
              {rows.map(r => {
                if (isFinite(r.actual)) ra *= r.actual;
                rm = rm != null && isFinite(r.model) ? rm * r.model : null;
                const gap = r.actual - r.model;
                return (
                  <tr key={r.i}>
                    <td><b style={{ fontWeight: 600 }}>{r.name}</b></td><td className="r num">{r.attempts}</td><td className="r num pos">{r.passed}</td><td className="r num neg">{r.died}</td><td className="r num">{r.active}</td>
                    <td className="r num">{pct(r.actual)}</td><td className="r num warn">{pct(r.model)}</td>
                    <td className={`r num ${isFinite(gap) ? (gap >= 0 ? 'pos' : 'neg') : ''}`}>{isFinite(gap) ? `${gap >= 0 ? '+' : ''}${num(gap * 100, 1)} pts` : '—'}</td>
                    <td className="r num">{r.modelN ? num(r.expDeaths, 1) : '—'}</td><td className="r num">{pct(ra)}</td><td className="r num">{rm != null ? pct(rm) : '—'}</td>
                  </tr>
                );
              })}
              <tr><td><b className="pos">Terminés (tous les payouts)</b></td><td className="r num">{comp}</td><td colSpan={9} /></tr>
            </tbody>
          </table></div>
        ) : <Empty title="Aucun compte pour l’instant" />}
      </Panel>
      <p className="dim" style={{ fontSize: 12.5 }}>Pertes prévues : pour chaque compte qui a tenté l’étape, 1 − probabilité du modèle, additionné. Arrivée : produit des réussites de toutes les étapes jusque-là.</p>

      {rows.length > 0 && (
        <div className="grid g2" style={{ marginTop: 16 }}>
          <Panel title="Survie des comptes" sub="part des comptes achetés qui arrive à chaque étape" actions={<div className="legend"><span><i style={{ background: '#6f8cf0' }} />Réel</span><span><i style={{ background: '#c98500' }} />Modèle</span></div>}>
            <SurvivalChart data={surv} />
          </Panel>
          <Panel title="Réussite par étape" actions={<div className="legend"><span><i style={{ background: '#6f8cf0' }} />Réel</span><span><i style={{ background: '#c98500' }} />Modèle</span></div>}>
            <RateBars data={rows.map(r => ({ label: r.i === 0 ? 'Éval' : r.i === 1 ? 'Buffer' : `P${r.i - 1}`, actual: isFinite(r.actual) ? r.actual : null, model: isFinite(r.model) ? r.model : null }))} height={280} />
          </Panel>
        </div>
      )}

      <div className="section-t"><h2>Ton modèle face au réel, plan par plan</h2><span>par compte financé, en rachetant des évals jusqu’à en valider une</span></div>
      <div className="stack">
        {cards.map(c => <PlanCard key={c.key} c={c} />)}
      </div>
    </>
  );
}

function PlanCard({ c }: { c: ReturnType<typeof planModel> }) {
  const P = (x: number) => pct(x, 1), D = (x: number) => money(x, 2), R = (x: number) => num(x, 2);
  const ord = (k: number) => (k === 1 ? '1er' : `${k}e`);
  const rows: [string, number | null | undefined, number, (x: number) => string, boolean?][] = [
    ['Probabilité de valider l’éval', c.M.pe, c.A.pe, P],
    ['Évals par compte financé', c.M.tries, c.A.tries, R, true],
    ['Coût des évals par compte financé', c.M.evalCost, c.A.evalCost, D, true],
  ];
  for (let k = 0; k < c.mp; k++) {
    rows.push([`${ord(k + 1)} payout : probabilité de l’atteindre (financé)`, c.M.reach[k], c.A.reach[k], P]);
    rows.push([`${ord(k + 1)} payout : montant reçu`, c.M.pay[k], c.A.pay[k], D]);
  }
  rows.push(['Payouts attendus par compte financé', c.M.expPay, c.A.expPay, D], ['Gain espéré par compte financé', c.M.ev, c.A.ev, D], ['ROI', c.M.roi, c.A.roi, P],
    ['Évals par 1er payout', c.M.evals1, c.A.evals1, R, true], ['Coût par 1er payout', c.M.cost1, c.A.cost1, D, true]);
  const ok = (x: number | null | undefined) => x != null && isFinite(x);
  return (
    <Panel pad={false} title={<span className="firm-cell"><Dot color={c.firmColor} />{c.key}</span>} sub={`${c.n} comptes, ${c.funded} financés, ${c.active} actifs${c.pl?.source ? ` — modèle : ${c.pl.source}` : ''}`}>
      {c.pl ? (
        <div className="tw" style={{ marginTop: 6 }}><table>
          <thead><tr><th /><th className="r">Modèle</th><th className="r">Réel</th><th className="r">Réel − modèle</th></tr></thead>
          <tbody>{rows.map(([l, m, a, f, low]) => {
            const gap = ok(m) && ok(a) ? a - (m as number) : null;
            const good = gap == null ? '' : (low ? -gap : gap) >= 0 ? 'pos' : 'neg';
            return <tr key={l}><td>{l}</td><td className="r num warn">{ok(m) ? f(m as number) : '—'}</td><td className="r num">{ok(a) ? f(a) : '—'}</td>
              <td className={`r num ${good}`}>{gap == null ? '—' : f === P ? `${gap >= 0 ? '+' : ''}${num(gap * 100, 1)} pts` : (gap >= 0 ? '+' : '') + f(gap)}</td></tr>;
          })}</tbody>
        </table></div>
      ) : <div className="dim" style={{ padding: '4px 20px 18px', fontSize: 13 }}>Pas de modèle pour ce plan. Ajoute-le dans Réglages (même firm et même taille) pour comparer.</div>}
    </Panel>
  );
}
