import type { Engine } from './logic';
import type { Account, Firm, Tx, TxType } from './types';
import { fmtD, normDate, uid, CATEGORICAL } from './utils';

export function parseCsv(text: string): string[][] {
  const first = text.split('\n')[0] || '';
  const sep = first.includes('\t') ? '\t' : first.split(';').length > first.split(',').length ? ';' : ',';
  const rows: string[][] = []; let row: string[] = [], cur = '', inq = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inq) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else inq = false; } else cur += c; }
    else if (c === '"') inq = true;
    else if (c === sep) { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c !== '\r') cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim()));
}

const TYPES: TxType[] = ['purchase', 'reset', 'activation', 'fee', 'payout'];
function normType(s: string): TxType {
  const t = s.trim().toLowerCase();
  if (t.startsWith('pay') || t.startsWith('retrait')) return 'payout';
  if (t.startsWith('res')) return 'reset';
  if (t.startsWith('act')) return 'activation';
  if (t.startsWith('pur') || t.startsWith('buy') || t.startsWith('ach')) return 'purchase';
  return (TYPES as string[]).includes(t) ? (t as TxType) : t ? 'fee' : 'purchase';
}
const amountOf = (s: string) => { const n = Number(String(s).replace(/\s/g, '').replace(/[$€]/g, '').replace(/,(\d{1,2})$/, '.$1').replace(/,/g, '')); return isFinite(n) ? Math.abs(n) : 0; };

/** Transforme un CSV (format PROPA) en lignes à enregistrer. Ne modifie rien : l'appelant enregistre. */
export function importCsv(E: Engine, text: string) {
  const rows = parseCsv(text.trim());
  if (rows.length < 2) return { error: 'Il faut une ligne d’en-tête et au moins une ligne de données.' } as const;
  const h = rows[0].map(x => x.trim().toLowerCase());
  const ix = (k: string) => h.indexOf(k);
  if (ix('date') < 0 || ix('amount') < 0 || ix('firm') < 0) return { error: 'L’en-tête doit contenir au moins date, firm et amount.' } as const;
  const get = (r: string[], k: string) => (ix(k) >= 0 ? (r[ix(k)] || '').trim() : '');

  const newFirms: Firm[] = [];
  const firmId = (name: string) => {
    const f = E.firmByName(name) || newFirms.find(x => x.name.toLowerCase() === name.toLowerCase());
    if (f) return f.id;
    const i = E.firms.length + newFirms.length;
    const nf: Firm = { id: uid(), name, color: CATEGORICAL[i % CATEGORICAL.length], eval_days: null, buffer_days: null, funded_days: null, max_payouts: 4, price: null, split: 90, has_buffer: true, sort: i };
    newFirms.push(nf); return nf.id;
  };
  const byName = new Map<string, Account>(E.accounts.map(a => [a.name, a]));
  const accounts = new Map<string, Account>();
  const stageOf = new Map<string, string>();
  const tx: Tx[] = [];
  let skipped = 0;

  for (const r of rows.slice(1)) {
    const date = normDate(get(r, 'date')), firm = get(r, 'firm'), amount = amountOf(get(r, 'amount'));
    if (!date || !firm) { skipped++; continue; }
    const type = normType(get(r, 'type'));
    const fid = firmId(firm);
    const name = get(r, 'account');
    let acc = name ? byName.get(name) || null : null;
    if (!acc && (type === 'purchase' || (name && type !== 'fee'))) {
      const nm = name || `${firm.slice(0, 3).toUpperCase()}-${String(accounts.size + 1).padStart(3, '0')}`;
      acc = { id: uid(), name: nm, firm_id: fid, size: get(r, 'size').toUpperCase(), plan: get(r, 'plan'), dll: get(r, 'dll').toUpperCase(), consistency: get(r, 'consistency'), label: get(r, 'combination'),
        bought_on: date, phase: 'eval', cycle: 1, days: 0, days_needed: null, max_payouts: null, status: 'active', end_date: null, parent_id: null, notes: '' };
      byName.set(nm, acc); accounts.set(acc.id, acc);
    }
    const st = get(r, 'stage').toLowerCase();
    if (acc && st) stageOf.set(acc.id, st);
    tx.push({ id: uid(), date, type, firm_id: fid, account_id: acc ? acc.id : null, amount, gross: null, split: null, note: get(r, 'note') });
  }

  // Étape de chaque compte importé (d'après « stage » et ses payouts)
  for (const a of accounts.values()) {
    const mine = tx.filter(t => t.account_id === a.id).sort((x, y) => (x.date < y.date ? -1 : 1));
    const nPay = mine.filter(t => t.type === 'payout').length;
    const st = stageOf.get(a.id) || '';
    const last = mine[mine.length - 1]?.date || a.bought_on;
    if (st.startsWith('dead') || st.startsWith('fail') || st.startsWith('mort') || st.startsWith('cram')) { a.status = 'dead'; a.end_date = last; a.phase = nPay ? 'followup' : 'eval'; a.cycle = nPay + 1; }
    else if (st.startsWith('comp') || st.startsWith('term')) { a.status = 'completed'; a.end_date = last; a.phase = 'followup'; a.cycle = Math.max(nPay, 1); if (nPay) a.max_payouts = nPay; }
    else if (st.startsWith('buf')) a.phase = 'buffer';
    else if (st.startsWith('fol') || st.startsWith('fund') || nPay) { a.phase = 'followup'; a.cycle = nPay + 1; }
  }
  return { firms: newFirms, accounts: [...accounts.values()], tx, skipped };
}

export function toCsv(E: Engine) {
  const q = (v: unknown) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const rows = [['date', 'type', 'firm', 'account', 'amount', 'size', 'stage', 'note', 'plan', 'dll', 'consistency', 'combination']];
  [...E.txs].sort((a, b) => (a.date < b.date ? -1 : 1)).forEach(t => {
    const a = t.account_id ? E.d.accounts[t.account_id] : null;
    const stage = a && t.type === 'purchase' ? (a.status === 'active' ? a.phase : a.status) : '';
    rows.push([fmtD(t.date), t.type, E.firm(t.firm_id).name, a?.name || '', String(t.amount), a?.size || '', stage, t.note, a?.plan || '', a?.dll || '', a?.consistency || '', a?.label || '']);
  });
  return rows.map(r => r.map(q).join(',')).join('\n');
}

export const AI_PROMPT = `Transforme ces documents en CSV avec cet en-tête : date,type,firm,account,amount,size,stage,note
date = jj/mm/aaaa
type = purchase, reset, activation, fee ou payout
amount = ce que j'ai réellement payé ou reçu (payouts après le split)
stage = eval, buffer, followup, dead ou completed
Une ligne par achat / reset / payout.`;
