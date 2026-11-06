import { useMemo, useState } from 'react';
import { AnimatePresence, LayoutGroup } from 'motion/react';
import { Search } from 'lucide-react';
import { useUi } from '../lib/hooks';
import { filtered } from '../lib/stats';
import { STAGE_COLOR } from '../lib/logic';
import type { Account, Status } from '../lib/types';
import { AccountCard } from '../components/AccountCard';
import { FilterBar } from '../components/FilterBar';
import { Button, Empty, Panel, Segmented } from '../components/ui';

type View = 'board' | 'grid';
type St = Status | 'all';

export function Accounts() {
  const { E, filters, open } = useUi();
  const [status, setStatus] = useState<St>('active');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'stage' | 'newest' | 'name' | 'firm'>('stage');
  const [view, setView] = useState<View>('board');
  const F = useMemo(() => filtered(E, filters), [E, filters]);
  const counts = { active: 0, dead: 0, completed: 0, all: F.accs.length } as Record<St, number>;
  F.accs.forEach(a => counts[a.status]++);

  const list = useMemo(() => {
    let l = status === 'all' ? F.accs : F.accs.filter(a => a.status === status);
    if (q) { const s = q.toLowerCase(); l = l.filter(a => `${a.name} ${E.firm(a.firm_id).name} ${E.combo(a)} ${a.notes}`.toLowerCase().includes(s)); }
    const sorters: Record<string, (a: Account, b: Account) => number> = {
      stage: (a, b) => E.progress(b) - E.progress(a) || (a.bought_on < b.bought_on ? -1 : 1),
      newest: (a, b) => (a.bought_on < b.bought_on ? 1 : a.bought_on > b.bought_on ? -1 : (b.created_at || '').localeCompare(a.created_at || '')),
      name: (a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true }),
      firm: (a, b) => E.firm(a.firm_id).name.localeCompare(E.firm(b.firm_id).name) || E.progress(b) - E.progress(a),
    };
    return [...l].sort(sorters[sort]);
  }, [F, status, q, sort, E]);

  const board = status === 'active' && view === 'board';
  const lanes: { k: 'eval' | 'buffer' | 'followup'; t: string }[] = [{ k: 'eval', t: 'Éval' }, { k: 'buffer', t: 'Buffer' }, { k: 'followup', t: 'Follow-up' }];
  const shown = list.slice(0, 300);

  return (
    <>
      <FilterBar />
      <div className="filters">
        <Segmented id="accst" value={status} onChange={setStatus} options={[
          { value: 'active', label: <>Actifs <span className="chip-n">{counts.active}</span></> },
          { value: 'dead', label: <>Cramés <span className="chip-n">{counts.dead}</span></> },
          { value: 'completed', label: <>Terminés <span className="chip-n">{counts.completed}</span></> },
          { value: 'all', label: <>Tous <span className="chip-n">{counts.all}</span></> },
        ]} />
        <div style={{ position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: 9, color: 'var(--dim)' }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Nom, firm, plan, note…" style={{ paddingLeft: 32, width: 230 }} aria-label="Rechercher un compte" />
        </div>
        <select value={sort} onChange={e => setSort(e.target.value as typeof sort)} aria-label="Trier">
          <option value="stage">Les plus avancés d’abord</option><option value="newest">Les plus récents</option><option value="name">Par nom</option><option value="firm">Par firm</option>
        </select>
        {status === 'active' && <Segmented id="view" value={view} onChange={setView} options={[{ value: 'board', label: 'Colonnes' }, { value: 'grid', label: 'Grille' }]} />}
      </div>

      {!list.length ? (
        <Panel><Empty title={q ? 'Aucun compte ne correspond' : 'Aucun compte ici'} action={!q && status === 'active' ? <Button variant="primary" onClick={() => open({ kind: 'buy' })}>Acheter des comptes</Button> : undefined}>
          {q ? 'Essaie un autre mot ou change de filtre.' : 'Les comptes apparaissent ici dès que tu notes un achat.'}
        </Empty></Panel>
      ) : board ? (
        <LayoutGroup>
          <div className="board">
            {lanes.map(l => {
              const items = shown.filter(a => a.phase === l.k);
              return (
                <div className="lane" key={l.k} style={{ ['--c' as string]: STAGE_COLOR[l.k] }}>
                  <div className="lane-hd"><h3>{l.t}</h3><span className="n num">{items.length}</span></div>
                  <div className="lane-list">
                    <AnimatePresence mode="popLayout" initial={false}>
                      {items.map(a => <AccountCard key={a.id} a={a} mini />)}
                    </AnimatePresence>
                    {!items.length && <div className="dim" style={{ fontSize: 12.5, padding: '10px 6px' }}>Aucun compte à cette étape.</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </LayoutGroup>
      ) : (
        <div className="cards">
          <AnimatePresence mode="popLayout" initial={false}>
            {shown.map(a => <AccountCard key={a.id} a={a} />)}
          </AnimatePresence>
        </div>
      )}
      {list.length > shown.length && <p className="dim" style={{ marginTop: 12 }}>300 premiers comptes affichés sur {list.length}. Affine avec la recherche ou les dates.</p>}
    </>
  );
}
