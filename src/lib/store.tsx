import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Row, Settings, TableName, Tables, Firm } from './types';
import { supabase } from './supabase';
import { CATEGORICAL, uid } from './utils';
import { useToast } from '../components/ui';

const DB: Record<TableName, string> = { firms: 'firms', plans: 'plans', accounts: 'accounts', tx: 'transactions', events: 'events' };
const ORDER: TableName[] = ['firms', 'plans', 'accounts', 'tx', 'events'];
const LS_KEY = 'rotation_journal_v1';

export const emptyTables = (): Tables => ({ firms: {}, plans: {}, accounts: {}, tx: {}, events: {} });
export const DEFAULT_SETTINGS: Settings & { seeded?: boolean } = { links: [], goal: null, start_bankroll: null, start_date: null, handle: '' };

const SEED_FIRMS = ['Lucid Trading', 'Tradeify', 'MyFundedFutures', 'Topstep', 'Apex Trader Funding', 'Take Profit Trader', 'Alpha Futures', 'FundedNext Futures'];
export const newFirm = (name: string, i: number): Firm => ({
  id: uid(), name, color: CATEGORICAL[i % CATEGORICAL.length], eval_days: null, buffer_days: null, funded_days: null,
  max_payouts: 4, price: null, split: 90, has_buffer: true, sort: i,
});

type Mode = 'cloud' | 'local';
interface DataState extends Tables { settings: Settings & { seeded?: boolean }; ready: boolean; mode: Mode; }
export interface DataApi extends DataState {
  upsert<T extends TableName>(t: T, rows: Row<T> | Row<T>[]): Promise<boolean>;
  remove(t: TableName, ids: string | string[]): Promise<boolean>;
  saveSettings(patch: Partial<Settings>): Promise<void>;
  replaceAll(tables: Tables, settings?: Partial<Settings>): Promise<boolean>;
  wipe(): Promise<void>;
  pending: number;
}

const Ctx = createContext<DataApi | null>(null);
export const useData = () => { const c = useContext(Ctx); if (!c) throw new Error('DataProvider manquant'); return c; };

const toRecord = <T extends { id: string }>(rows: T[]) => Object.fromEntries(rows.map(r => [r.id, r])) as Record<string, T>;
const clean = (r: Record<string, unknown>) => { const o = { ...r }; delete o.user_id; delete o.created_at; return o; };

async function fetchAll(table: string) {
  if (!supabase) return [];
  const out: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select('*').range(from, from + 999);
    if (error) throw error;
    out.push(...(data as Record<string, unknown>[]).map(clean));
    if (!data || data.length < 1000) break;
  }
  return out;
}
const chunks = <T,>(a: T[], n = 500) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

export function DataProvider({ cloud, userId, children }: { cloud: boolean; userId?: string; children: ReactNode }) {
  const toast = useToast();
  const mode: Mode = cloud && supabase ? 'cloud' : 'local';
  const [state, setState] = useState<DataState>(() => ({ ...emptyTables(), settings: DEFAULT_SETTINGS, ready: false, mode }));
  const ref = useRef(state); ref.current = state;
  const [pending, setPending] = useState(0);

  const fail = useCallback((e: unknown) => {
    const msg = (e as { message?: string })?.message || String(e);
    toast(`Échec de l'enregistrement : ${msg}`, 'error');
  }, [toast]);

  // Chargement
  useEffect(() => {
    let alive = true;
    (async () => {
      if (mode === 'local') {
        let t = emptyTables(), s = DEFAULT_SETTINGS;
        try { const j = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); if (j) { t = { ...t, ...j.tables }; s = { ...s, ...j.settings }; } } catch { /* stockage indisponible */ }
        if (!s.seeded && !Object.keys(t.firms).length) { t.firms = toRecord(SEED_FIRMS.map(newFirm)); s = { ...s, seeded: true }; }
        if (alive) setState({ ...t, settings: s, ready: true, mode });
        return;
      }
      try {
        const [firms, plans, accounts, tx, events, st] = await Promise.all([
          fetchAll('firms'), fetchAll('plans'), fetchAll('accounts'), fetchAll('transactions'), fetchAll('events'),
          supabase!.from('settings').select('data').maybeSingle(),
        ]);
        if (st.error) throw st.error;
        let settings = { ...DEFAULT_SETTINGS, ...((st.data?.data as Settings) || {}) };
        let f = toRecord(firms as unknown as Firm[]);
        if (!settings.seeded && !Object.keys(f).length) {
          const seed = SEED_FIRMS.map(newFirm);
          const { error } = await supabase!.from('firms').upsert(seed);
          if (!error) f = toRecord(seed);
          settings = { ...settings, seeded: true };
          await supabase!.from('settings').upsert({ user_id: userId, data: settings });
        }
        if (!alive) return;
        setState({
          firms: f, plans: toRecord(plans as never), accounts: toRecord(accounts as never), tx: toRecord(tx as never),
          events: toRecord(events as never), settings, ready: true, mode,
        });
      } catch (e) {
        fail(e);
        if (alive) setState(s => ({ ...s, ready: true }));
      }
    })();
    return () => { alive = false; };
  }, [mode, fail, userId]);

  // Sauvegarde locale
  useEffect(() => {
    if (mode !== 'local' || !state.ready) return;
    const h = setTimeout(() => {
      try {
        const { firms, plans, accounts, tx, events, settings } = state;
        localStorage.setItem(LS_KEY, JSON.stringify({ tables: { firms, plans, accounts, tx, events }, settings }));
      } catch { /* quota */ }
    }, 250);
    return () => clearTimeout(h);
  }, [state, mode]);

  const track = useCallback(async (fn: () => Promise<void>) => {
    setPending(p => p + 1);
    try { await fn(); return true; } catch (e) { fail(e); return false; } finally { setPending(p => p - 1); }
  }, [fail]);

  const upsert = useCallback(async <T extends TableName>(t: T, rows: Row<T> | Row<T>[]) => {
    const arr = (Array.isArray(rows) ? rows : [rows]).map(r => JSON.parse(JSON.stringify(r)));
    if (!arr.length) return true;
    setState(s => ({ ...s, [t]: { ...s[t], ...toRecord(arr) } }));
    if (mode === 'local') return true;
    return track(async () => {
      for (const c of chunks(arr)) { const { error } = await supabase!.from(DB[t]).upsert(c); if (error) throw error; }
    });
  }, [mode, track]);

  const remove = useCallback(async (t: TableName, ids: string | string[]) => {
    const arr = Array.isArray(ids) ? ids : [ids];
    if (!arr.length) return true;
    const set = new Set(arr);
    setState(s => {
      const n: DataState = { ...s, [t]: Object.fromEntries(Object.entries(s[t]).filter(([k]) => !set.has(k))) };
      if (t === 'accounts') { // cascade comme en base
        n.tx = Object.fromEntries(Object.entries(s.tx).filter(([, x]) => !x.account_id || !set.has(x.account_id)));
        n.events = Object.fromEntries(Object.entries(s.events).filter(([, x]) => !x.account_id || !set.has(x.account_id)));
      }
      if (t === 'firms') n.plans = Object.fromEntries(Object.entries(s.plans).filter(([, x]) => !set.has(x.firm_id)));
      return n;
    });
    if (mode === 'local') return true;
    return track(async () => {
      for (const c of chunks(arr, 200)) { const { error } = await supabase!.from(DB[t]).delete().in('id', c); if (error) throw error; }
    });
  }, [mode, track]);

  const saveSettings = useCallback(async (patch: Partial<Settings>) => {
    const settings = { ...ref.current.settings, ...patch };
    setState(s => ({ ...s, settings }));
    if (mode === 'local') return;
    await track(async () => { const { error } = await supabase!.from('settings').upsert({ user_id: userId, data: settings, updated_at: new Date().toISOString() }); if (error) throw error; });
  }, [mode, track, userId]);

  const wipeRemote = useCallback(async () => {
    for (const t of [...ORDER].reverse()) {
      const { error } = await supabase!.from(DB[t]).delete().neq('id', '');
      if (error) throw error;
    }
  }, []);

  const replaceAll = useCallback(async (tables: Tables, settings?: Partial<Settings>) => {
    const s = { ...ref.current.settings, ...(settings || {}), seeded: true };
    setState(st => ({ ...st, ...tables, settings: s }));
    if (mode === 'local') return true;
    return track(async () => {
      await wipeRemote();
      for (const t of ORDER) for (const c of chunks(Object.values(tables[t]))) { const { error } = await supabase!.from(DB[t]).upsert(c); if (error) throw error; }
      const { error } = await supabase!.from('settings').upsert({ user_id: userId, data: s }); if (error) throw error;
    });
  }, [mode, track, wipeRemote, userId]);

  const wipe = useCallback(async () => {
    const firms = toRecord(SEED_FIRMS.map(newFirm));
    await replaceAll({ ...emptyTables(), firms });
  }, [replaceAll]);

  const api = useMemo<DataApi>(() => ({ ...state, upsert, remove, saveSettings, replaceAll, wipe, pending }),
    [state, upsert, remove, saveSettings, replaceAll, wipe, pending]);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
