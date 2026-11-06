import { useId, useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { money, pct, addDays, today, longDate, parseYmd } from '../lib/utils';

const AX = { stroke: 'transparent', tickLine: false, axisLine: false } as const;
const compact = (v: number) => {
  const a = Math.abs(v);
  const s = a >= 1000 ? (a / 1000).toFixed(a >= 10000 ? 0 : 1).replace('.', ',') + 'k' : String(Math.round(a));
  return (v < 0 ? '−' : '') + s + ' $';
};

type TTRow = { name: string; value: number; color: string; fmt?: (n: number) => string };
function TT({ title, rows }: { title: string; rows: TTRow[] }) {
  return (
    <div className="tt">
      <div className="tt-t">{title}</div>
      {rows.map(r => (
        <div className="tt-r" key={r.name}><span><i style={{ background: r.color }} />{r.name}</span><b className="num">{(r.fmt || money)(r.value)}</b></div>
      ))}
    </div>
  );
}

export function CumChart({ data, height = 270 }: { data: { label: string; cum: number; net: number }[]; height?: number }) {
  const id = useId().replace(/:/g, '');
  const { off } = useMemo(() => {
    const vals = data.map(d => d.cum);
    const max = Math.max(0, ...vals), min = Math.min(0, ...vals);
    return { off: max - min ? max / (max - min) : 1 };
  }, [data]);
  return (
    <div style={{ height }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={'s' + id} x1="0" y1="0" x2="0" y2="1">
              <stop offset={0} stopColor="#5fe3a9" /><stop offset={off} stopColor="#5fe3a9" />
              <stop offset={off} stopColor="#ff7b7b" /><stop offset={1} stopColor="#ff7b7b" />
            </linearGradient>
            <linearGradient id={'f' + id} x1="0" y1="0" x2="0" y2="1">
              <stop offset={0} stopColor="#45d6a0" stopOpacity={0.28} /><stop offset={off} stopColor="#45d6a0" stopOpacity={0.02} />
              <stop offset={off} stopColor="#ff8a7f" stopOpacity={0.02} /><stop offset={1} stopColor="#ff8a7f" stopOpacity={0.25} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="0" />
          <XAxis dataKey="label" {...AX} minTickGap={24} />
          <YAxis {...AX} tickFormatter={compact} width={56} />
          <ReferenceLine y={0} stroke="rgba(255,255,255,.16)" />
          <Tooltip cursor={{ stroke: 'rgba(255,255,255,.18)' }} content={({ active, payload, label }) => active && payload?.length ? (
            <TT title={String(label)} rows={[
              { name: 'Cumul net', value: payload[0].payload.cum, color: '#6f8cf0' },
              { name: 'Net de la période', value: payload[0].payload.net, color: '#9aa4bb' },
            ]} />) : null} />
          <Area type="monotone" dataKey="cum" stroke={`url(#s${id})`} strokeWidth={2} fill={`url(#f${id})`} animationDuration={900} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: '#06070a' }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SpendPaidChart({ data, height = 270 }: { data: { label: string; spent: number; paid: number }[]; height?: number }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="22%">
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" {...AX} minTickGap={16} />
          <YAxis {...AX} tickFormatter={compact} width={56} />
          <Tooltip cursor={{ fill: 'rgba(255,255,255,.03)' }} content={({ active, payload, label }) => active && payload?.length ? (
            <TT title={String(label)} rows={[
              { name: 'Payouts', value: payload[0].payload.paid, color: 'var(--c-paid)' },
              { name: 'Dépensé', value: payload[0].payload.spent, color: 'var(--c-spent)' },
              { name: 'Net', value: payload[0].payload.paid - payload[0].payload.spent, color: '#9aa4bb' },
            ]} />) : null} />
          <Bar dataKey="paid" fill="var(--c-paid)" radius={[4, 4, 0, 0]} maxBarSize={22} animationDuration={700} />
          <Bar dataKey="spent" fill="var(--c-spent)" radius={[4, 4, 0, 0]} maxBarSize={22} animationDuration={700} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function HBars({ data, fmt = money, height }: { data: { name: string; value: number; color: string; sub?: string }[]; fmt?: (n: number) => string; height?: number }) {
  const max = Math.max(1, ...data.map(d => Math.abs(d.value)));
  const hasNeg = data.some(d => d.value < 0);
  return (
    <div className="stack" style={{ gap: 12, height, alignContent: 'start' }}>
      {data.map(d => (
        <div key={d.name} title={`${d.name} : ${fmt(d.value)}`}>
          <div className="row" style={{ justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
            <span className="firm-cell"><span className="dot" style={{ background: d.color }} />{d.name}{d.sub && <span className="dim" style={{ fontSize: 12 }}>{d.sub}</span>}</span>
            <b className={`num ${hasNeg ? (d.value >= 0 ? 'pos' : 'neg') : ''}`} style={{ fontWeight: 600 }}>{fmt(d.value)}</b>
          </div>
          <div className="tbar"><i style={{ width: `${(Math.abs(d.value) / max) * 100}%`, background: d.color, transition: 'width .9s var(--ease)' }} /></div>
        </div>
      ))}
    </div>
  );
}

export function Bars({ data, color = '#6f8cf0', height = 220, fmt = (n: number) => String(n), name = 'Valeur', colors }: { data: { label: string; value: number }[]; color?: string; height?: number; fmt?: (n: number) => string; name?: string; colors?: string[] }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" {...AX} minTickGap={8} interval="preserveStartEnd" />
          <YAxis {...AX} allowDecimals={false} width={40} tickFormatter={v => fmt(v)} />
          <Tooltip cursor={{ fill: 'rgba(255,255,255,.03)' }} content={({ active, payload, label }) => active && payload?.length ? (
            <TT title={String(label)} rows={[{ name, value: payload[0].payload.value, color: colors?.[data.findIndex(d => d.label === label)] || color, fmt }]} />) : null} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={34} animationDuration={700}>
            {data.map((_, i) => <Cell key={i} fill={colors?.[i] || color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RateBars({ data, height = 240 }: { data: { label: string; actual: number | null; model: number | null }[]; height?: number }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" {...AX} />
          <YAxis {...AX} domain={[0, 1]} tickFormatter={v => Math.round(v * 100) + ' %'} width={46} />
          <Tooltip cursor={{ fill: 'rgba(255,255,255,.03)' }} content={({ active, payload, label }) => active && payload?.length ? (
            <TT title={String(label)} rows={[
              { name: 'Réel', value: payload[0].payload.actual, color: '#6f8cf0', fmt: v => pct(v) },
              { name: 'Modèle', value: payload[0].payload.model, color: '#c98500', fmt: v => pct(v) },
            ]} />) : null} />
          <Bar dataKey="actual" fill="#6f8cf0" radius={[4, 4, 0, 0]} maxBarSize={26} />
          <Bar dataKey="model" fill="#c98500" radius={[4, 4, 0, 0]} maxBarSize={26} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SurvivalChart({ data, height = 280 }: { data: { label: string; actual: number | null; model: number | null }[]; height?: number }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" {...AX} />
          <YAxis {...AX} domain={[0, 1]} tickFormatter={v => Math.round(v * 100) + ' %'} width={46} />
          <Tooltip content={({ active, payload, label }) => active && payload?.length ? (
            <TT title={String(label)} rows={[
              { name: 'Réel', value: payload[0].payload.actual, color: '#6f8cf0', fmt: v => pct(v) },
              { name: 'Modèle', value: payload[0].payload.model, color: '#c98500', fmt: v => pct(v) },
            ]} />) : null} />
          <Line dataKey="actual" stroke="#6f8cf0" strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: '#06070a' }} />
          <Line dataKey="model" stroke="#c98500" strokeWidth={2} strokeDasharray="6 4" dot={{ r: 4, strokeWidth: 2, stroke: '#06070a' }} connectNulls={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Calendrier : résultat net par jour sur les 26 dernières semaines */
export function Heatmap({ map, end = today(), weeks = 26 }: { map: Map<string, { net: number; spent: number; paid: number }>; end?: string; weeks?: number }) {
  const [hover, setHover] = useState<string | null>(null);
  const endD = parseYmd(end); const dow = (endD.getDay() + 6) % 7;
  const first = addDays(addDays(end, 6 - dow), -(weeks * 7 - 1)); // un lundi
  const days: string[] = [];
  for (let i = 0; i < weeks * 7; i++) days.push(addDays(first, i));
  const vals = days.map(d => map.get(d)?.net || 0);
  const maxP = Math.max(1, ...vals.filter(v => v > 0)), maxN = Math.max(1, ...vals.filter(v => v < 0).map(Math.abs));
  const col = (v: number) => {
    if (!v) return undefined;
    if (v > 0) { const t = 0.25 + 0.75 * Math.sqrt(v / maxP); return `rgba(31,168,120,${t.toFixed(2)})`; }
    const t = 0.2 + 0.7 * Math.sqrt(-v / maxN); return `rgba(224,104,58,${t.toFixed(2)})`;
  };
  const h = hover ? map.get(hover) : null;
  return (
    <div>
      <div className="heat-wrap">
        <div className="heat-days">{['L', '', 'M', '', 'V', '', 'D'].map((x, i) => <span key={i}>{x}</span>)}</div>
        <div className="heat" onMouseLeave={() => setHover(null)}>
          {days.map(d => (
            <i key={d} className={d > end ? 'out' : ''} style={{ background: col(map.get(d)?.net || 0) }}
              onMouseEnter={() => setHover(d)} aria-label={`${d} : ${money(map.get(d)?.net || 0)}`} />
          ))}
        </div>
      </div>
      <div className="heat-leg">
        <span style={{ minHeight: 18, flex: 1 }}>
          {hover ? <><span>{longDate(hover)}</span> — {h ? <>net <b className={h.net >= 0 ? 'pos' : 'neg'}>{money(h.net)}</b> ({money(h.paid)} reçus, {money(h.spent)} dépensés)</> : 'aucun mouvement'}</> : 'Survole un jour pour voir le détail'}
        </span>
        <span>Perte</span><i style={{ background: 'rgba(224,104,58,.8)' }} /><i style={{ background: 'rgba(224,104,58,.35)' }} /><i style={{ background: 'var(--bg-2)' }} /><i style={{ background: 'rgba(31,168,120,.4)' }} /><i style={{ background: 'rgba(31,168,120,.95)' }} /><span>Gain</span>
      </div>
    </div>
  );
}

export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  if (values.length < 2) return null;
  const w = 300, h = 70, min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - ((v - min) / span) * (h - 6) - 3]);
  const d = 'M' + pts.map(p => p.map(n => n.toFixed(1)).join(',')).join('L');
  return (
    <svg className={className} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs><linearGradient id="spk" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#f0c060" stopOpacity=".35" /><stop offset="1" stopColor="#f0c060" stopOpacity="0" /></linearGradient></defs>
      <path d={d + `L${w},${h}L0,${h}Z`} fill="url(#spk)" />
      <path d={d} fill="none" stroke="#f0c060" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Courbe de bankroll : départ en pointillés, objectif en pointillés champagne */
export function BankrollChart({ data, start, goal, height = 300 }: { data: { d: string; v: number; net: number }[]; start: number; goal: number | null; height?: number }) {
  const id = useId().replace(/:/g, '');
  const vals = data.map(p => p.v);
  const goalIn = goal != null && goal <= Math.max(start, ...vals) * 1.6 ? goal : null; // objectif trop loin : on ne l'affiche pas
  const lo = Math.min(start, ...vals), hi = Math.max(start, ...vals, goalIn ?? -Infinity);
  const pad = (hi - lo) * 0.12 || Math.abs(hi) * 0.05 || 10;
  const showGoal = goalIn != null;
  return (
    <div style={{ height }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
          <defs>
            <linearGradient id={'bs' + id} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#8d7dff" /><stop offset=".55" stopColor="#b8a6ff" /><stop offset="1" stopColor="#ecd49c" />
            </linearGradient>
            <linearGradient id={'bf' + id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ecd49c" stopOpacity={0.22} /><stop offset=".6" stopColor="#8d7dff" stopOpacity={0.06} /><stop offset="1" stopColor="#8d7dff" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="d" {...AX} minTickGap={60} tickFormatter={(d: string) => parseYmd(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} />
          <YAxis {...AX} domain={[lo - pad, hi + pad]} hide />
          <ReferenceLine y={start} stroke="rgba(255,255,255,.22)" strokeDasharray="3 5" label={{ value: `départ ${money(start)}`, position: 'insideBottomLeft', fill: '#5d636f', fontSize: 11.5 }} />
          {showGoal && <ReferenceLine y={goal!} stroke="rgba(236,212,156,.5)" strokeDasharray="3 5" label={{ value: `objectif ${money(goal!)}`, position: 'insideTopLeft', fill: '#c9a35b', fontSize: 11.5 }} />}
          <Tooltip cursor={{ stroke: 'rgba(255,255,255,.18)' }} content={({ active, payload }) => active && payload?.length ? (
            <TT title={longDate(payload[0].payload.d)} rows={[
              { name: 'Bankroll', value: payload[0].payload.v, color: '#ecd49c' },
              { name: 'Net du jour', value: payload[0].payload.net, color: '#9298a5' },
            ]} />) : null} />
          <Area type="monotone" dataKey="v" stroke={`url(#bs${id})`} strokeWidth={2.4} fill={`url(#bf${id})`} animationDuration={1400} animationEasing="ease-out"
            dot={false} activeDot={{ r: 5, strokeWidth: 3, stroke: '#06070a', fill: '#ecd49c' }} style={{ filter: 'drop-shadow(0 0 10px rgba(184,166,255,.45))' }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
