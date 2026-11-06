import { useRef, useState, type ReactNode } from 'react';
import { Download, Upload, Trash2, Plus, Copy, X, Sparkles, LogOut } from 'lucide-react';
import { useData, newFirm } from '../lib/store';
import { useUi } from '../lib/hooks';
import { supabase } from '../lib/supabase';
import { importCsv, toCsv, AI_PROMPT } from '../lib/csv';
import { demoData } from '../lib/demo';
import type { Firm, Plan, Tables } from '../lib/types';
import { downloadBlob, numOrNull, today, uid, plural } from '../lib/utils';
import { Button, Confirm, Panel, useToast } from '../components/ui';

const LINK_TYPES = ['YouTube', 'X', 'Discord', 'Instagram', 'TikTok', 'Telegram', 'Twitch', 'Site', 'Autre'];

function Cell({ value, onSave, type = 'text', w = 80, placeholder, align }: { value: string | number | null; onSave: (v: string) => void; type?: string; w?: number; placeholder?: string; align?: 'right' }) {
  return <input key={String(value ?? '')} type={type} step="any" defaultValue={value ?? ''} placeholder={placeholder} style={{ width: w || '100%', textAlign: align }} onBlur={e => { if (e.target.value !== String(value ?? '')) onSave(e.target.value); }} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />;
}

export function Settings({ email }: { email?: string }) {
  const d = useData();
  const { E } = useUi();
  const toast = useToast();
  const [csv, setCsv] = useState('');
  const [csvMsg, setCsvMsg] = useState<ReactNode>('');
  const [confirm, setConfirm] = useState<null | 'wipe' | 'demo' | { restore: { tables: Tables; settings?: object } }>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const saveFirm = (f: Firm, k: keyof Firm, raw: string | boolean) => {
    let v: unknown = raw;
    if (['eval_days', 'buffer_days', 'funded_days', 'max_payouts', 'price', 'split'].includes(k)) v = numOrNull(raw);
    if (k === 'name' && !String(raw).trim()) return;
    d.upsert('firms', { ...f, [k]: v } as Firm).then(ok => ok && toast('Enregistré'));
  };
  const savePlan = (p: Plan, k: keyof Plan, raw: string) => {
    const v = ['eval_days', 'p_eval', 'p_buffer', 'max_payouts', 'price_first', 'price_reset'].includes(k) ? numOrNull(raw) : k === 'size' ? raw.toUpperCase().trim() : raw;
    d.upsert('plans', { ...p, [k]: v } as Plan).then(ok => ok && toast('Enregistré'));
  };
  const delFirm = (f: Firm) => {
    if (E.accounts.some(a => a.firm_id === f.id) || E.txs.some(t => t.firm_id === f.id)) return toast('Cette firm a des comptes ou des entrées : renomme-la plutôt', 'error');
    d.remove('firms', f.id);
  };

  const doImport = async () => {
    const r = importCsv(E, csv);
    if ('error' in r) { setCsvMsg(<span className="neg">{r.error}</span>); return; }
    setCsvMsg('Import en cours…');
    await d.upsert('firms', r.firms);
    await d.upsert('accounts', r.accounts);
    const ok = await d.upsert('tx', r.tx);
    setCsvMsg(ok ? <span className="pos">{plural(r.tx.length, 'entrée importée', 'entrées importées')}, {plural(r.accounts.length, 'compte créé', 'comptes créés')}{r.firms.length ? `, ${plural(r.firms.length, 'firm ajoutée', 'firms ajoutées')}` : ''}{r.skipped ? `, ${r.skipped} lignes ignorées (date ou firm manquante)` : ''}. Vérifie les étapes dans Comptes.</span> : <span className="neg">L’import a échoué, rien n’a été perdu.</span>);
    if (ok) setCsv('');
  };
  const backup = () => {
    const { firms, plans, accounts, tx, events, settings } = d;
    downloadBlob(new Blob([JSON.stringify({ app: 'rotation', version: 1, date: new Date().toISOString(), tables: { firms, plans, accounts, tx, events }, settings }, null, 1)], { type: 'application/json' }), `rotation-sauvegarde-${today()}.json`);
  };
  const onFile = async (file: File) => {
    try {
      const j = JSON.parse(await file.text());
      if (!j.tables?.firms) throw new Error();
      setConfirm({ restore: { tables: { firms: {}, plans: {}, accounts: {}, tx: {}, events: {}, ...j.tables }, settings: j.settings } });
    } catch { toast('Ce fichier n’est pas une sauvegarde Rotation', 'error'); }
  };
  const links = d.settings.links || [];

  return (
    <div className="stack" style={{ gap: 20 }}>
      <Panel title="Bankroll et objectif" sub="Bankroll actuelle = bankroll de départ + payouts − dépenses à partir de la date choisie (toutes firms). Sans date, toutes tes entrées comptent.">
        <div className="form" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <label className="field"><span className="field-l">Bankroll de départ ($)</span><Cell value={d.settings.start_bankroll} type="number" w={0} onSave={v => d.saveSettings({ start_bankroll: numOrNull(v) })} /></label>
          <label className="field"><span className="field-l">Comptée à partir du</span><input type="date" key={d.settings.start_date || ''} defaultValue={d.settings.start_date || ''} onBlur={e => e.target.value !== (d.settings.start_date || '') && d.saveSettings({ start_date: e.target.value || null })} /></label>
          <label className="field"><span className="field-l">Objectif de bankroll ($)</span><Cell value={d.settings.goal} type="number" w={0} onSave={v => d.saveSettings({ goal: numOrNull(v) })} /></label>
          <label className="field"><span className="field-l">Ton pseudo (images à partager)</span><Cell value={d.settings.handle} w={0} placeholder="@pseudo" onSave={v => d.saveSettings({ handle: v.trim() })} /></label>
        </div>
      </Panel>

      <Panel pad={false} title="Prop firms" sub="Les jours visés s’appliquent à tous les comptes de la firm. Un nombre saisi sur un compte (Modifier) passe devant." actions={<Button size="sm" icon={<Plus size={14} />} onClick={() => d.upsert('firms', newFirm('Nouvelle firm', E.firms.length))}>Ajouter</Button>}>
        <div className="tw set-table" style={{ marginTop: 6 }}><table>
          <thead><tr><th>Nom</th><th>Couleur</th><th className="r">Jours d’éval</th><th>Buffer</th><th className="r">Jours de buffer</th><th className="r">Jours gagnants par payout</th><th className="r">Payouts max</th><th className="r">Prix habituel $</th><th className="r">Split %</th><th /></tr></thead>
          <tbody>{E.firms.map(f => (
            <tr key={f.id}>
              <td><Cell value={f.name} w={170} onSave={v => saveFirm(f, 'name', v.trim())} /></td>
              <td><input type="color" key={f.color} defaultValue={f.color} onBlur={e => e.target.value !== f.color && saveFirm(f, 'color', e.target.value)} aria-label="Couleur" /></td>
              <td className="r"><Cell value={f.eval_days} type="number" w={70} align="right" onSave={v => saveFirm(f, 'eval_days', v)} /></td>
              <td><label className="check"><input type="checkbox" checked={f.has_buffer} onChange={e => saveFirm(f, 'has_buffer', e.target.checked)} />oui</label></td>
              <td className="r"><Cell value={f.buffer_days} type="number" w={70} align="right" onSave={v => saveFirm(f, 'buffer_days', v)} /></td>
              <td className="r"><Cell value={f.funded_days} type="number" w={70} align="right" onSave={v => saveFirm(f, 'funded_days', v)} /></td>
              <td className="r"><Cell value={f.max_payouts} type="number" w={70} align="right" onSave={v => saveFirm(f, 'max_payouts', v)} /></td>
              <td className="r"><Cell value={f.price} type="number" w={90} align="right" onSave={v => saveFirm(f, 'price', v)} /></td>
              <td className="r"><Cell value={f.split} type="number" w={70} align="right" onSave={v => saveFirm(f, 'split', v)} /></td>
              <td><button className="icon-btn" onClick={() => delFirm(f)} aria-label={`Supprimer ${f.name}`}><X size={15} /></button></td>
            </tr>))}</tbody>
        </table></div>
        <p className="dim" style={{ fontSize: 12.5, padding: '10px 20px 16px', margin: 0 }}>Le jour de buffer compte dans le 1er payout : avec 5 jours par payout et 1 jour de buffer, il en reste 4 pour le 1er payout.</p>
      </Panel>

      <Panel pad={false} title="Modèle mathématique par plan" sub="Tes probabilités (en %) issues de ta feuille de calcul ou de tes simulations. Un plan s’applique aux comptes de la même firm et taille ; plan, DLL, consistance et nom de combinaison affinent quand tu les remplis." actions={<Button size="sm" icon={<Plus size={14} />} onClick={() => E.firms[0] && d.upsert('plans', { id: uid(), firm_id: E.firms[0].id, plan: '', size: '', dll: '', consistency: '', label: '', eval_days: null, p_eval: null, p_eval_day: '', p_buffer: null, p_follow: '', max_payouts: 4, price_first: null, price_reset: null, payouts: '', source: '' })}>Ajouter</Button>}>
        {E.plans.length ? (
          <div className="tw set-table" style={{ marginTop: 6 }}><table>
            <thead><tr><th>Firm</th><th>Plan</th><th>Taille</th><th>DLL</th><th>Consistance</th><th>Combinaison</th><th className="r">Éval %</th><th>Éval % par jour</th><th className="r">Buffer %</th><th>Follow-up % par payout</th><th className="r">Payouts max</th><th className="r">Prix 1er / reset $</th><th>Payouts reçus $</th><th>Source</th><th /></tr></thead>
            <tbody>{E.plans.map(p => (
              <tr key={p.id}>
                <td><select value={p.firm_id} onChange={e => savePlan(p, 'firm_id', e.target.value)} style={{ width: 150 }}>{E.firms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></td>
                <td><Cell value={p.plan} w={90} placeholder="tous" onSave={v => savePlan(p, 'plan', v)} /></td>
                <td><Cell value={p.size} w={66} placeholder="25K" onSave={v => savePlan(p, 'size', v)} /></td>
                <td><select value={p.dll} onChange={e => savePlan(p, 'dll', e.target.value)} style={{ width: 80 }}><option value="">tous</option><option>ON</option><option>OFF</option></select></td>
                <td><Cell value={p.consistency} w={70} placeholder="tous" onSave={v => savePlan(p, 'consistency', v)} /></td>
                <td><Cell value={p.label} w={100} placeholder="tous" onSave={v => savePlan(p, 'label', v)} /></td>
                <td className="r"><Cell value={p.p_eval} type="number" w={70} align="right" onSave={v => savePlan(p, 'p_eval', v)} /></td>
                <td><Cell value={p.p_eval_day} w={130} placeholder="65 65" onSave={v => savePlan(p, 'p_eval_day', v)} /></td>
                <td className="r"><Cell value={p.p_buffer} type="number" w={70} align="right" onSave={v => savePlan(p, 'p_buffer', v)} /></td>
                <td><Cell value={p.p_follow} w={160} placeholder="53 53 53 53" onSave={v => savePlan(p, 'p_follow', v)} /></td>
                <td className="r"><Cell value={p.max_payouts} type="number" w={60} align="right" onSave={v => savePlan(p, 'max_payouts', v)} /></td>
                <td className="r" style={{ whiteSpace: 'nowrap' }}><Cell value={p.price_first} type="number" w={70} align="right" onSave={v => savePlan(p, 'price_first', v)} /> <Cell value={p.price_reset} type="number" w={70} align="right" onSave={v => savePlan(p, 'price_reset', v)} /></td>
                <td><Cell value={p.payouts} w={170} placeholder="1150 1000 950" onSave={v => savePlan(p, 'payouts', v)} /></td>
                <td><Cell value={p.source} w={150} onSave={v => savePlan(p, 'source', v)} /></td>
                <td><button className="icon-btn" onClick={() => d.remove('plans', p.id)} aria-label="Supprimer le plan"><X size={15} /></button></td>
              </tr>))}</tbody>
          </table></div>
        ) : <p className="dim" style={{ padding: '0 20px 18px', margin: 0, fontSize: 13 }}>Aucun modèle. Ajoute un plan pour comparer tes résultats réels à tes probabilités dans l’onglet Modèle.</p>}
        {E.plans.length > 0 && <p className="dim" style={{ fontSize: 12.5, padding: '10px 20px 16px', margin: 0 }}>Les listes se séparent par des espaces ou des points-virgules : « 65 65 78 ». Laisse vide ce que ton calcul ne donne pas.</p>}
      </Panel>

      <Panel title="Mes liens" sub="Affichés en bas des images à partager." actions={<Button size="sm" icon={<Plus size={14} />} onClick={() => d.saveSettings({ links: [...links, { type: 'YouTube', label: '', url: '' }] })}>Ajouter</Button>}>
        {links.length ? (
          <div className="stack" style={{ gap: 8 }}>
            {links.map((l, i) => (
              <div className="row" key={i} style={{ flexWrap: 'nowrap' }}>
                <select value={l.type} style={{ width: 130 }} onChange={e => d.saveSettings({ links: links.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)) })}>{LINK_TYPES.map(t => <option key={t}>{t}</option>)}</select>
                <Cell value={l.label} w={170} placeholder={l.type} onSave={v => d.saveSettings({ links: links.map((x, j) => (j === i ? { ...x, label: v.trim() } : x)) })} />
                <Cell value={l.url} w={360} placeholder="https://…" onSave={v => d.saveSettings({ links: links.map((x, j) => (j === i ? { ...x, url: v.trim() } : x)) })} />
                <button className="icon-btn" onClick={() => d.saveSettings({ links: links.filter((_, j) => j !== i) })} aria-label="Supprimer le lien"><X size={15} /></button>
              </div>
            ))}
          </div>
        ) : <p className="dim" style={{ margin: 0, fontSize: 13 }}>Aucun lien. Ajoute YouTube, X, Discord…</p>}
      </Panel>

      <div className="grid g2">
        <Panel title="Importer ton historique (CSV)" sub="Colle des lignes depuis Excel ou Google Sheets, avec la ligne d’en-tête.">
          <p className="dim" style={{ fontSize: 12.5, marginTop: 0 }}>Colonnes : <code>date, type, firm, account, amount, size, stage, note</code> (facultatif : plan, dll, consistency, combination). type = purchase, reset, activation, fee ou payout. stage = eval, buffer, followup, dead ou completed. Dates au format jj/mm/aaaa.</p>
          <textarea rows={7} value={csv} onChange={e => setCsv(e.target.value)} placeholder="date,type,firm,account,amount,size,stage,note" style={{ fontSize: 12.5 }} />
          <div className="row" style={{ marginTop: 10 }}>
            <Button variant="primary" icon={<Upload size={14} />} onClick={doImport} disabled={!csv.trim()}>Importer</Button>
            <Button variant="ghost" icon={<Copy size={14} />} onClick={async () => { try { await navigator.clipboard.writeText(AI_PROMPT); toast('Consigne copiée : colle-la à Claude avec tes relevés'); } catch { toast('Copie impossible', 'error'); } }}>Copier la consigne pour l’IA</Button>
          </div>
          {csvMsg && <p style={{ fontSize: 13, marginBottom: 0 }}>{csvMsg}</p>}
        </Panel>

        <Panel title="Exporter et sauvegarder" sub={`${plural(E.accounts.length, 'compte')}, ${plural(E.txs.length, 'entrée')}, ${plural(E.evs.length, 'résultat journalier', 'résultats journaliers')}.`}>
          <div className="stack" style={{ gap: 10 }}>
            <div className="row">
              <Button icon={<Download size={14} />} onClick={() => downloadBlob(new Blob(['﻿' + toCsv(E)], { type: 'text/csv;charset=utf-8' }), `rotation-journal-${today()}.csv`)}>Télécharger le CSV</Button>
              <Button icon={<Download size={14} />} onClick={backup}>Sauvegarde complète (JSON)</Button>
              <Button variant="ghost" icon={<Upload size={14} />} onClick={() => fileRef.current?.click()}>Restaurer une sauvegarde</Button>
              <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
            </div>
            <p className="dim" style={{ fontSize: 12.5, margin: 0 }}>
              {d.mode === 'cloud' ? 'Tes données sont dans ta base Supabase, synchronisées sur tous tes appareils.' : 'Mode local : les données restent dans ce navigateur. Fais une sauvegarde de temps en temps.'}
            </p>
            <div className="row" style={{ marginTop: 6 }}>
              <Button variant="ghost" icon={<Sparkles size={14} />} onClick={() => setConfirm('demo')}>Charger des données de démo</Button>
              <Button variant="danger" icon={<Trash2 size={14} />} onClick={() => setConfirm('wipe')}>Tout supprimer…</Button>
            </div>
          </div>
        </Panel>
      </div>

      {d.mode === 'cloud' && (
        <Panel title="Compte">
          <div className="row"><span className="muted grow">Connecté avec <b style={{ color: 'var(--text)' }}>{email}</b></span><Button icon={<LogOut size={14} />} onClick={() => supabase?.auth.signOut()}>Se déconnecter</Button></div>
        </Panel>
      )}

      <Confirm open={confirm === 'wipe'} onClose={() => setConfirm(null)} title="Tout supprimer ?" danger okLabel="Tout supprimer"
        body="Chaque compte, entrée, résultat et réglage de firm sera supprimé. Télécharge une sauvegarde avant si tu peux en avoir besoin." onOk={async () => { await d.wipe(); toast('Journal vidé'); }} />
      <Confirm open={confirm === 'demo'} onClose={() => setConfirm(null)} title="Charger la démo ?" okLabel="Remplacer par la démo"
        body="Tes données actuelles seront remplacées par des données fictives (5 mois de rotation sur 4 firms). Télécharge une sauvegarde avant si besoin." onOk={async () => { const x = demoData(); await d.replaceAll(x.tables, x.settings); toast('Démo chargée'); }} />
      <Confirm open={!!confirm && typeof confirm === 'object'} onClose={() => setConfirm(null)} title="Restaurer cette sauvegarde ?" okLabel="Restaurer"
        body={confirm && typeof confirm === 'object' ? `Tes données actuelles seront remplacées par la sauvegarde : ${Object.keys(confirm.restore.tables.accounts).length} comptes et ${Object.keys(confirm.restore.tables.tx).length} entrées.` : ''}
        onOk={async () => { if (confirm && typeof confirm === 'object') { const ok = await d.replaceAll(confirm.restore.tables, confirm.restore.settings); toast(ok ? 'Sauvegarde restaurée' : 'Restauration échouée', ok ? 'ok' : 'error'); } }} />
    </div>
  );
}
