import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useData } from './store';
import { makeEngine, type Engine } from './logic';
import type { Account, Ev, Tx } from './types';
import type { Filters } from './stats';
import { today, uid } from './utils';
import { useToast } from '../components/ui';

export type Tab = 'dash' | 'today' | 'accounts' | 'journal' | 'stats' | 'firms' | 'model' | 'settings';
const TABS: Tab[] = ['dash', 'today', 'accounts', 'journal', 'stats', 'firms', 'model', 'settings'];
// « settings » est réservé par claude.ai : l'onglet Réglages utilise #reglages dans l'adresse
const toHash = (t: Tab) => (t === 'settings' ? 'reglages' : t);
const fromHash = (h: string): Tab | null => { const t = (h === 'reglages' ? 'settings' : h) as Tab; return TABS.includes(t) ? t : null; };
export type ModalState =
  | { kind: 'buy' }
  | { kind: 'payout'; accId?: string }
  | { kind: 'expense'; tx?: Tx }
  | { kind: 'editAcc'; acc: Account }
  | { kind: 'die'; acc: Account }
  | { kind: 'reset'; acc: Account }
  | { kind: 'share'; mode: 'day' | 'dash'; payload: unknown }
  | null;

interface Ui {
  tab: Tab; setTab: (t: Tab) => void;
  filters: Filters; setFilters: (f: Partial<Filters>) => void;
  modal: ModalState; open: (m: ModalState) => void; close: () => void;
  E: Engine;
}
const UiCtx = createContext<Ui | null>(null);
export const useUi = () => { const c = useContext(UiCtx); if (!c) throw new Error('UiProvider manquant'); return c; };

export function UiProvider({ children }: { children: ReactNode }) {
  const d = useData();
  const [tab, setTabState] = useState<Tab>(() => {
    return fromHash(location.hash.slice(1)) || 'dash';
  });
  const setTab = useCallback((t: Tab) => { setTabState(t); try { history.replaceState(null, '', '#' + toHash(t)); } catch { /* iframe */ } window.scrollTo({ top: 0 }); }, []);
  useEffect(() => {
    const h = () => { const t = fromHash(location.hash.slice(1)); if (t) setTabState(t); };
    window.addEventListener('hashchange', h); return () => window.removeEventListener('hashchange', h);
  }, []);
  const [filters, setF] = useState<Filters>({ preset: 'all', from: '', to: '', firm: 'all' });
  const setFilters = useCallback((f: Partial<Filters>) => setF(o => ({ ...o, ...f })), []);
  const [modal, setModal] = useState<ModalState>(null);
  const E = useMemo(() => makeEngine({ firms: d.firms, plans: d.plans, accounts: d.accounts, tx: d.tx, events: d.events }), [d.firms, d.plans, d.accounts, d.tx, d.events]);
  const v = useMemo<Ui>(() => ({ tab, setTab, filters, setFilters, modal, open: setModal, close: () => setModal(null), E }), [tab, setTab, filters, setFilters, modal, E]);
  return <UiCtx.Provider value={v}>{children}</UiCtx.Provider>;
}

/** Actions sur un compte : jour gagnant, étape suivante, etc. Chaque action est journalisée (onglet Aujourd'hui). */
export function useActions() {
  const d = useData();
  const { E } = useUi();
  const toast = useToast();

  const event = useCallback((type: Ev['type'], a: Account, extra: Partial<Ev> = {}): Ev => ({
    id: uid(), date: extra.date || today(), ts: Date.now(), type, account_id: a.id, firm_id: a.firm_id,
    phase: a.phase, cycle: a.cycle || 1, day: a.days || 0, amount: null, tx_id: null, note: '', ...extra,
  }), []);

  const win = useCallback(async (a: Account) => {
    await d.upsert('events', event('win', a));
    await d.upsert('accounts', { ...a, days: (a.days || 0) + 1 });
    toast(`${a.name} : jour gagnant ajouté`);
  }, [d, event, toast]);

  const red = useCallback(async (a: Account) => {
    await d.upsert('events', event('red', a));
    toast(`${a.name} : DLL touchée notée, le compte reste actif`);
  }, [d, event, toast]);

  const undoDay = useCallback(async (a: Account) => {
    const last = E.evs.filter(e => e.account_id === a.id && e.type === 'win' && e.phase === a.phase).sort((x, y) => y.ts - x.ts)[0];
    if (last) await d.remove('events', last.id);
    await d.upsert('accounts', { ...a, days: Math.max(0, (a.days || 0) - 1) });
  }, [d, E]);

  const advance = useCallback(async (a: Account) => {
    const hasBuffer = E.firm(a.firm_id).has_buffer;
    await d.upsert('events', event(a.phase === 'eval' ? 'pass_eval' : 'buffer_done', a));
    const n: Account = { ...a, days: 0, days_needed: null };
    if (a.phase === 'eval') { n.phase = hasBuffer ? 'buffer' : 'followup'; n.cycle = 1; }
    else if (a.phase === 'buffer') { n.phase = 'followup'; n.cycle = 1; }
    await d.upsert('accounts', n);
    toast(`${a.name} passe en ${E.stageLabel(n)}`);
  }, [d, E, event, toast]);

  const die = useCallback(async (a: Account, date: string, note: string) => {
    await d.upsert('events', event('died', a, { date, note }));
    await d.upsert('accounts', { ...a, status: 'dead', end_date: date, notes: note ? (a.notes ? a.notes + ' — ' : '') + note : a.notes });
    toast(`${a.name} marqué comme cramé`);
  }, [d, event, toast]);

  return { win, red, undoDay, advance, die, event };
}
