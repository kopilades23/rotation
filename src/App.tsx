import { useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import type { Session } from '@supabase/supabase-js';
import { LayoutDashboard, CalendarCheck, Layers, BookText, BarChart3, Building2, FlaskConical, Settings as Cog, Plus, Banknote, Receipt } from 'lucide-react';
import { supabase, DEMO } from './lib/supabase';
import { DataProvider, useData } from './lib/store';
import { UiProvider, useUi, type Tab } from './lib/hooks';
import { demoData } from './lib/demo';
import { Button, ToastProvider } from './components/ui';
import { Mark } from './components/Mark';
import { Modals } from './modals/Modals';
import { Auth } from './views/Auth';
import { Dashboard } from './views/Dashboard';
import { Today } from './views/Today';
import { Accounts } from './views/Accounts';
import { Journal } from './views/Journal';
import { Stats } from './views/Stats';
import { Firms } from './views/Firms';
import { Model } from './views/Model';
import { Settings } from './views/Settings';
import { plural } from './lib/utils';

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        <Root />
      </ToastProvider>
    </MotionConfig>
  );
}

function Root() {
  const [session, setSession] = useState<Session | null | undefined>(supabase ? undefined : null);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  if (!supabase) return <DataProvider cloud={false}><UiProvider><Shell /></UiProvider></DataProvider>;
  if (session === undefined) return <><Atmosphere /><Splash /></>;
  if (!session) return <><Atmosphere /><Auth /></>;
  return (
    <DataProvider key={session.user.id} cloud userId={session.user.id}>
      <UiProvider><Shell email={session.user.email} /></UiProvider>
    </DataProvider>
  );
}

const Splash = () => <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', position: 'relative', zIndex: 1 }}><motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.6, ease: 'linear' }}><Mark size={40} /></motion.div></div>;

const NAV: { id: Tab; label: string; short: string; icon: ReactNode; title: string }[] = [
  { id: 'dash', label: 'Accueil', short: 'Accueil', icon: <LayoutDashboard size={16} />, title: 'Tableau de bord' },
  { id: 'today', label: 'Aujourd’hui', short: 'Jour', icon: <CalendarCheck size={16} />, title: 'Aujourd’hui' },
  { id: 'accounts', label: 'Comptes', short: 'Comptes', icon: <Layers size={16} />, title: 'Comptes' },
  { id: 'journal', label: 'Journal', short: 'Journal', icon: <BookText size={16} />, title: 'Journal' },
  { id: 'stats', label: 'Stats', short: 'Stats', icon: <BarChart3 size={16} />, title: 'Statistiques' },
  { id: 'firms', label: 'Firms', short: 'Firms', icon: <Building2 size={16} />, title: 'Prop firms' },
  { id: 'model', label: 'Modèle', short: 'Modèle', icon: <FlaskConical size={16} />, title: 'Ton modèle face au réel' },
  { id: 'settings', label: 'Réglages', short: 'Réglages', icon: <Cog size={16} />, title: 'Réglages' },
];

function Shell({ email }: { email?: string }) {
  const d = useData();
  const { tab, setTab, open, E } = useUi();
  const active = E.accounts.filter(a => a.status === 'active');
  const fu = active.filter(a => a.phase === 'followup').length;

  // démo : données fictives au premier lancement
  useEffect(() => {
    if (DEMO && d.ready && !Object.keys(d.accounts).length && !d.settings.start_bankroll) { const x = demoData(); d.replaceAll(x.tables, x.settings); }
  }, [d.ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // raccourcis clavier : A acheter, P payout, D dépense
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(t.tagName) || document.querySelector('.modal')) return;
      if (e.key === 'a') open({ kind: 'buy' }); else if (e.key === 'p') open({ kind: 'payout' }); else if (e.key === 'd') open({ kind: 'expense' });
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open]);

  const sub: Record<Tab, string> = {
    dash: `${plural(active.length, 'compte actif', 'comptes actifs')}, dont ${fu} en follow-up`,
    today: 'Note le résultat de chaque compte, il alimente toutes tes stats',
    accounts: 'Fais avancer chaque compte d’étape en étape',
    journal: 'Chaque achat, reset, frais et payout',
    stats: 'Délais, séries, mois par mois et plan par plan',
    firms: 'Ce que chaque prop firm te coûte et te rapporte',
    model: 'Tes probabilités prévues comparées à tes résultats',
    settings: 'Firms, modèles, import et sauvegardes',
  };
  const cur = NAV.find(n => n.id === tab)!;
  const view = (() => {
    switch (tab) {
      case 'dash': return <Dashboard />; case 'today': return <Today />; case 'accounts': return <Accounts />; case 'journal': return <Journal />;
      case 'stats': return <Stats />; case 'firms': return <Firms />; case 'model': return <Model />; default: return <Settings email={email} />;
    }
  })();

  return (
    <>
      <Atmosphere />
      <header className="topbar">
        <div className="topbar-in">
          <div className="brand"><Mark size={28} /><span className="brand-name">Rotation</span></div>
          <nav className="nav" aria-label="Sections">
            {NAV.map(n => (
              <button key={n.id} className={tab === n.id ? 'on' : ''} onClick={() => setTab(n.id)} aria-current={tab === n.id ? 'page' : undefined} title={n.label}>
                {tab === n.id && <motion.span layoutId="nav-ind" className="nav-ind" transition={{ type: 'spring', stiffness: 520, damping: 42 }} />}
                {n.icon}<span className="nav-l">{n.label}</span>
                {n.id === 'accounts' && active.length > 0 && <span className="nav-badge">{active.length}</span>}
              </button>
            ))}
          </nav>
          <div className="top-act">
            <span className={`sync-dot ${d.mode === 'local' ? 'local' : ''} ${d.pending ? 'busy' : ''}`} title={d.mode === 'cloud' ? (d.pending ? 'Enregistrement…' : `Synchronisé${email ? ' — ' + email : ''}`) : DEMO ? 'Démo, données fictives' : 'Mode local (ce navigateur)'} style={{ alignSelf: 'center', margin: '0 6px' }} />
            <Button className="hide-sm" icon={<Receipt size={15} />} onClick={() => open({ kind: 'expense' })} title="Raccourci : D">Dépense</Button>
            <Button className="hide-sm" icon={<Banknote size={15} />} onClick={() => open({ kind: 'payout' })} title="Raccourci : P">Payout</Button>
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => open({ kind: 'buy' })} title="Raccourci : A">Acheter</Button>
          </div>
        </div>
      </header>

      <main className="page">
        {tab !== 'dash' && (
          <div className="page-hd">
            <div><h1 className="page-t">{cur.title}</h1><div className="page-s">{sub[tab]}</div></div>
          </div>
        )}
        {d.mode === 'local' && !DEMO && d.ready && (
          <div className="note">Mode local : les données restent dans ce navigateur. Configure Supabase (voir le README) pour les synchroniser sur tous tes appareils.</div>
        )}
        {DEMO && tab === 'dash' && <div className="note" style={{ marginTop: 8 }}>Démo avec des données fictives. Tes modifications restent dans ce navigateur ; Réglages, Tout supprimer, pour repartir de zéro.</div>}
        {!d.ready ? <Loading /> : (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={tab} initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, filter: 'blur(2px)' }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}>
              {view}
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      <nav className="mnav" aria-label="Sections">
        {NAV.map(n => <button key={n.id} className={tab === n.id ? 'on' : ''} onClick={() => setTab(n.id)}>{n.icon}<span>{n.short}</span></button>)}
      </nav>
      <Modals email={email} />
    </>
  );
}

export function Atmosphere() {
  return <><div className="aurora" aria-hidden><i /><i /><i /></div><div className="grain" aria-hidden /></>;
}

function Loading() {
  return (
    <div className="grid" style={{ gap: 16 }}>
      {[180, 90, 280].map((h, i) => <motion.div key={i} className="panel" style={{ height: h }} animate={{ opacity: [0.5, 0.9, 0.5] }} transition={{ repeat: Infinity, duration: 1.4, delay: i * 0.15 }} />)}
    </div>
  );
}
