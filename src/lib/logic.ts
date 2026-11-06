import type { Account, Ev, Firm, Phase, Plan, Tables, Tx } from './types';
import { numList } from './utils';

/*
  Modèle d'étapes (repris de PROPA) :
  niveau 0 = Éval, 1 = Buffer, 2+k = Follow-up vers le payout k+1, 2+maxP = terminé.
  Un compte en follow-up « cycle 1 » vise son 1er payout ; après le payout k il passe au cycle k+1.
*/

const FALLBACK_FIRM: Firm = { id: '', name: 'Firm inconnue', color: '#6b7590', eval_days: null, buffer_days: null, funded_days: null, max_payouts: 4, price: null, split: 100, has_buffer: true, sort: 999 };
const norm = (x: unknown) => String(x ?? '').trim().toLowerCase();
const normSize = (x: unknown) => String(x ?? '').toUpperCase().replace(/\s+/g, '');
const OPT_KEYS = ['plan', 'dll', 'consistency', 'label'] as const;

export type Engine = ReturnType<typeof makeEngine>;

export function makeEngine(d: Tables) {
  const firms = Object.values(d.firms).sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
  const plans = Object.values(d.plans);
  const accounts = Object.values(d.accounts);
  const txs = Object.values(d.tx);
  const evs = Object.values(d.events);

  const txByAcc = new Map<string, Tx[]>();
  txs.forEach(t => { if (t.account_id) { const l = txByAcc.get(t.account_id) || []; l.push(t); txByAcc.set(t.account_id, l); } });
  txByAcc.forEach(l => l.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)));

  const firm = (id: string | null | undefined): Firm => (id && d.firms[id]) || { ...FALLBACK_FIRM, id: id || '' };
  const firmByName = (name: string) => firms.find(f => norm(f.name) === norm(name));

  const planCache = new Map<string, Plan | null>();
  function planFor(a: Pick<Account, 'firm_id' | 'size' | 'plan' | 'dll' | 'consistency' | 'label'>): Plan | null {
    const k = [a.firm_id, normSize(a.size), ...OPT_KEYS.map(x => norm(a[x]))].join('|');
    if (planCache.has(k)) return planCache.get(k)!;
    let best: Plan | null = null, bs = -1;
    for (const p of plans) {
      if (p.firm_id !== a.firm_id || normSize(p.size) !== normSize(a.size)) continue;
      let sc = 0, ok = true;
      for (const key of OPT_KEYS) { if (!norm(p[key])) continue; if (norm(p[key]) !== norm(a[key])) { ok = false; break; } sc++; }
      if (ok && sc > bs) { bs = sc; best = p; }
    }
    planCache.set(k, best);
    return best;
  }

  const autoMaxP = (a: Account) => planFor(a)?.max_payouts || firm(a.firm_id).max_payouts || 4;
  const maxP = (a: Account) => (a.max_payouts && a.max_payouts > 0 ? a.max_payouts : autoMaxP(a));
  const level = (a: Account) => {
    if (a.status === 'completed') return 2 + maxP(a);
    if (a.phase === 'eval') return 0;
    if (a.phase === 'buffer') return 1;
    return 1 + (a.cycle || 1);
  };
  const stepName = (i: number) => (i === 0 ? 'Éval' : i === 1 ? 'Buffer' : `Vers P${i - 1}`);
  const stageLabel = (a: Account) => {
    if (a.status === 'completed') return `Terminé, ${maxP(a)} payouts`;
    if (a.phase === 'eval') return 'Éval';
    if (a.phase === 'buffer') return 'Buffer';
    return `Follow-up vers P${a.cycle || 1}`;
  };
  const stageKey = (a: Account) => (a.status === 'dead' ? 'dead' : a.status === 'completed' ? 'completed' : a.phase);

  const planEvalDays = (p: Plan | null) => {
    if (!p) return null;
    if (p.eval_days != null) return p.eval_days;
    const n = numList(p.p_eval_day).length;
    return n || null;
  };
  function daysNeededFor(a: Pick<Account, 'firm_id' | 'size' | 'plan' | 'dll' | 'consistency' | 'label'>, phase: Phase, cycle: number): number | null {
    const f = firm(a.firm_id);
    if (phase === 'eval') return planEvalDays(planFor(a)) ?? f.eval_days;
    if (phase === 'buffer') return f.buffer_days;
    if (f.funded_days == null) return null;
    const per = f.funded_days;
    return (cycle || 1) === 1 && f.has_buffer && f.buffer_days != null ? Math.max(per - f.buffer_days, 0) : per;
  }
  const autoNeed = (a: Account) => daysNeededFor(a, a.phase, a.cycle);
  const needFor = (a: Account) => (a.days_needed != null ? a.days_needed : autoNeed(a));

  const txOf = (a: Account) => txByAcc.get(a.id) || [];
  const payoutsOf = (a: Account) => txOf(a).filter(t => t.type === 'payout');
  const costOf = (a: Account) => txOf(a).filter(t => t.type !== 'payout').reduce((s, t) => s + (+t.amount || 0), 0);
  const paidOf = (a: Account) => payoutsOf(a).reduce((s, t) => s + (+t.amount || 0), 0);

  const combo = (a: Pick<Account, 'plan' | 'size' | 'dll' | 'consistency' | 'label'>) =>
    [a.plan, String(a.size || '').toUpperCase(), a.dll ? 'DLL ' + a.dll : '', a.consistency ? 'Consist. ' + a.consistency : '', a.label]
      .filter(x => String(x || '').trim()).join(', ');
  const planKey = (a: Account) => `${firm(a.firm_id).name} ${combo(a) || 'sans plan'}`;

  const pc = (v: number | null | undefined) => (v == null ? null : v / 100);
  function stepProb(a: Account, i: number): number | null {
    const p = planFor(a);
    if (!p) return null;
    if (i === 0) return pc(p.p_eval);
    if (i === 1) return pc(p.p_buffer);
    const arr = numList(p.p_follow);
    return pc(arr[i - 2] ?? null);
  }

  /** progression pour le tri « le plus avancé d'abord » */
  function progress(a: Account) {
    const st = a.status === 'completed' ? 2 : a.status === 'active' ? 1 : 0;
    const need = needFor(a) || 0, dd = a.days || 0;
    const inStage = need ? Math.min(dd / need, 1) : Math.min(dd / 10, 0.99);
    return st * 1000 + level(a) * 10 + inStage * 9.99;
  }

  function stageStats(accs: Account[]) {
    const maxL = Math.max(6, ...accs.map(a => 2 + maxP(a)));
    const rows: { i: number; name: string; passed: number; died: number; active: number; attempts: number; modelN: number; expDeaths: number; actual: number; model: number }[] = [];
    for (let i = 0; i < maxL; i++) {
      let passed = 0, died = 0, active = 0, modelSum = 0, modelN = 0, expDeaths = 0, attempts = 0;
      for (const a of accs) {
        if (i >= 2 + maxP(a)) continue;
        if (i === 1 && !firm(a.firm_id).has_buffer) continue;
        const L = level(a);
        const p = stepProb(a, i);
        const tried = L > i || (L === i && a.status === 'dead');
        if (L > i) { passed++; attempts++; }
        else if (L === i && a.status === 'dead') { died++; attempts++; }
        else if (L === i && a.status === 'active') active++;
        if (tried && p != null) { modelSum += p; modelN++; expDeaths += 1 - p; }
      }
      if (passed + died + active === 0 && i >= 2) continue;
      rows.push({ i, name: stepName(i), passed, died, active, attempts, modelN, expDeaths, actual: attempts ? passed / attempts : NaN, model: modelN ? modelSum / modelN : NaN });
    }
    return rows;
  }

  return {
    firms, plans, accounts, txs, evs, d,
    firm, firmByName, planFor, autoMaxP, maxP, level, stepName, stageLabel, stageKey, daysNeededFor, autoNeed, needFor,
    txOf, payoutsOf, costOf, paidOf, combo, planKey, stepProb, progress, stageStats,
  };
}

export const EVENT_LABEL: Record<Ev['type'], string> = {
  win: 'Jour gagnant', red: 'DLL touchée', pass_eval: 'Éval validée', buffer_done: 'Buffer validé', payout: 'Payout', died: 'Compte cramé',
};
export const TX_LABEL: Record<Tx['type'], string> = {
  purchase: 'Achat de compte', reset: 'Reset', activation: "Frais d'activation", fee: 'Autre frais', payout: 'Payout',
};
export const STAGE_COLOR: Record<string, string> = {
  eval: '#8d7dff', buffer: '#2fd3bf', followup: '#ecd49c', completed: '#5fe3a9', dead: '#ff7b7b',
};
