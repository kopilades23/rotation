import { useEffect, useMemo, useState } from 'react';
import { useData, newFirm } from '../lib/store';
import { useActions, useUi } from '../lib/hooks';
import { TX_LABEL } from '../lib/logic';
import type { Account, Firm, Phase, Status, Tx, TxType } from '../lib/types';
import { money, numOrNull, today, uid, plural } from '../lib/utils';
import { Button, Confirm, Field, Modal, useToast } from '../components/ui';
import { ShareModal } from './Share';

const ls = { get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* */ } } };

export function Modals({ email }: { email?: string }) {
  const { modal, close } = useUi();
  void email;
  return (
    <>
      {modal?.kind === 'buy' && <BuyModal onClose={close} />}
      {modal?.kind === 'payout' && <PayoutModal accId={modal.accId} onClose={close} />}
      {modal?.kind === 'expense' && <ExpenseModal tx={modal.tx} onClose={close} />}
      {modal?.kind === 'editAcc' && <EditAccModal acc={modal.acc} onClose={close} />}
      {modal?.kind === 'die' && <DieModal acc={modal.acc} onClose={close} />}
      {modal?.kind === 'reset' && <ResetModal acc={modal.acc} onClose={close} />}
      {modal?.kind === 'share' && <ShareModal mode={modal.mode} payload={modal.payload} onClose={close} />}
    </>
  );
}

/* ---------- Sélecteur de firm avec « nouvelle firm » ---------- */
function useFirmPicker(initial: string) {
  const { E } = useUi();
  const [firmId, setFirmId] = useState(initial || E.firms[0]?.id || '');
  const [newName, setNewName] = useState('');
  const d = useData();
  const el = (
    <>
      <select value={firmId} onChange={e => setFirmId(e.target.value)}>
        {E.firms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        <option value="__new">+ Nouvelle firm…</option>
      </select>
      {firmId === '__new' && <input autoFocus placeholder="Nom de la firm" value={newName} onChange={e => setNewName(e.target.value)} style={{ marginTop: 6 }} />}
    </>
  );
  /** renvoie l'id de la firm, en la créant si besoin */
  const resolve = async (): Promise<string | null> => {
    if (firmId !== '__new') return firmId || null;
    const n = newName.trim(); if (!n) return null;
    const ex = E.firmByName(n); if (ex) return ex.id;
    const f: Firm = newFirm(n, E.firms.length);
    await d.upsert('firms', f); return f.id;
  };
  return { firmId, setFirmId, el, resolve };
}

function ComboFields({ v, set, firmId }: { v: Combo; set: (c: Combo) => void; firmId: string }) {
  const { E } = useUi();
  const plans = useMemo(() => [...new Set([...E.accounts.filter(a => a.firm_id === firmId).map(a => a.plan), ...E.plans.filter(p => p.firm_id === firmId).map(p => p.plan)].filter(Boolean))], [E, firmId]);
  const labels = useMemo(() => [...new Set([...E.accounts.map(a => a.label), ...E.plans.map(p => p.label)].filter(Boolean))], [E]);
  return (
    <>
      <Field label="Plan"><input list="dl-plans" value={v.plan} onChange={e => set({ ...v, plan: e.target.value })} placeholder="Flex, Select, Rapid…" /><datalist id="dl-plans">{plans.map(p => <option key={p} value={p} />)}</datalist></Field>
      <Field label="Taille"><input value={v.size} onChange={e => set({ ...v, size: e.target.value })} placeholder="25K, 50K…" /></Field>
      <Field label="Daily loss limit"><select value={v.dll} onChange={e => set({ ...v, dll: e.target.value })}><option value="">—</option><option>ON</option><option>OFF</option></select></Field>
      <Field label="Consistance"><input list="dl-cons" value={v.consistency} onChange={e => set({ ...v, consistency: e.target.value })} placeholder="40%, 50%…" /><datalist id="dl-cons"><option value="40%" /><option value="50%" /></datalist></Field>
      <Field label="Nom de combinaison" hint="facultatif : ce qui distingue encore ce compte (EOD, intraday, promo…)" full><input list="dl-lab" value={v.label} onChange={e => set({ ...v, label: e.target.value })} /><datalist id="dl-lab">{labels.map(p => <option key={p} value={p} />)}</datalist></Field>
    </>
  );
}
interface Combo { plan: string; size: string; dll: string; consistency: string; label: string }
const emptyCombo: Combo = { plan: '', size: '', dll: '', consistency: '', label: '' };
const cleanCombo = (c: Combo): Combo => ({ plan: c.plan.trim(), size: c.size.trim().toUpperCase(), dll: c.dll, consistency: c.consistency.trim(), label: c.label.trim() });

function abbr(name: string) {
  const w = name.replace(/[^A-Za-z ]/g, '').split(/\s+/).filter(Boolean);
  return (w.length > 1 ? w.map(x => x[0]).join('') : name.slice(0, 3)).toUpperCase();
}

/* ---------- Achat ---------- */
function BuyModal({ onClose }: { onClose: () => void }) {
  const d = useData(); const { E } = useUi(); const toast = useToast();
  const last = ls.get('rot_lastFirm') || '';
  const fp = useFirmPicker(E.firms.some(f => f.id === last) ? last : E.firms[0]?.id || '');
  const comboFor = (id: string): Combo => { try { return { ...emptyCombo, ...JSON.parse(ls.get('rot_combo_' + id) || '{}') }; } catch { return emptyCombo; } };
  const [combo, setCombo] = useState<Combo>(comboFor(fp.firmId));
  const [date, setDate] = useState(today());
  const [price, setPrice] = useState('');
  const [qty, setQty] = useState('1');
  const [stage, setStage] = useState<Phase>('eval');
  const [names, setNames] = useState('');
  const [daysOv, setDaysOv] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (fp.firmId === '__new') return;
    setCombo(comboFor(fp.firmId));
    const lp = ls.get('rot_price_' + fp.firmId);
    const f = E.firm(fp.firmId);
    setPrice(lp ?? (f.price != null ? String(f.price) : ''));
  }, [fp.firmId]); // eslint-disable-line react-hooks/exhaustive-deps

  const typed = names.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
  const q = Math.max(1, Math.floor(+qty || 1), typed.length);
  const auto = useMemo(() => {
    const used = new Set(E.accounts.map(a => a.name).concat(typed));
    const fname = fp.firmId === '__new' ? 'NEW' : E.firm(fp.firmId).name;
    const base = abbr(fname) + combo.size.replace(/[^0-9A-Za-z]/g, '').toUpperCase().replace(/K$/, '');
    const out: string[] = []; let i = 1;
    while (out.length < q - typed.length) { const nm = `${base}-${String(i).padStart(3, '0')}`; if (!used.has(nm)) out.push(nm); i++; }
    return out;
  }, [E, fp.firmId, combo.size, q, typed.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const p = numOrNull(price) || 0;
  const autoNeed = fp.firmId !== '__new' ? E.daysNeededFor({ firm_id: fp.firmId, ...cleanCombo(combo) }, stage, 1) : null;

  const save = async () => {
    const firm_id = await fp.resolve(); if (!firm_id) return toast('Choisis une firm', 'error');
    const c = cleanCombo(combo);
    ls.set('rot_lastFirm', firm_id); ls.set('rot_combo_' + firm_id, JSON.stringify(c)); ls.set('rot_price_' + firm_id, String(p));
    const all = typed.concat(auto);
    const ov = numOrNull(daysOv);
    const accs: Account[] = all.map(name => ({ id: uid(), name, firm_id, ...c, bought_on: date || today(), phase: stage, cycle: 1, days: 0, days_needed: ov, max_payouts: null, status: 'active', end_date: null, parent_id: null, notes: note, created_at: new Date().toISOString() }));
    const txs: Tx[] = accs.map(a => ({ id: uid(), date: a.bought_on, type: 'purchase', firm_id, account_id: a.id, amount: p, gross: null, split: null, note }));
    onClose();
    if (await d.upsert('accounts', accs) && await d.upsert('tx', txs)) toast(`${plural(accs.length, 'compte ajouté', 'comptes ajoutés')} — ${money(p * accs.length, 2)}`);
  };

  return (
    <Modal open onClose={onClose} title="Acheter des comptes" width={600}
      footer={<><span className="total-l">Total <b className="num">{money(q * p, 2)}</b> pour {plural(q, 'compte')}</span><Button variant="ghost" onClick={onClose}>Annuler</Button><Button variant="primary" onClick={save}>Enregistrer l’achat</Button></>}>
      <div className="form">
        <Field label="Date"><input type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
        <Field label="Prop firm">{fp.el}</Field>
        <ComboFields v={combo} set={setCombo} firmId={fp.firmId} />
        <Field label="Prix par compte ($)"><input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} /></Field>
        <Field label="Combien"><input type="number" min={1} value={qty} onChange={e => setQty(e.target.value)} /></Field>
        <Field label="Démarre en"><select value={stage} onChange={e => setStage(e.target.value as Phase)}><option value="eval">Éval</option><option value="buffer">Financé — buffer</option><option value="followup">Financé — follow-up</option></select></Field>
        <Field label="Jours visés pour cette étape" hint={autoNeed != null ? `vide = ${autoNeed} (réglage de la firm)` : 'vide = réglage de la firm (non défini)'}><input type="number" min={0} value={daysOv} onChange={e => setDaysOv(e.target.value)} /></Field>
        <Field label="Noms des comptes" hint={auto.length ? `Noms automatiques : ${auto.slice(0, 6).join(', ')}${auto.length > 6 ? '…' : ''}` : 'un par ligne ou séparés par des virgules'} full>
          <textarea rows={2} value={names} onChange={e => setNames(e.target.value)} placeholder="Laisse vide pour nommer automatiquement, ou colle les identifiants de la firm" />
        </Field>
        <Field label="Note" full><input value={note} onChange={e => setNote(e.target.value)} placeholder="facultatif, ex. code promo" /></Field>
      </div>
    </Modal>
  );
}

/* ---------- Payout ---------- */
function PayoutModal({ accId, onClose }: { accId?: string; onClose: () => void }) {
  const d = useData(); const { E } = useUi(); const act = useActions(); const toast = useToast();
  const options = E.accounts.filter(a => a.status === 'active' || a.id === accId).sort((a, b) => E.progress(b) - E.progress(a));
  const [id, setId] = useState(accId || '');
  const a = id ? E.d.accounts[id] : null;
  const [date, setDate] = useState(today());
  const [gross, setGross] = useState('');
  const [split, setSplit] = useState('');
  const [adv, setAdv] = useState(true);
  const [note, setNote] = useState('');
  useEffect(() => { if (a) setSplit(String(E.firm(a.firm_id).split ?? 100)); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const g = numOrNull(gross) || 0, sp = numOrNull(split) || 0;
  const net = Math.round(g * sp) / 100;

  const save = async () => {
    if (!a) return toast('Choisis le compte', 'error');
    if (!(g > 0)) return toast('Indique le montant', 'error');
    if (!(sp > 0 && sp <= 100)) return toast('Le split doit être entre 1 et 100 %', 'error');
    onClose();
    const tx: Tx = { id: uid(), date, type: 'payout', firm_id: a.firm_id, account_id: a.id, amount: net, gross: g, split: sp, note };
    await d.upsert('tx', tx);
    await d.upsert('events', act.event('payout', a, { date, amount: net, tx_id: tx.id }));
    if (adv && a.status === 'active') {
      const n: Account = { ...a, days: 0, days_needed: null };
      if (n.phase !== 'followup') { n.phase = 'followup'; n.cycle = 1; }
      n.cycle = (n.cycle || 1) + 1;
      if (n.cycle > E.maxP(n)) { n.status = 'completed'; n.end_date = date; }
      await d.upsert('accounts', n);
    }
    toast(`Payout enregistré — ${money(net, 2)}`);
  };
  return (
    <Modal open onClose={onClose} title="Payout reçu"
      footer={<><Button variant="ghost" onClick={onClose}>Annuler</Button><Button variant="primary" onClick={save}>Enregistrer le payout</Button></>}>
      <div className="form">
        <Field label="Compte" full>
          <select value={id} onChange={e => setId(e.target.value)}>
            {!accId && <option value="">— choisis le compte —</option>}
            {options.map(o => <option key={o.id} value={o.id}>{o.name} — {E.firm(o.firm_id).name} ({E.stageLabel(o)})</option>)}
          </select>
        </Field>
        <Field label="Date"><input type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
        <Field label="Montant affiché par la firm ($)"><input type="number" step="0.01" value={gross} onChange={e => setGross(e.target.value)} autoFocus /></Field>
        <Field label="Ton split (%)"><input type="number" step="0.1" value={split} onChange={e => setSplit(e.target.value)} /></Field>
        <Field label="Tu reçois"><div className="num" style={{ font: '650 22px var(--display)', color: 'var(--pos)', paddingTop: 4 }}>{money(net, 2)}</div></Field>
        <label className="check field full"><input type="checkbox" checked={adv} onChange={e => setAdv(e.target.checked)} />Passer le compte au cycle de payout suivant (remet le compteur de jours à zéro)</label>
        {a && adv && a.phase === 'followup' && (a.cycle || 1) >= E.maxP(a) && <p className="field full dim" style={{ margin: 0 }}>C’est le dernier payout prévu : le compte passera en « terminé ».</p>}
        <Field label="Note" full><input value={note} onChange={e => setNote(e.target.value)} placeholder="facultatif" /></Field>
      </div>
    </Modal>
  );
}

/* ---------- Dépense / modification d'entrée ---------- */
function ExpenseModal({ tx, onClose }: { tx?: Tx; onClose: () => void }) {
  const d = useData(); const { E } = useUi(); const toast = useToast();
  const fp = useFirmPicker(tx?.firm_id || ls.get('rot_lastFirm') || '');
  const [date, setDate] = useState(tx?.date || today());
  const [type, setType] = useState<TxType>(tx?.type || 'reset');
  const [amount, setAmount] = useState(tx ? String(tx.amount) : '');
  const [acc, setAcc] = useState(tx?.account_id || '');
  const [note, setNote] = useState(tx?.note || '');
  const [del, setDel] = useState(false);
  const types = Object.entries(TX_LABEL).filter(([k]) => tx || k !== 'payout') as [TxType, string][];

  const save = async () => {
    const firm_id = await fp.resolve(); if (!firm_id) return toast('Choisis une firm', 'error');
    const amt = numOrNull(amount); if (!(amt && amt > 0)) return toast('Indique un montant', 'error');
    const keep = tx && tx.type === 'payout' && type === 'payout' && +tx.amount === amt ? { gross: tx.gross, split: tx.split } : { gross: null, split: null };
    onClose();
    if (await d.upsert('tx', { id: tx?.id || uid(), date, type, firm_id, account_id: acc || null, amount: amt, note, ...keep })) toast('Enregistré');
  };
  return (
    <Modal open onClose={onClose} title={tx ? 'Modifier l’entrée' : 'Ajouter une dépense'}
      footer={<>{tx && <Button className="left" variant="danger" onClick={() => setDel(true)}>Supprimer</Button>}<Button variant="ghost" onClick={onClose}>Annuler</Button><Button variant="primary" onClick={save}>Enregistrer</Button></>}>
      <div className="form">
        <Field label="Date"><input type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
        <Field label="Type"><select value={type} onChange={e => setType(e.target.value as TxType)}>{types.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="Prop firm">{fp.el}</Field>
        <Field label="Montant ($)"><input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} /></Field>
        <Field label="Compte (facultatif)" full>
          <select value={acc} onChange={e => { setAcc(e.target.value); const a = E.d.accounts[e.target.value]; if (a) fp.setFirmId(a.firm_id); }}>
            <option value="">— pas lié à un compte —</option>
            {[...E.accounts].sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true })).map(a => <option key={a.id} value={a.id}>{a.name} — {E.firm(a.firm_id).name}</option>)}
          </select>
        </Field>
        <Field label="Note" full><input value={note} onChange={e => setNote(e.target.value)} placeholder="ex. abonnement data, plateforme" /></Field>
      </div>
      <Confirm open={del} onClose={() => setDel(false)} danger title="Supprimer cette entrée ?" okLabel="Supprimer"
        body="Seule l’entrée d’argent est supprimée : l’étape du compte ne change pas." onOk={async () => { onClose(); await d.remove('tx', tx!.id); toast('Entrée supprimée'); }} />
    </Modal>
  );
}

/* ---------- Modifier un compte ---------- */
function EditAccModal({ acc, onClose }: { acc: Account; onClose: () => void }) {
  const d = useData(); const { E } = useUi(); const toast = useToast();
  const fp = useFirmPicker(acc.firm_id);
  const [a, setA] = useState<Account>(acc);
  const [combo, setCombo] = useState<Combo>({ plan: acc.plan, size: acc.size, dll: acc.dll, consistency: acc.consistency, label: acc.label });
  const [del, setDel] = useState(false);
  const linked = E.txOf(acc).length;
  const set = (p: Partial<Account>) => setA(x => ({ ...x, ...p }));

  const save = async () => {
    const firm_id = await fp.resolve(); if (!firm_id) return toast('Choisis une firm', 'error');
    const n: Account = { ...a, ...cleanCombo(combo), firm_id, name: a.name.trim() || acc.name };
    if (n.status !== 'active' && !n.end_date) n.end_date = today();
    if (n.status === 'active') n.end_date = null;
    onClose();
    await d.upsert('accounts', n);
    if (firm_id !== acc.firm_id) await d.upsert('tx', E.txOf(acc).map(t => ({ ...t, firm_id })));
    toast('Compte enregistré');
  };
  return (
    <Modal open onClose={onClose} title={`Modifier ${acc.name}`} width={620}
      footer={<><Button className="left" variant="danger" onClick={() => setDel(true)}>Supprimer</Button><Button variant="ghost" onClick={onClose}>Annuler</Button><Button variant="primary" onClick={save}>Enregistrer</Button></>}>
      <div className="form">
        <Field label="Nom"><input value={a.name} onChange={e => set({ name: e.target.value })} /></Field>
        <Field label="Prop firm">{fp.el}</Field>
        <ComboFields v={combo} set={setCombo} firmId={fp.firmId} />
        <Field label="Acheté le"><input type="date" value={a.bought_on} onChange={e => set({ bought_on: e.target.value })} /></Field>
        <Field label="Statut"><select value={a.status} onChange={e => set({ status: e.target.value as Status })}><option value="active">Actif</option><option value="dead">Cramé</option><option value="completed">Terminé</option></select></Field>
        <Field label="Étape"><select value={a.phase} onChange={e => set({ phase: e.target.value as Phase })}><option value="eval">Éval</option><option value="buffer">Buffer</option><option value="followup">Follow-up</option></select></Field>
        <Field label="Cycle de payout" hint="cycle 2 = après le 1er payout"><input type="number" min={1} value={a.cycle} onChange={e => set({ cycle: Math.max(1, +e.target.value || 1) })} /></Field>
        <Field label="Jours faits dans l’étape"><input type="number" min={0} value={a.days} onChange={e => set({ days: Math.max(0, +e.target.value || 0) })} /></Field>
        <Field label="Jours visés dans l’étape" hint={`vide = ${E.autoNeed(a) ?? 'non défini'} (réglages)`}><input type="number" min={0} value={a.days_needed ?? ''} onChange={e => set({ days_needed: numOrNull(e.target.value) })} /></Field>
        <Field label="Payouts max" hint={`vide = ${E.autoMaxP(a)} (réglages)`}><input type="number" min={1} value={a.max_payouts ?? ''} onChange={e => set({ max_payouts: numOrNull(e.target.value) })} /></Field>
        <Field label="Date de fin (cramé ou terminé)"><input type="date" value={a.end_date || ''} onChange={e => set({ end_date: e.target.value || null })} /></Field>
        <Field label="Notes" full><input value={a.notes} onChange={e => set({ notes: e.target.value })} /></Field>
      </div>
      <Confirm open={del} onClose={() => setDel(false)} danger title={`Supprimer ${acc.name} ?`} okLabel="Supprimer"
        body={`Supprime le compte${linked ? ` et ses ${linked} entrées d’argent liées` : ''}. Pour noter qu’il a échoué, utilise plutôt « Cramé ».`}
        onOk={async () => { onClose(); await d.remove('accounts', acc.id); toast('Compte supprimé'); }} />
    </Modal>
  );
}

/* ---------- Compte cramé ---------- */
function DieModal({ acc, onClose }: { acc: Account; onClose: () => void }) {
  const { E } = useUi(); const act = useActions();
  const [date, setDate] = useState(today());
  const [note, setNote] = useState('');
  return (
    <Modal open onClose={onClose} title={`${acc.name} a cramé`} width={480}
      footer={<><Button variant="ghost" onClick={onClose}>Annuler</Button><Button variant="danger" onClick={() => { onClose(); act.die(acc, date, note.trim()); }}>Marquer comme cramé</Button></>}>
      <p className="muted" style={{ marginTop: 0 }}>Perte notée en <b style={{ color: 'var(--text)' }}>{E.stepName(E.level(acc))}</b>, jour {(acc.days || 0) + 1}.</p>
      <div className="form">
        <Field label="Date"><input type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
        <Field label="Note"><input value={note} onChange={e => setNote(e.target.value)} placeholder="facultatif, ex. max loss sur NQ" autoFocus /></Field>
      </div>
    </Modal>
  );
}

/* ---------- Reset ---------- */
function ResetModal({ acc, onClose }: { acc: Account; onClose: () => void }) {
  const d = useData(); const { E } = useUi(); const toast = useToast();
  const base = acc.name.replace(/ R\d+$/, '');
  const [date, setDate] = useState(today());
  const [fee, setFee] = useState(E.firm(acc.firm_id).price != null ? String(E.firm(acc.firm_id).price) : '');
  const [name, setName] = useState(`${base} R${E.accounts.filter(x => x.name.startsWith(base)).length}`);
  const save = async () => {
    onClose();
    const n: Account = { ...acc, id: uid(), name: name.trim() || base + ' R', bought_on: date, phase: 'eval', cycle: 1, days: 0, days_needed: null, max_payouts: null, status: 'active', end_date: null, parent_id: acc.id, notes: '', created_at: new Date().toISOString() };
    await d.upsert('accounts', n);
    const f = numOrNull(fee); if (f && f > 0) await d.upsert('tx', { id: uid(), date, type: 'reset', firm_id: acc.firm_id, account_id: n.id, amount: f, gross: null, split: null, note: 'reset de ' + acc.name });
    toast('Nouvelle vie démarrée en éval');
  };
  return (
    <Modal open onClose={onClose} title={`Reset de ${acc.name}`} width={500}
      footer={<><Button variant="ghost" onClick={onClose}>Annuler</Button><Button variant="primary" onClick={save}>Démarrer la nouvelle vie</Button></>}>
      <p className="muted" style={{ marginTop: 0 }}>L’ancienne vie reste notée comme cramée, ton compteur de pertes reste juste. La nouvelle démarre en éval avec le prix du reset comme coût.</p>
      <div className="form">
        <Field label="Date"><input type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
        <Field label="Prix du reset ($)"><input type="number" step="0.01" value={fee} onChange={e => setFee(e.target.value)} /></Field>
        <Field label="Nom de la nouvelle vie" full><input value={name} onChange={e => setName(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}
