import { useState } from 'react';
import { motion } from 'motion/react';
import { supabase } from '../lib/supabase';
import { Button, Field, Segmented } from '../components/ui';
import { Mark } from '../components/Mark';

export function Auth() {
  const [mode, setMode] = useState<'in' | 'up' | 'magic'>('in');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!supabase) return;
    setBusy(true); setMsg(null);
    try {
      if (mode === 'magic') {
        const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin } });
        if (error) throw error; setMsg({ t: 'Lien envoyé. Ouvre ton e-mail sur cet appareil pour te connecter.', ok: true });
      } else if (mode === 'up') {
        const { data, error } = await supabase.auth.signUp({ email, password: pw, options: { emailRedirectTo: location.origin } });
        if (error) throw error;
        if (!data.session) setMsg({ t: 'Compte créé. Confirme ton adresse via l’e-mail reçu, puis connecte-toi.', ok: true });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
        if (error) throw error;
      }
    } catch (err) {
      const m = (err as Error).message || '';
      setMsg({ t: /invalid login/i.test(m) ? 'E-mail ou mot de passe incorrect.' : /not confirmed/i.test(m) ? 'Adresse pas encore confirmée : clique sur le lien reçu par e-mail.' : m, ok: false });
    } finally { setBusy(false); }
  };

  return (
    <div className="auth">
      <div className="auth-art">
        <div className="brand"><Mark size={34} /><span className="brand-name">Rotation</span></div>
        <div>
          <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}>Chaque éval achetée, chaque payout encaissé.</motion.h1>
          <p>Le journal de ta rotation de comptes prop firm : achats, jours gagnants, buffers, payouts, comptes cramés. Et les chiffres qui disent si ton business tourne.</p>
        </div>
        <AuthFlow />
      </div>
      <div className="auth-form">
        <form className="auth-card" onSubmit={submit}>
          <h2>{mode === 'up' ? 'Créer ton compte' : 'Connexion'}</h2>
          <Segmented id="auth" value={mode} onChange={v => { setMode(v); setMsg(null); }} options={[{ value: 'in', label: 'Mot de passe' }, { value: 'magic', label: 'Lien par e-mail' }, { value: 'up', label: 'Créer un compte' }]} />
          <Field label="E-mail"><input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></Field>
          {mode !== 'magic' && <Field label="Mot de passe" hint={mode === 'up' ? '8 caractères minimum' : undefined}><input type="password" required minLength={mode === 'up' ? 8 : 1} autoComplete={mode === 'up' ? 'new-password' : 'current-password'} value={pw} onChange={e => setPw(e.target.value)} /></Field>}
          <Button variant="primary" type="submit" disabled={busy}>{busy ? 'Un instant…' : mode === 'up' ? 'Créer le compte' : mode === 'magic' ? 'Recevoir le lien' : 'Se connecter'}</Button>
          {msg && <p style={{ margin: 0, fontSize: 13.5 }} className={msg.ok ? 'pos' : 'neg'}>{msg.t}</p>}
          <p className="dim" style={{ fontSize: 12.5, margin: 0 }}>Tes données sont privées : chaque ligne de la base est liée à ton compte et personne d’autre ne peut la lire.</p>
        </form>
      </div>
    </div>
  );
}

function AuthFlow() {
  const steps = [{ l: 'Évals', n: 120, c: '#8d7dff' }, { l: 'Buffer', n: 52, c: '#2fd3bf' }, { l: 'P1', n: 31, c: '#ecd49c' }, { l: 'P2', n: 19, c: '#ecd49c' }, { l: 'P3', n: 11, c: '#ecd49c' }, { l: 'P4', n: 6, c: '#ecd49c' }];
  return (
    <div className="auth-flow" style={{ display: 'flex', alignItems: 'flex-end', gap: 14, height: 170, maxWidth: 560 }} aria-hidden>
      {steps.map((s, i) => (
        <div key={s.l} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}>
          <motion.div initial={{ height: 0 }} animate={{ height: (s.n / 120) * 130 }} transition={{ delay: 0.3 + i * 0.1, duration: 0.9, ease: [0.16, 1, 0.3, 1] }} style={{ borderRadius: 10, background: s.c, boxShadow: `0 0 24px ${s.c}66` }} />
          <div className="dim" style={{ fontSize: 12, marginTop: 8, textAlign: 'center' }}>{s.l}</div>
        </div>
      ))}
    </div>
  );
}
