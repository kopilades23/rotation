import { createContext, useCallback, useContext, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { AnimatePresence, animate, motion, useReducedMotion } from 'motion/react';
import { X, Check, AlertTriangle } from 'lucide-react';
import { STAGE_COLOR } from '../lib/logic';

/* ---------- Toast ---------- */
type ToastKind = 'ok' | 'error';
const ToastCtx = createContext<(msg: string, kind?: ToastKind) => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<{ id: number; msg: string; kind: ToastKind }[]>([]);
  const push = useCallback((msg: string, kind: ToastKind = 'ok') => {
    const id = Date.now() + Math.random();
    setItems(l => [...l.slice(-2), { id, msg, kind }]);
    setTimeout(() => setItems(l => l.filter(x => x.id !== id)), kind === 'error' ? 6000 : 2600);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        <AnimatePresence>
          {items.map(t => (
            <motion.div key={t.id} className={`toast ${t.kind}`} layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}>
              {t.kind === 'error' ? <AlertTriangle size={16} /> : <Check size={16} />}<span>{t.msg}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------- Boutons ---------- */
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'soft' | 'danger' | 'success' | 'plain'; size?: 'sm' | 'md'; icon?: ReactNode };
export function Button({ variant = 'soft', size = 'md', icon, className = '', children, ...rest }: BtnProps) {
  return (
    <button {...rest} className={`btn btn-${variant} btn-${size} ${className}`}>
      {icon}{children && <span>{children}</span>}
    </button>
  );
}

/* ---------- Modale ---------- */
export function Modal({ open, onClose, title, children, footer, width = 560 }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; width?: number }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="modal-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
          <motion.div className="modal" role="dialog" aria-modal="true" style={{ maxWidth: width }}
            initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}>
            <header className="modal-hd"><h2>{title}</h2><button className="icon-btn" onClick={onClose} aria-label="Fermer"><X size={18} /></button></header>
            <div className="modal-body">{children}</div>
            {footer && <footer className="modal-ft">{footer}</footer>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Field({ label, hint, children, full }: { label: ReactNode; hint?: ReactNode; children: ReactNode; full?: boolean }) {
  return (
    <label className={`field ${full ? 'full' : ''}`}>
      <span className="field-l">{label}</span>
      {children}
      {hint && <span className="field-h">{hint}</span>}
    </label>
  );
}

/* ---------- Segments (onglets compacts) ---------- */
export function Segmented<T extends string>({ value, onChange, options, id }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; id: string }) {
  return (
    <div className="seg" role="tablist">
      {options.map(o => (
        <button key={o.value} role="tab" aria-selected={o.value === value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.value === value && <motion.span layoutId={'seg-' + id} className="seg-ind" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
          <span className="seg-t">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

/* ---------- Étiquette d'étape ---------- */
export function StageTag({ stage, children }: { stage: string; children: ReactNode }) {
  return <span className="tag" style={{ ['--c' as string]: STAGE_COLOR[stage] || '#8892a8' }}><i />{children}</span>;
}
export const Dot = ({ color }: { color: string }) => <span className="dot" style={{ background: color }} />;

/* ---------- Nombre animé ---------- */
export function AnimatedNumber({ value, format, className }: { value: number; format: (n: number) => string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (!isFinite(value)) { el.textContent = format(value); return; }
    if (reduce) { el.textContent = format(value); prev.current = value; return; }
    const c = animate(prev.current, value, { duration: 1.1, ease: [0.16, 1, 0.3, 1], onUpdate: v => { el.textContent = format(v); } });
    prev.current = value;
    return () => c.stop();
  }, [value, format, reduce]);
  return <span ref={ref} className={className}>{format(isFinite(value) ? 0 : value)}</span>;
}

/** Compteur à rouleaux : chaque chiffre défile jusqu'à sa valeur */
export function Odometer({ text, className }: { text: string; className?: string }) {
  const chars = text.split('');
  const n = chars.length;
  return (
    <span className={`odo ${className || ''}`} aria-label={text} role="text">
      {chars.map((ch, i) => /\d/.test(ch)
        ? <Digit key={'d' + (n - i)} d={+ch} delay={0.05 * i} />
        : <span key={'s' + (n - i)} className="odo-s" aria-hidden>{ch}</span>)}
    </span>
  );
}
function Digit({ d, delay }: { d: number; delay: number }) {
  return (
    <span className="odo-d" aria-hidden>
      <motion.span className="odo-col" initial={{ y: '0em' }} animate={{ y: `${-d}em` }} transition={{ type: 'spring', stiffness: 70, damping: 16, mass: 0.9, delay }}>
        {Array.from({ length: 10 }, (_, k) => <span key={k}>{k}</span>)}
      </motion.span>
    </span>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-t">{title}</div>
      {children && <div className="empty-b">{children}</div>}
      {action}
    </div>
  );
}

export function Panel({ title, sub, actions, children, className = '', pad = true }: { title?: ReactNode; sub?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  // reflet qui suit la souris
  const onMove = (e: React.MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
  };
  return (
    <section className={`panel ${pad ? '' : 'nopad'} ${className}`} onMouseMove={onMove}>
      {(title || actions) && (
        <header className="panel-hd">
          <div><h3>{title}</h3>{sub && <p className="panel-sub">{sub}</p>}</div>
          {actions && <div className="panel-act">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Confirm({ open, title, body, okLabel, danger, onOk, onClose }: { open: boolean; title: string; body: ReactNode; okLabel: string; danger?: boolean; onOk: () => void; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title={title} width={460}
      footer={<><Button variant="ghost" onClick={onClose}>Annuler</Button><Button variant={danger ? 'danger' : 'primary'} onClick={() => { onClose(); onOk(); }}>{okLabel}</Button></>}>
      <div className="muted">{body}</div>
    </Modal>
  );
}
