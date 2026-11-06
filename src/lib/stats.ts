import type { Engine } from './logic';
import type { Account, Ev, Tx } from './types';
import { addDays, avg, daysBetween, median, monthLabel, numList, parseYmd, shortDate, sum, today, ymd } from './utils';

export interface Filters { preset: string; from: string; to: string; firm: string }

export function rangeOf(f: Filters): { from: string; to: string } {
  const t = new Date(), td = today();
  switch (f.preset) {
    case 'today': return { from: td, to: td };
    case '7d': return { from: addDays(td, -6), to: td };
    case '30d': return { from: addDays(td, -29), to: td };
    case 'month': return { from: ymd(new Date(t.getFullYear(), t.getMonth(), 1)), to: ymd(new Date(t.getFullYear(), t.getMonth() + 1, 0)) };
    case 'lastmonth': return { from: ymd(new Date(t.getFullYear(), t.getMonth() - 1, 1)), to: ymd(new Date(t.getFullYear(), t.getMonth(), 0)) };
    case 'ytd': return { from: t.getFullYear() + '-01-01', to: td };
    case 'custom': return { from: f.from, to: f.to };
    default: return { from: '', to: '' };
  }
}
const inR = (d: string | null | undefined, r: { from: string; to: string }) => !!d && (!r.from || d >= r.from) && (!r.to || d <= r.to);

export function filtered(E: Engine, f: Filters) {
  const r = rangeOf(f);
  const okF = (id: string | null | undefined) => f.firm === 'all' || id === f.firm;
  return {
    r,
    accs: E.accounts.filter(a => inR(a.bought_on, r) && okF(a.firm_id)),
    txs: E.txs.filter(t => inR(t.date, r) && okF(t.firm_id)),
    evs: E.evs.filter(e => inR(e.date, r) && okF(e.firm_id)),
    allAccs: E.accounts.filter(a => okF(a.firm_id)),
    allTxs: E.txs.filter(t => okF(t.firm_id)),
    allEvs: E.evs.filter(e => okF(e.firm_id)),
  };
}

export function totals(txs: Tx[]) {
  let spent = 0, paid = 0, nPay = 0, nBuy = 0;
  for (const t of txs) {
    const a = +t.amount || 0;
    if (t.type === 'payout') { paid += a; nPay++; } else { spent += a; if (t.type === 'purchase' || t.type === 'reset') nBuy++; }
  }
  return { spent, paid, net: paid - spent, roi: spent ? (paid - spent) / spent : NaN, nPay, nBuy, multiple: spent ? paid / spent : NaN };
}

const WIN: Ev['type'][] = ['win', 'pass_eval', 'buffer_done'];
const LOSS: Ev['type'][] = ['died', 'red'];

export function tradeStats(evs: Ev[]) {
  const trades = evs.filter(e => WIN.includes(e.type) || LOSS.includes(e.type)).sort((a, b) => a.ts - b.ts);
  const wins = trades.filter(e => WIN.includes(e.type)).length;
  const losses = trades.length - wins;
  let cur = 0, curWin = true, bestWin = 0, worstLoss = 0, run = 0, runWin: boolean | null = null;
  for (const e of trades) {
    const w = WIN.includes(e.type);
    if (runWin === w) run++; else { run = 1; runWin = w; }
    if (w) bestWin = Math.max(bestWin, run); else worstLoss = Math.max(worstLoss, run);
  }
  if (runWin != null) { cur = run; curWin = runWin; }
  const wd = Array.from({ length: 7 }, (_, i) => ({ i, name: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'][i], wins: 0, losses: 0, rate: NaN }));
  for (const e of trades) { const k = (parseYmd(e.date).getDay() + 6) % 7; if (WIN.includes(e.type)) wd[k].wins++; else wd[k].losses++; }
  wd.forEach(w => (w.rate = w.wins + w.losses ? w.wins / (w.wins + w.losses) : NaN));
  return { n: trades.length, wins, losses, winRate: trades.length ? wins / trades.length : NaN, cur, curWin, bestWin, worstLoss, weekday: wd };
}

/** Bankroll : départ + résultat net de toutes les entrées depuis la date de départ (toutes firms) */
export function bankroll(E: Engine, s: { start_bankroll: number | null; start_date: string | null; goal: number | null }) {
  if (s.start_bankroll == null) return null;
  const dates = E.txs.map(t => t.date).sort();
  const from = s.start_date || dates[0] || today();
  const txs = E.txs.filter(t => t.date >= from);
  const dn = dailyNet(txs);
  const end = [today(), ...dates].sort().pop()!;
  const pts: { d: string; v: number; net: number }[] = [];
  let v = s.start_bankroll;
  for (let d = from; d <= end; d = addDays(d, 1)) { const n = dn.get(d)?.net || 0; v += n; pts.push({ d, v, net: n }); }
  const current = v;
  const monthKey = today().slice(0, 7);
  const before = pts.filter(p => p.d < monthKey + '-01');
  const monthStart = before.length ? before[before.length - 1].v : s.start_bankroll;
  const peak = Math.max(s.start_bankroll, ...pts.map(p => p.v));
  return {
    start: s.start_bankroll, from, current, pts, goal: s.goal,
    delta: current - s.start_bankroll, deltaPct: s.start_bankroll ? (current - s.start_bankroll) / s.start_bankroll : NaN,
    monthStart, monthDelta: current - monthStart, monthPct: monthStart ? (current - monthStart) / monthStart : NaN,
    peak, fromPeak: current - peak,
  };
}

/** Bankroll en début et fin de chaque mois */
export function monthlyBankroll(E: Engine, s: { start_bankroll: number | null; start_date: string | null; goal: number | null }) {
  const b = bankroll(E, s); const m = new Map<string, { open: number; close: number }>();
  if (!b) return m;
  let prev = b.start;
  b.pts.forEach(p => { const k = p.d.slice(0, 7); const r = m.get(k); if (!r) m.set(k, { open: prev, close: p.v }); else r.close = p.v; prev = p.v; });
  return m;
}

export function overview(E: Engine, f: Filters, settings: { start_bankroll: number | null; start_date: string | null; goal: number | null }) {
  const F = filtered(E, f);
  const T = totals(F.txs);
  const allT = totals(F.allTxs);
  const accs = F.accs;
  const reachedP = (a: Account, k: number) => E.level(a) >= 2 + k || E.payoutsOf(a).length >= k;

  const active = accs.filter(a => a.status === 'active');
  const dead = accs.filter(a => a.status === 'dead');
  const funded = accs.filter(a => E.level(a) >= 1 || E.payoutsOf(a).length > 0);
  const paidAcc = accs.filter(a => reachedP(a, 1));
  const accCost = sum(accs.map(E.costOf));

  const stages = E.stageStats(accs);
  const maxP = Math.min(6, Math.max(0, ...accs.map(a => E.maxP(a))));
  const funnel = [
    { key: 'bought', label: 'Achetés', n: accs.length, rate: NaN, open: 0 },
    { key: 'eval', label: 'Éval validée', n: accs.filter(a => E.level(a) >= 1 || E.payoutsOf(a).length > 0).length, rate: stages[0]?.actual ?? NaN, open: stages[0]?.active ?? 0 },
    { key: 'buffer', label: 'Buffer validé', n: accs.filter(a => E.level(a) >= 2 || E.payoutsOf(a).length > 0).length, rate: stages.find(s => s.i === 1)?.actual ?? NaN, open: stages.find(s => s.i === 1)?.active ?? 0 },
    ...Array.from({ length: maxP }, (_, k) => {
      const st = stages.find(s => s.i === 2 + k);
      return { key: 'p' + (k + 1), label: `${k + 1}${k ? 'e' : 'er'} payout`, n: accs.filter(a => reachedP(a, k + 1)).length, rate: st?.actual ?? NaN, open: st?.active ?? 0 };
    }),
  ];

  // État actuel (indépendant de la période, filtré par firm)
  const nowActive = F.allAccs.filter(a => a.status === 'active');
  const capitalInPlay = sum(nowActive.map(E.costOf));
  const payByKey = new Map<string, number[]>(), payByFirm = new Map<string, number[]>();
  E.txs.filter(t => t.type === 'payout').forEach(t => {
    const a = t.account_id ? E.d.accounts[t.account_id] : null;
    if (a) { const k = E.planKey(a); payByKey.set(k, [...(payByKey.get(k) || []), +t.amount]); }
    payByFirm.set(t.firm_id, [...(payByFirm.get(t.firm_id) || []), +t.amount]);
  });
  const globalAvgPay = avg(E.txs.filter(t => t.type === 'payout').map(t => +t.amount));
  const inFollow = nowActive.filter(a => a.phase === 'followup');
  const pipelineValue = sum(inFollow.map(a => {
    const k = payByKey.get(E.planKey(a)); if (k?.length) return avg(k);
    const p = E.planFor(a); const pl = p ? numList(p.payouts) : []; const mp = pl[(a.cycle || 1) - 1];
    if (mp != null) return mp;
    const fl = payByFirm.get(a.firm_id); if (fl?.length) return avg(fl);
    return isFinite(globalAvgPay) ? globalAvgPay : 0;
  }));
  const byPhase = { eval: 0, buffer: 0, followup: 0 };
  nowActive.forEach(a => byPhase[a.phase]++);

  const payAmounts = F.txs.filter(t => t.type === 'payout').map(t => +t.amount);

  return {
    F, T, allT, accs, active, dead, funded, paidAcc, accCost, stages, funnel,
    capitalInPlay, pipelineValue, inFollow: inFollow.length, nowActive: nowActive.length, byPhase,
    avgPayout: T.nPay ? T.paid / T.nPay : NaN, medianPayout: median(payAmounts), bestPayout: payAmounts.length ? Math.max(...payAmounts) : NaN,
    costPerPayout: T.nPay ? T.spent / T.nPay : NaN,
    costPerFunded: funded.length ? accCost / funded.length : NaN,
    payoutsPerFunded: funded.length ? sum(funded.map(a => E.payoutsOf(a).length)) / funded.length : NaN,
    trades: tradeStats(F.evs),
    goal: settings.goal,
  };
}

/** Séries temporelles : par jour si la période fait ≤ 62 jours, sinon par mois */
export function series(F: ReturnType<typeof filtered>) {
  const dates = [...F.txs.map(t => t.date), ...F.accs.map(a => a.bought_on)].filter(Boolean).sort();
  const lo = F.r.from || dates[0], hi = F.r.to || dates[dates.length - 1];
  if (!lo || !hi) return { daily: true, rows: [] as SeriesRow[] };
  const span = daysBetween(lo, hi);
  const daily = span <= 62;
  const key = (d: string) => (daily ? d : d.slice(0, 7));
  const keys: string[] = [];
  if (daily) { for (let d = lo; d <= hi; d = addDays(d, 1)) keys.push(d); }
  else { const s = parseYmd(lo); const e = parseYmd(hi); for (let d = new Date(s.getFullYear(), s.getMonth(), 1); d <= e; d.setMonth(d.getMonth() + 1)) keys.push(ymd(d).slice(0, 7)); }
  const m = new Map<string, SeriesRow>(keys.map(k => [k, { k, label: daily ? shortDate(k) : monthLabel(k), spent: 0, paid: 0, net: 0, cum: 0, bought: 0 }]));
  F.txs.forEach(t => { const r = m.get(key(t.date)); if (!r) return; if (t.type === 'payout') r.paid += +t.amount; else r.spent += +t.amount; });
  F.accs.forEach(a => { const r = m.get(key(a.bought_on)); if (r) r.bought++; });
  let c = 0;
  const rows = keys.map(k => { const r = m.get(k)!; r.net = r.paid - r.spent; c += r.net; r.cum = c; return r; });
  return { daily, rows };
}
export interface SeriesRow { k: string; label: string; spent: number; paid: number; net: number; cum: number; bought: number }

export function drawdown(rows: SeriesRow[]) {
  let peak = 0, dd = 0, c = 0;
  for (const r of rows) { c = r.cum; peak = Math.max(peak, c); dd = Math.max(dd, peak - c); }
  return dd;
}

/** plus forte baisse du résultat cumulé, jour par jour */
export function drawdownDaily(txs: Tx[]) {
  const m = dailyNet(txs); let c = 0, peak = 0, dd = 0;
  [...m.keys()].sort().forEach(k => { c += m.get(k)!.net; peak = Math.max(peak, c); dd = Math.max(dd, peak - c); });
  return dd;
}

export function monthly(E: Engine, txs: Tx[], accs: Account[], evs: Ev[]) {
  const m = new Map<string, { k: string; spent: number; paid: number; nPay: number; bought: number; deaths: number; wins: number; losses: number }>();
  const g = (k: string) => { if (!m.has(k)) m.set(k, { k, spent: 0, paid: 0, nPay: 0, bought: 0, deaths: 0, wins: 0, losses: 0 }); return m.get(k)!; };
  txs.forEach(t => { const r = g(t.date.slice(0, 7)); if (t.type === 'payout') { r.paid += +t.amount; r.nPay++; } else r.spent += +t.amount; });
  accs.forEach(a => { g(a.bought_on.slice(0, 7)).bought++; if (a.status === 'dead' && a.end_date) g(a.end_date.slice(0, 7)).deaths++; });
  evs.forEach(e => { if (WIN.includes(e.type)) g(e.date.slice(0, 7)).wins++; else if (LOSS.includes(e.type)) g(e.date.slice(0, 7)).losses++; });
  return [...m.values()].sort((a, b) => (a.k < b.k ? 1 : -1)).map(r => ({ ...r, net: r.paid - r.spent, roi: r.spent ? (r.paid - r.spent) / r.spent : NaN, winRate: r.wins + r.losses ? r.wins / (r.wins + r.losses) : NaN }));
}

export function dailyNet(txs: Tx[]) {
  const m = new Map<string, { net: number; spent: number; paid: number }>();
  txs.forEach(t => { const r = m.get(t.date) || { net: 0, spent: 0, paid: 0 }; if (t.type === 'payout') r.paid += +t.amount; else r.spent += +t.amount; r.net = r.paid - r.spent; m.set(t.date, r); });
  return m;
}

export function timing(E: Engine, accs: Account[]) {
  const passEval: number[] = [], firstPay: number[] = [], lifeDead: number[] = [], between: number[] = [];
  const passByAcc = new Map<string, string>();
  E.evs.forEach(e => { if (e.type === 'pass_eval' && e.account_id) { const p = passByAcc.get(e.account_id); if (!p || e.date < p) passByAcc.set(e.account_id, e.date); } });
  for (const a of accs) {
    const pe = passByAcc.get(a.id); if (pe) passEval.push(daysBetween(a.bought_on, pe));
    const pays = E.payoutsOf(a);
    if (pays.length) firstPay.push(daysBetween(a.bought_on, pays[0].date));
    for (let i = 1; i < pays.length; i++) between.push(daysBetween(pays[i - 1].date, pays[i].date));
    if (a.status === 'dead' && a.end_date) lifeDead.push(daysBetween(a.bought_on, a.end_date));
  }
  return { passEval: avg(passEval), firstPay: avg(firstPay), lifeDead: avg(lifeDead), between: avg(between), nFirst: firstPay.length };
}

export function deathsByStage(E: Engine, accs: Account[]) {
  const m = new Map<number, number>();
  accs.filter(a => a.status === 'dead').forEach(a => m.set(E.level(a), (m.get(E.level(a)) || 0) + 1));
  return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([i, n]) => ({ i, name: E.stepName(i), n }));
}

export function evalDeathDays(E: Engine, accs: Account[]) {
  const dead = accs.filter(a => a.status === 'dead' && a.phase === 'eval');
  const m = new Map<number, number>();
  dead.forEach(a => { const d = (a.days || 0) + 1; m.set(d, (m.get(d) || 0) + 1); });
  // modèle : P(mourir au jour d | mort en éval) = Π p(k<d) × (1 − p(d)) / (1 − Π p)
  const plansUsed = new Set(dead.map(a => E.planFor(a)?.id || ''));
  const pl = plansUsed.size === 1 ? E.planFor(dead[0]) : null;
  const pDay = pl ? numList(pl.p_eval_day).map(x => (x == null ? null : x / 100)).filter((x): x is number => x != null) : [];
  const all = pDay.reduce((s, x) => s * x, 1);
  const model = (d: number) => { if (!pDay.length || d > pDay.length) return NaN; let pre = 1; for (let k = 0; k < d - 1; k++) pre *= pDay[k]; return (pre * (1 - pDay[d - 1])) / (1 - all); };
  return { total: dead.length, rows: [...m.entries()].sort((a, b) => a[0] - b[0]).map(([d, n]) => ({ d, n, share: n / dead.length, model: model(d) })), pDay };
}

export function groupRows(E: Engine, accs: Account[], txs: Tx[], by: 'firm' | 'plan') {
  const keyOf = (a: Account) => (by === 'firm' ? a.firm_id : E.planKey(a));
  const groups = new Map<string, Account[]>();
  accs.forEach(a => { const k = keyOf(a); groups.set(k, [...(groups.get(k) || []), a]); });
  const txGroup = new Map<string, Tx[]>();
  txs.forEach(t => {
    const a = t.account_id ? E.d.accounts[t.account_id] : null;
    const k = by === 'firm' ? t.firm_id : a ? E.planKey(a) : `${E.firm(t.firm_id).name} frais divers`;
    txGroup.set(k, [...(txGroup.get(k) || []), t]);
  });
  const keys = new Set([...groups.keys(), ...txGroup.keys()]);
  return [...keys].map(k => {
    const ga = groups.get(k) || [], T = totals(txGroup.get(k) || []);
    const resolvedEval = ga.filter(a => E.level(a) > 0 || a.status === 'dead');
    const passEval = ga.filter(a => E.level(a) > 0);
    const reachedP1 = ga.filter(a => E.level(a) >= 3 || E.payoutsOf(a).length > 0).length;
    const firmId = by === 'firm' ? k : ga[0]?.firm_id || txGroup.get(k)?.[0]?.firm_id || '';
    return {
      key: k, name: by === 'firm' ? E.firm(k).name : k, color: E.firm(firmId).color, firmId,
      bought: ga.length, active: ga.filter(a => a.status === 'active').length, dead: ga.filter(a => a.status === 'dead').length,
      T, evalRate: resolvedEval.length ? passEval.length / resolvedEval.length : NaN, reachedP1,
      costPerPayout: T.nPay ? T.spent / T.nPay : NaN, avgPayout: T.nPay ? T.paid / T.nPay : NaN,
    };
  }).filter(r => r.bought || r.T.spent || r.T.paid).sort((a, b) => b.T.net - a.T.net);
}

export function payoutHistogram(amounts: number[]) {
  if (!amounts.length) return [];
  const max = Math.max(...amounts);
  const step = max <= 1000 ? 100 : max <= 3000 ? 250 : max <= 8000 ? 500 : 1000;
  const bins = new Map<number, number>();
  amounts.forEach(a => { const b = Math.floor(a / step) * step; bins.set(b, (bins.get(b) || 0) + 1); });
  const out = [];
  for (let b = Math.floor(Math.min(...amounts) / step) * step; b <= max; b += step) out.push({ from: b, to: b + step, n: bins.get(b) || 0 });
  return out;
}

/** Comparaison modèle (ta feuille de calcul) vs réel, par plan */
export function planModel(E: Engine, key: string) {
  const pa = E.accounts.filter(a => E.planKey(a) === key);
  const pl = pa.length ? E.planFor(pa[0]) : null;
  const ids = new Set(pa.map(a => a.id));
  const ptx = E.txs.filter(t => t.account_id && ids.has(t.account_id));
  const spent = sum(ptx.filter(t => t.type !== 'payout').map(t => +t.amount));
  const resolvedEval = pa.filter(a => E.level(a) > 0 || a.status === 'dead');
  const funded = pa.filter(a => E.level(a) >= 1);
  const mp = pl?.max_payouts || (pa[0] ? E.maxP(pa[0]) : 4);
  const payK: number[][] = [];
  pa.forEach(a => E.payoutsOf(a).forEach((t, k) => { (payK[k] = payK[k] || []).push(+t.amount); }));
  const paid = sum(payK.flat());
  const M: { pe?: number; tries?: number; evalCost?: number; reach: (number | null)[]; pay: (number | null)[]; expPay?: number; ev?: number; roi?: number; evals1?: number; cost1?: number } = { reach: [], pay: [] };
  if (pl) {
    const pe = pl.p_eval != null ? pl.p_eval / 100 : null, pb = pl.p_buffer != null ? pl.p_buffer / 100 : null;
    const fl = numList(pl.p_follow).map(x => (x == null ? null : x / 100));
    const pays = numList(pl.payouts);
    const first = pl.price_first || 0, reset = pl.price_reset || first;
    if (pe) { M.pe = pe; M.tries = 1 / pe; M.evalCost = first + (M.tries - 1) * reset; }
    let r: number | null = pb ?? (E.firm(pl.firm_id).has_buffer ? null : 1); // pas de buffer = étape franchie d'office
    for (let k = 0; k < mp; k++) { if (r == null || fl[k] == null) { M.reach.push(null); r = null; continue; } r *= fl[k]!; M.reach.push(r); }
    M.pay = Array.from({ length: mp }, (_, k) => pays[k] ?? null);
    if (M.reach.every(x => x != null) && M.pay.every(x => x != null)) {
      M.expPay = sum(M.reach.map((x, k) => x! * M.pay[k]!));
      if (M.evalCost != null) { M.ev = M.expPay - M.evalCost; M.roi = M.ev / M.evalCost; }
    }
    if (pe && M.reach[0]) { M.evals1 = 1 / (pe * M.reach[0]); M.cost1 = first + (M.evals1 - 1) * reset; }
  }
  const got1 = pa.filter(a => E.level(a) >= 3 || E.payoutsOf(a).length > 0).length;
  const A = {
    pe: resolvedEval.length ? funded.length / resolvedEval.length : NaN,
    tries: funded.length ? pa.length / funded.length : NaN,
    evalCost: funded.length ? spent / funded.length : NaN,
    reach: Array.from({ length: mp }, (_, k) => (funded.length ? pa.filter(a => E.level(a) >= 3 + k || E.payoutsOf(a).length > k).length / funded.length : NaN)),
    pay: Array.from({ length: mp }, (_, k) => (payK[k]?.length ? avg(payK[k]) : NaN)),
    expPay: funded.length ? paid / funded.length : NaN,
    ev: funded.length ? (paid - spent) / funded.length : NaN,
    roi: spent ? (paid - spent) / spent : NaN,
    evals1: got1 ? pa.length / got1 : NaN,
    cost1: got1 ? spent / got1 : NaN,
  };
  return { key, pl, n: pa.length, funded: funded.length, active: pa.filter(a => a.status === 'active').length, mp, M, A, firmColor: pa[0] ? E.firm(pa[0].firm_id).color : '#888' };
}
