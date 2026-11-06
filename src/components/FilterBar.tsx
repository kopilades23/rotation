import { useMemo } from 'react';
import { useUi } from '../lib/hooks';
import { rangeOf } from '../lib/stats';
import { fmtD, monthLong, parseYmd, ymd } from '../lib/utils';
import { Segmented } from './ui';

const PRESETS = [
  { value: 'all', label: 'Tout' }, { value: 'today', label: 'Aujourd’hui' }, { value: '7d', label: '7 j' }, { value: '30d', label: '30 j' },
  { value: 'month', label: 'Ce mois' }, { value: 'lastmonth', label: 'Mois dernier' }, { value: 'ytd', label: 'Cette année' },
];

export function FilterBar({ showFirm = true }: { showFirm?: boolean }) {
  const { filters: f, setFilters, E } = useUi();
  const r = rangeOf(f);
  const months = useMemo(() => [...new Set([...E.txs.map(t => t.date.slice(0, 7)), ...E.accounts.map(a => a.bought_on.slice(0, 7))])].sort().reverse(), [E]);
  const curMonth = f.preset === 'custom' && f.from.endsWith('-01') && f.to && ymd(new Date(parseYmd(f.from).getFullYear(), parseYmd(f.from).getMonth() + 1, 0)) === f.to ? f.from.slice(0, 7) : '';
  return (
    <div className="filters">
      <Segmented id="preset" value={f.preset === 'custom' ? ('' as string) : f.preset} onChange={v => setFilters({ preset: v })} options={PRESETS} />
      <select value={curMonth} onChange={e => { const m = e.target.value; if (!m) return; const [y, mo] = m.split('-').map(Number); setFilters({ preset: 'custom', from: m + '-01', to: ymd(new Date(y, mo, 0)) }); }} aria-label="Choisir un mois">
        <option value="">Mois…</option>
        {months.map(m => <option key={m} value={m}>{monthLong(m)}</option>)}
      </select>
      <input type="date" value={r.from} onChange={e => setFilters({ preset: 'custom', from: e.target.value, to: f.preset === 'custom' ? f.to : r.to })} aria-label="Du" />
      <input type="date" value={r.to} onChange={e => setFilters({ preset: 'custom', to: e.target.value, from: f.preset === 'custom' ? f.from : r.from })} aria-label="Au" />
      {showFirm && (
        <select value={f.firm} onChange={e => setFilters({ firm: e.target.value })} aria-label="Prop firm">
          <option value="all">Toutes les firms</option>
          {E.firms.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
      )}
      <span className="range-l">{r.from || r.to ? `${fmtD(r.from) || '…'} au ${fmtD(r.to) || '…'}` : 'Toutes les dates'}</span>
    </div>
  );
}
