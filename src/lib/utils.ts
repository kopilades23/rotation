export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 9);

export const ymd = (d: Date) =>
  d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
export const today = () => ymd(new Date());
export const parseYmd = (s: string) => new Date(s + 'T00:00:00');
export const addDays = (s: string, n: number) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
export const daysBetween = (a: string, b: string) => Math.round((parseYmd(b).getTime() - parseYmd(a).getTime()) / 864e5);

const nf0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 1 234 $ — montant en dollars, format français */
export function money(n: number | null | undefined, dec?: number) {
  if (n == null || !isFinite(n)) return '—';
  const useDec = dec ?? (Math.abs(n) < 1000 && Math.round(n) !== n ? 2 : 0);
  const s = (useDec ? nf2 : nf0).format(Math.abs(n)).replace(/ /g, ' ');
  return (n < 0 ? '−' : '') + s + ' $';
}
export const signedMoney = (n: number) => (n > 0 ? '+' : '') + money(n);
export const pct = (n: number | null | undefined, dec = 1) =>
  n == null || !isFinite(n) ? '—' : (n < 0 ? '−' : '') + Math.abs(n * 100).toFixed(dec).replace('.', ',') + ' %';
export const num = (n: number | null | undefined, dec = 0) =>
  n == null || !isFinite(n) ? '—' : n.toFixed(dec).replace('.', ',');
export const tone = (n: number) => (n > 0 ? 'pos' : n < 0 ? 'neg' : '');

export const fmtD = (iso?: string | null) => {
  if (!iso) return '';
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso);
};
export const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
export const longDate = (iso: string) =>
  cap(parseYmd(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
export const shortDate = (iso: string) =>
  parseYmd(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
export const monthLabel = (k: string) => {
  const [y, m] = k.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
};
export const monthLong = (k: string) => {
  const [y, m] = k.split('-').map(Number);
  const s = new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  return s[0].toUpperCase() + s.slice(1);
};

/** dd/mm/yyyy, yyyy-mm-dd, dd.mm.yy → yyyy-mm-dd */
export function normDate(s: string): string {
  s = (s || '').trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0');
  m = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? '20' + m[3] : m[3];
    if (+m[2] < 1 || +m[2] > 12 || +m[1] < 1 || +m[1] > 31) return '';
    return y + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
  }
  return '';
}

export const numOrNull = (v: unknown): number | null => {
  if (v === '' || v == null) return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.').replace(/[^0-9.\-]/g, ''));
  return isFinite(n) ? n : null;
};
/** "62.06, 62.06, 78.83" ou "62,06 ; 62,06" ou "62 64 70" → nombres */
export const numList = (v: string | null | undefined): (number | null)[] => {
  const s = String(v ?? '').trim();
  if (!s) return [];
  // "62.06,62.06" (points décimaux + virgules) → la virgule sépare
  const parts = /\./.test(s) ? s.split(/[;,|\s]+/) : s.split(/\s*[;|]\s*|\s*,\s+|\s+/);
  return parts.map(x => x.trim()).filter(Boolean).map(x => numOrNull(x.replace(',', '.')));
};

export const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);
export const avg = (a: number[]) => (a.length ? sum(a) / a.length : NaN);
export const median = (a: number[]) => {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y); const h = s.length >> 1;
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
};

export const plural = (n: number, one: string, many?: string) => `${n} ${n > 1 || n === 0 ? many ?? one + 's' : one}`;

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const CATEGORICAL = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'];
