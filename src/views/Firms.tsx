import { useMemo } from 'react';
import { useUi } from '../lib/hooks';
import { filtered, groupRows } from '../lib/stats';
import { money, pct, tone } from '../lib/utils';
import { FilterBar } from '../components/FilterBar';
import { Dot, Empty, Panel } from '../components/ui';
import { HBars } from '../components/charts';

export function Firms() {
  const { E, filters } = useUi();
  const F = useMemo(() => filtered(E, filters), [E, filters]);
  const rows = useMemo(() => groupRows(E, F.accs, F.txs, 'firm'), [E, F]);
  const maxSpent = Math.max(1, ...rows.map(r => r.T.spent));
  return (
    <>
      <FilterBar showFirm={false} />
      <Panel pad={false}>
        {rows.length ? (
          <div className="tw"><table>
            <thead><tr><th>Prop firm</th><th className="r">Comptes</th><th className="r">Actifs</th><th className="r">Cramés</th><th>Dépensé</th><th className="r">Payouts</th><th className="r">Reçu</th><th className="r">Net</th><th className="r">ROI</th><th className="r">Éval réussie</th><th className="r">1er payout atteint</th><th className="r">Coût par payout</th></tr></thead>
            <tbody>{rows.map(r => (
              <tr key={r.key}>
                <td><span className="firm-cell"><Dot color={r.color} /><b style={{ fontWeight: 600 }}>{r.name}</b></span></td>
                <td className="r num">{r.bought}</td><td className="r num">{r.active}</td><td className="r num">{r.dead}</td>
                <td><div className="row" style={{ flexWrap: 'nowrap' }}><span className="num neg" style={{ minWidth: 76 }}>{money(r.T.spent)}</span><div className="tbar grow"><i style={{ width: `${(r.T.spent / maxSpent) * 100}%`, background: r.color }} /></div></div></td>
                <td className="r num">{r.T.nPay}</td><td className="r num pos">{money(r.T.paid)}</td>
                <td className={`r num ${tone(r.T.net)}`}><b>{money(r.T.net)}</b></td><td className={`r num ${tone(r.T.roi)}`}>{pct(r.T.roi, 0)}</td>
                <td className="r num">{pct(r.evalRate, 0)}</td><td className="r num">{r.reachedP1}</td><td className="r num">{money(r.costPerPayout, 0)}</td>
              </tr>))}</tbody>
          </table></div>
        ) : <Empty title="Aucune donnée sur cette période" />}
      </Panel>
      {rows.length > 0 && (
        <div className="grid g2" style={{ marginTop: 16 }}>
          <Panel title="Net par firm"><HBars data={rows.map(r => ({ name: r.name, value: r.T.net, color: r.color }))} /></Panel>
          <Panel title="ROI par firm" sub="net ÷ dépensé"><HBars data={rows.filter(r => r.T.spent).map(r => ({ name: r.name, value: r.T.roi, color: r.color }))} fmt={v => pct(v, 0)} /></Panel>
        </div>
      )}
    </>
  );
}
