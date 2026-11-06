import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { toBlob } from 'html-to-image';
import { Download, Copy } from 'lucide-react';
import { useData } from '../lib/store';
import { useUi } from '../lib/hooks';
import { Button, Field, Modal, useToast } from '../components/ui';
import { downloadBlob, money, pct, today, num } from '../lib/utils';
import type { DayItem } from '../views/Today';
import { itemText, itemColor, summarize } from '../views/Today';
import type { overview, groupRows } from '../lib/stats';
import { Mark } from '../components/Mark';

type O = ReturnType<typeof overview>;
type FR = ReturnType<typeof groupRows>;

const C = { bg: '#06070a', panel: '#0e1118', line: 'rgba(255,255,255,.08)', text: '#f3f4f7', muted: '#9298a5', dim: '#5d636f', gold: '#ecd49c', pos: '#5fe3a9', neg: '#ff7b7b' };
const F = { d: "'Mona Sans Variable', sans-serif", b: "'Mona Sans Variable', sans-serif" };

function Frame({ children, title, sub, foot }: { children: ReactNode; title: string; sub: string; foot: ReactNode }) {
  return (
    <div style={{ width: 1080, padding: '64px 68px 56px', background: `radial-gradient(800px 520px at 0% 0%, rgba(110,92,255,.28), transparent 62%), radial-gradient(700px 480px at 100% 0%, rgba(36,196,178,.16), transparent 60%), radial-gradient(600px 400px at 50% 100%, rgba(236,212,156,.06), transparent 60%), ${C.bg}`, color: C.text, fontFamily: F.b, boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 34 }}>
        <Mark size={42} />
        <div style={{ font: `700 semi-expanded 24px ${F.d}`, letterSpacing: '-.02em' }}>Rotation</div>
      </div>
      <div style={{ font: `700 semi-expanded 54px/1.02 ${F.d}`, letterSpacing: '-.035em' }}>{title}</div>
      <div style={{ font: `500 24px ${F.b}`, color: C.muted, marginTop: 10 }}>{sub}</div>
      {children}
      <div style={{ marginTop: 44, paddingTop: 24, borderTop: `1px solid ${C.line}`, display: 'flex', flexWrap: 'wrap', gap: '10px 30px', font: `500 20px ${F.b}`, color: C.muted }}>{foot}</div>
    </div>
  );
}
const sec = (t: string) => <div style={{ font: `600 20px ${F.b}`, color: C.dim, margin: '42px 0 16px' }}>{t}</div>;
function Stat({ l, v, s, c }: { l: string; v: ReactNode; s?: string; c?: string }) {
  return (
    <div style={{ flex: 1, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 22, padding: '22px 24px' }}>
      <div style={{ font: `500 19px ${F.b}`, color: C.muted }}>{l}</div>
      <div style={{ font: `650 semi-expanded 44px/1.1 ${F.d}`, letterSpacing: '-.025em', color: c || C.text, marginTop: 8, whiteSpace: 'nowrap' }}>{v}</div>
      <div style={{ font: `400 16px ${F.b}`, color: C.dim, marginTop: 6, minHeight: 20 }}>{s}</div>
    </div>
  );
}
const rowS: CSSProperties = { display: 'flex', gap: 14 };

export function ShareModal({ mode, payload, onClose }: { mode: 'day' | 'dash'; payload: unknown; onClose: () => void }) {
  const d = useData(); const { E } = useUi(); const toast = useToast();
  const pref = (() => { try { return JSON.parse(localStorage.getItem('rot_share') || '{}'); } catch { return {}; } })();
  const [title, setTitle] = useState<string>(pref.title?.[mode] || (mode === 'day' ? 'Ma journée de trading' : 'Mes résultats prop firm'));
  const [names, setNames] = useState<boolean>(pref.names ?? false);
  const [links, setLinks] = useState<boolean>(pref.links ?? true);
  const [firms, setFirms] = useState<boolean>(pref.firms ?? true);
  const [buys, setBuys] = useState<boolean>(pref.buys ?? true);
  const [url, setUrl] = useState<string | null>(null);
  const blob = useRef<Blob | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { localStorage.setItem('rot_share', JSON.stringify({ ...pref, title: { ...(pref.title || {}), [mode]: title }, names, links, firms, buys })); } catch { /* */ }
    let alive = true;
    const h = setTimeout(async () => {
      if (!ref.current) return;
      try {
        await document.fonts?.ready;
        const b = await toBlob(ref.current.firstElementChild as HTMLElement, { pixelRatio: 2, cacheBust: true, backgroundColor: C.bg });
        if (!alive || !b) return;
        blob.current = b;
        setUrl(u => { if (u) URL.revokeObjectURL(u); return URL.createObjectURL(b); });
      } catch (e) { toast('Impossible de créer l’image : ' + (e as Error).message, 'error'); }
    }, 250);
    return () => { alive = false; clearTimeout(h); };
  }, [title, names, links, firms, buys]); // eslint-disable-line react-hooks/exhaustive-deps

  const linkList = (d.settings.links || []).filter(l => l.url.trim());
  const foot = <>{d.settings.handle && <span style={{ color: C.text, fontWeight: 650 }}>{d.settings.handle}</span>}{links && linkList.map((l, i) => <span key={i}><b style={{ color: C.text }}>{l.label || l.type}</b>&nbsp; {l.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</span>)}{!d.settings.handle && !(links && linkList.length) && <span>Journal de rotation prop firm</span>}</>;

  let card: ReactNode = null;
  if (mode === 'day') {
    const p = payload as { label: string; from: string; to: string; evs: DayItem[] };
    const S = summarize(p.evs);
    const list = p.evs.filter(e => ['win', 'red', 'pass_eval', 'buffer_done', 'died', 'payout'].includes(e.type)).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.ts - b.ts));
    const buysList = p.evs.filter(e => e.type === 'bought' || e.type === 'reset');
    const grouped = new Map<string, { n: number; amt: number; firm: string; combo: string }>();
    buysList.forEach(e => { const k = e.firmId + e.combo; const g = grouped.get(k) || { n: 0, amt: 0, firm: E.firm(e.firmId).name, combo: e.combo }; g.n++; g.amt += e.amount || 0; grouped.set(k, g); });
    card = (
      <Frame title={title} sub={p.label} foot={foot}>
        {sec('Résultats')}
        <div style={rowS}>
          <Stat l="Trades" v={S.trades} s={`${S.won} gagnés, ${S.lost} perdus`} />
          <Stat l="Réussite" v={S.trades ? Math.round((S.won / S.trades) * 100) + ' %' : '—'} s="jours gagnés ÷ trades" />
          <Stat l="Évals validées" v={S.pass} c={S.pass ? C.pos : undefined} s="passent en buffer" />
          <Stat l="Payouts" v={money(S.paid, 0)} c={S.paid ? C.gold : undefined} s={`${S.nPay} payout${S.nPay > 1 ? 's' : ''}`} />
        </div>
        {list.length > 0 && <>{sec('Le détail')}
          <div style={{ display: 'grid', gap: 0 }}>
            {list.slice(0, 18).map(e => (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '14px 0', borderTop: `1px solid ${C.line}` }}>
                <span style={{ width: 12, height: 12, borderRadius: 6, background: itemColor(e.type), flex: 'none' }} />
                {names && <span style={{ font: `650 semi-expanded 20px ${F.d}`, minWidth: 150 }}>{e.name}</span>}
                <span style={{ font: `500 19px ${F.b}`, color: C.muted, minWidth: 190 }}>{E.firm(e.firmId).name}</span>
                <span style={{ font: `600 20px ${F.b}`, color: e.type === 'died' ? C.neg : e.type === 'payout' ? C.gold : C.text }}>{itemText(e)}</span>
              </div>
            ))}
            {list.length > 18 && <div style={{ color: C.dim, font: `500 18px ${F.b}`, paddingTop: 12 }}>et {list.length - 18} autres</div>}
          </div></>}
        {buys && buysList.length > 0 && <>{sec('Achats')}
          {[...grouped.values()].map((g, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '12px 0', borderTop: `1px solid ${C.line}` }}>
              <span style={{ font: `650 semi-expanded 28px ${F.d}`, width: 70 }}>{g.n}×</span>
              <span style={{ font: `600 20px ${F.b}`, flex: 1 }}>{g.firm}<span style={{ color: C.dim, fontWeight: 400 }}>{g.combo ? `  ${g.combo}` : ''}</span></span>
              <span style={{ font: `600 20px ${F.b}`, color: C.neg }}>{money(g.amt, 0)}</span>
            </div>
          ))}</>}
      </Frame>
    );
  } else {
    const p = payload as { O: O; firms: FR; B: { current: number; start: number; delta: number; deltaPct: number } | null };
    const O = p.O, T = O.T, BK = p.B;
    card = (
      <Frame title={title} sub={`${O.F.r.from || O.F.r.to ? `Du ${O.F.r.from.split('-').reverse().join('/')} au ${O.F.r.to.split('-').reverse().join('/')}` : 'Depuis le début'} — ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`} foot={foot}>
        <div style={{ marginTop: 40, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 26, padding: '30px 34px', display: 'flex', alignItems: 'flex-end', gap: 30 }}>
          <div style={{ flex: 1 }}>
            <div style={{ font: `500 21px ${F.b}`, color: C.muted }}>{BK ? 'Bankroll' : 'Résultat net'}</div>
            <div style={{ font: `650 semi-expanded 92px/1 ${F.d}`, letterSpacing: '-.05em', color: BK ? C.text : T.net >= 0 ? C.pos : C.neg, marginTop: 10 }}>{money(BK ? BK.current : T.net, 0)}</div>
            {BK && <div style={{ font: `600 21px ${F.b}`, color: BK.delta >= 0 ? C.pos : C.neg, marginTop: 14 }}>{BK.delta >= 0 ? '+' : ''}{money(BK.delta, 0)} depuis le départ ({pct(BK.deltaPct, 1)})</div>}
          </div>
          <div style={{ textAlign: 'right', font: `500 21px ${F.b}`, color: C.muted, lineHeight: 1.7 }}>
            {BK && <div>Net période <b style={{ color: T.net >= 0 ? C.pos : C.neg }}>{money(T.net, 0)}</b></div>}
            <div>ROI <b style={{ color: C.text }}>{pct(T.roi, 0)}</b></div>
            <div>Multiple <b style={{ color: C.text }}>{isFinite(T.multiple) ? num(T.multiple, 2) + '×' : '—'}</b></div>
          </div>
        </div>
        <div style={{ ...rowS, marginTop: 14 }}>
          <Stat l="Dépensé" v={money(T.spent, 0)} c={C.neg} s={`${T.nBuy} achats et resets`} />
          <Stat l="Payouts" v={money(T.paid, 0)} c={C.pos} s={`${T.nPay} payouts`} />
          <Stat l="Payout moyen" v={money(O.avgPayout, 0)} s={`coût par payout ${money(O.costPerPayout, 0)}`} />
        </div>
        {sec('Parcours des comptes')}
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', height: 210 }}>
          {O.funnel.map(s => {
            const max = Math.max(1, O.funnel[0].n);
            return (
              <div key={s.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}>
                <div style={{ font: `650 semi-expanded 30px ${F.d}`, textAlign: 'center', marginBottom: 8 }}>{s.n}</div>
                <div style={{ height: Math.max(6, (s.n / max) * 130), borderRadius: 10, background: s.key.startsWith('p') ? C.gold : s.key === 'buffer' ? '#2fd3bf' : '#8d7dff' }} />
                <div style={{ font: `500 16px ${F.b}`, color: C.muted, textAlign: 'center', marginTop: 10, whiteSpace: 'nowrap' }}>{s.label}</div>
              </div>
            );
          })}
        </div>
        {firms && p.firms.length > 0 && <>{sec('Par prop firm')}
          {p.firms.slice(0, 6).map(r => (
            <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '14px 0', borderTop: `1px solid ${C.line}`, font: `500 20px ${F.b}` }}>
              <span style={{ width: 12, height: 12, borderRadius: 6, background: r.color }} />
              <span style={{ flex: 1, fontWeight: 600 }}>{r.name}</span>
              <span style={{ color: C.muted, width: 150, textAlign: 'right' }}>{r.bought} comptes</span>
              <span style={{ color: C.muted, width: 150, textAlign: 'right' }}>{r.T.nPay} payout{r.T.nPay > 1 ? 's' : ''}</span>
              <span style={{ width: 170, textAlign: 'right', fontWeight: 650, color: r.T.net >= 0 ? C.pos : C.neg }}>{money(r.T.net, 0)}</span>
            </div>
          ))}</>}
      </Frame>
    );
  }

  const copy = async () => {
    if (!blob.current) return;
    try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob.current })]); toast('Image copiée, colle-la dans ton post'); }
    catch { toast('Copie d’image non autorisée ici : télécharge-la plutôt', 'error'); }
  };
  return (
    <Modal open onClose={onClose} title="Image à partager" width={760}
      footer={<><Button variant="ghost" onClick={onClose}>Fermer</Button><Button icon={<Copy size={14} />} onClick={copy} disabled={!url}>Copier</Button><Button variant="primary" icon={<Download size={14} />} disabled={!url} onClick={() => blob.current && downloadBlob(blob.current, `rotation-${mode === 'day' ? 'journee' : 'resultats'}-${today()}.png`)}>Télécharger le PNG</Button></>}>
      <div className="form" style={{ marginBottom: 14 }}>
        <Field label="Titre" full><input value={title} onChange={e => setTitle(e.target.value)} /></Field>
        {mode === 'day' ? <>
          <label className="check"><input type="checkbox" checked={names} onChange={e => setNames(e.target.checked)} />Afficher les noms des comptes</label>
          <label className="check"><input type="checkbox" checked={buys} onChange={e => setBuys(e.target.checked)} />Afficher les achats</label>
        </> : <label className="check"><input type="checkbox" checked={firms} onChange={e => setFirms(e.target.checked)} />Tableau par prop firm</label>}
        <label className="check"><input type="checkbox" checked={links} onChange={e => setLinks(e.target.checked)} />Afficher mes liens{linkList.length ? '' : ' (à ajouter dans Réglages)'}</label>
      </div>
      <div className="share-prev">{url ? <img src={url} alt="Aperçu de l’image" /> : 'Création de l’image…'}</div>
      {createPortal(<div className="share-host" ref={ref} aria-hidden>{card}</div>, document.body)}
    </Modal>
  );
}
