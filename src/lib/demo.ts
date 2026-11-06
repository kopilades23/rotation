import type { Account, Ev, Firm, Plan, Tables, Tx } from './types';
import { addDays, parseYmd, today } from './utils';

/** Données fictives pour essayer l'app (rien de réel). Générateur déterministe. */
export function demoData(): { tables: Tables; settings: { start_bankroll: number; start_date: string; goal: number; handle: string } } {
  let seed = 42;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
  let n = 0; const id = (p: string) => `${p}${(++n).toString(36)}d`;

  const F = (name: string, color: string, o: Partial<Firm>, sort: number): Firm => ({ id: id('f'), name, color, eval_days: 2, buffer_days: 1, funded_days: 5, max_payouts: 5, price: 80, split: 90, has_buffer: true, sort, ...o });
  const lucid = F('Lucid Trading', '#3987e5', { price: 85, max_payouts: 5 }, 0);
  const tradeify = F('Tradeify', '#d95926', { price: 105, max_payouts: 4, buffer_days: null, has_buffer: false }, 1);
  const mff = F('MyFundedFutures', '#199e70', { price: 127, max_payouts: 4, eval_days: 3 }, 2);
  const topstep = F('Topstep', '#c98500', { price: 49, max_payouts: 4, eval_days: 3 }, 3);
  const firms = [lucid, tradeify, mff, topstep];

  const plans: Plan[] = [
    { id: id('p'), firm_id: lucid.id, plan: 'Flex', size: '25K', dll: 'ON', consistency: '50%', label: '', eval_days: null, p_eval: 42.3, p_eval_day: '65 65', p_buffer: 75, p_follow: '53 53 53 53 53', max_payouts: 5, price_first: 85, price_reset: 85, payouts: '1150 1000 950 900 850', source: 'Ma feuille Monte Carlo' },
    { id: id('p'), firm_id: tradeify.id, plan: 'Select', size: '25K', dll: '', consistency: '', label: '', eval_days: null, p_eval: 40, p_eval_day: '64 63', p_buffer: null, p_follow: '50 50 50 50', max_payouts: 4, price_first: 105, price_reset: 105, payouts: '1300 1100 1000 900', source: '' },
  ];

  const PROFILE: Record<string, { pE: number; pB: number; pF: number; pay: [number, number]; plan: string; size: string; dll: string; cons: string }> = {
    [lucid.id]: { pE: 0.6, pB: 0.7, pF: 0.8, pay: [650, 1100], plan: 'Flex', size: '25K', dll: 'ON', cons: '50%' },
    [tradeify.id]: { pE: 0.6, pB: 1, pF: 0.79, pay: [750, 1250], plan: 'Select', size: '25K', dll: '', cons: '' },
    [mff.id]: { pE: 0.66, pB: 0.7, pF: 0.8, pay: [900, 1500], plan: 'Rapid', size: '50K', dll: '', cons: '' },
    [topstep.id]: { pE: 0.66, pB: 0.68, pF: 0.78, pay: [500, 900], plan: 'Combine', size: '50K', dll: '', cons: '' },
  };

  const accounts: Account[] = [], tx: Tx[] = [], events: Ev[] = [];
  const end = today();
  const start = addDays(end, -150);
  const isWeekday = (d: string) => { const w = parseYmd(d).getDay(); return w !== 0 && w !== 6; };
  const ts = (d: string) => parseYmd(d).getTime() + (15.5 + rnd() * 5) * 3600e3;
  const counters = new Map<string, number>();

  for (let d = start; d <= end; d = addDays(d, 1)) {
    if (!isWeekday(d)) continue;
    const buys: Firm[] = [];
    const k = rnd(); const nL = k < 0.2 ? 1 : k < 0.75 ? 2 : 3;
    for (let i = 0; i < nL; i++) buys.push(lucid);
    if (rnd() < 0.35) buys.push(tradeify);
    if (rnd() < 0.08) buys.push(mff);
    if (d < addDays(end, -60) && rnd() < 0.1) buys.push(topstep);
    for (const f of buys) {
      const pr = PROFILE[f.id];
      const c = (counters.get(f.id) || 0) + 1; counters.set(f.id, c);
      const ab = f.name.split(' ')[0].slice(0, 3).toUpperCase();
      const a: Account = { id: id('a'), name: `${ab}${pr.size.replace('K', '')}-${String(c).padStart(3, '0')}`, firm_id: f.id, plan: pr.plan, size: pr.size, dll: pr.dll, consistency: pr.cons, label: '',
        bought_on: d, phase: 'eval', cycle: 1, days: 0, days_needed: null, max_payouts: null, status: 'active', end_date: null, parent_id: null, notes: '' };
      accounts.push(a);
      tx.push({ id: id('t'), date: d, type: 'purchase', firm_id: f.id, account_id: a.id, amount: f.price!, gross: null, split: null, note: '' });
      // simulation jour par jour
      let day = d;
      const ev = (type: Ev['type'], extra: Partial<Ev> = {}) => events.push({ id: id('e'), date: day, ts: ts(day), type, account_id: a.id, firm_id: f.id, phase: a.phase, cycle: a.cycle, day: a.days, amount: null, tx_id: null, note: '', ...extra });
      while (day <= end) {
        if (!isWeekday(day)) { day = addDays(day, 1); continue; }
        const need = a.phase === 'eval' ? f.eval_days! : a.phase === 'buffer' ? f.buffer_days! : a.cycle === 1 && f.has_buffer ? f.funded_days! - (f.buffer_days || 0) : f.funded_days!;
        const p = a.phase === 'eval' ? pr.pE : a.phase === 'buffer' ? pr.pB : pr.pF;
        if (day === end && rnd() < 0.55) break; // pas encore tradé aujourd'hui
        if (rnd() > p) { ev('died'); a.status = 'dead'; a.end_date = day; break; }
        if (a.days + 1 >= need) {
          if (a.phase === 'eval') { ev('pass_eval'); a.phase = f.has_buffer ? 'buffer' : 'followup'; a.days = 0; a.cycle = 1; }
          else if (a.phase === 'buffer') { ev('buffer_done'); a.phase = 'followup'; a.cycle = 1; a.days = 0; }
          else {
            ev('win'); const payDay = addDays(day, 1);
            if (payDay > end) { a.days = need; break; }
            const decay = 1 - (a.cycle - 1) * 0.08;
            const gross = Math.round((pr.pay[0] + rnd() * (pr.pay[1] - pr.pay[0])) * decay / 0.9 / 10) * 10;
            const amt = Math.round(gross * f.split!) / 100;
            const tid = id('t');
            tx.push({ id: tid, date: payDay, type: 'payout', firm_id: f.id, account_id: a.id, amount: amt, gross, split: f.split, note: '' });
            day = payDay; ev('payout', { amount: amt, tx_id: tid });
            a.cycle++; a.days = 0;
            if (a.cycle > f.max_payouts!) { a.status = 'completed'; a.end_date = day; break; }
          }
        } else { ev('win'); a.days++; }
        day = addDays(day, 1);
      }
    }
  }
  // quelques frais
  tx.push({ id: id('t'), date: addDays(start, 3), type: 'fee', firm_id: lucid.id, account_id: null, amount: 39, gross: null, split: null, note: 'Abonnement data' });
  tx.push({ id: id('t'), date: addDays(start, 33), type: 'fee', firm_id: lucid.id, account_id: null, amount: 39, gross: null, split: null, note: 'Abonnement data' });

  const rec = <T extends { id: string }>(a: T[]) => Object.fromEntries(a.map(x => [x.id, x]));
  return {
    tables: { firms: rec(firms), plans: rec(plans), accounts: rec(accounts), tx: rec(tx), events: rec(events) },
    settings: { start_bankroll: 1500, start_date: start, goal: 12000, handle: '@mon.compte' },
  };
}
