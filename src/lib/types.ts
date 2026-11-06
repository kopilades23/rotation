export type Phase = 'eval' | 'buffer' | 'followup';
export type Status = 'active' | 'dead' | 'completed';
export type TxType = 'purchase' | 'reset' | 'activation' | 'fee' | 'payout';
export type EventType = 'win' | 'red' | 'pass_eval' | 'buffer_done' | 'payout' | 'died';

export interface Firm {
  id: string;
  name: string;
  color: string;
  eval_days: number | null;
  buffer_days: number | null;
  funded_days: number | null; // jours gagnants par payout
  max_payouts: number | null;
  price: number | null;
  split: number | null; // % reçu
  has_buffer: boolean;
  sort: number;
}

export interface Plan {
  id: string;
  firm_id: string;
  plan: string;
  size: string;
  dll: string;
  consistency: string;
  label: string;
  eval_days: number | null;
  p_eval: number | null; // %
  p_eval_day: string; // "62, 62, 78"
  p_buffer: number | null; // %
  p_follow: string; // "79, 64, 56"
  max_payouts: number | null;
  price_first: number | null;
  price_reset: number | null;
  payouts: string; // "1800, 1238"
  source: string;
}

export interface Account {
  id: string;
  name: string;
  firm_id: string;
  plan: string;
  size: string;
  dll: string;
  consistency: string;
  label: string;
  bought_on: string; // yyyy-mm-dd
  phase: Phase;
  cycle: number; // follow-up : 1 = vers le 1er payout
  days: number; // jours gagnants faits dans l'étape
  days_needed: number | null; // forçage manuel
  max_payouts: number | null; // forçage manuel
  status: Status;
  end_date: string | null;
  parent_id: string | null;
  notes: string;
  created_at?: string;
}

export interface Tx {
  id: string;
  date: string;
  type: TxType;
  firm_id: string;
  account_id: string | null;
  amount: number;
  gross: number | null;
  split: number | null;
  note: string;
}

export interface Ev {
  id: string;
  date: string;
  ts: number;
  type: EventType;
  account_id: string | null;
  firm_id: string | null;
  phase: Phase | null;
  cycle: number | null;
  day: number | null;
  amount: number | null;
  tx_id: string | null;
  note: string;
}

export interface Link { type: string; label: string; url: string }

export interface Settings {
  links: Link[];
  goal: number | null; // objectif de bankroll
  start_bankroll: number | null;
  start_date: string | null; // la bankroll de départ compte à partir de ce jour
  handle: string;
}

export interface Tables {
  firms: Record<string, Firm>;
  plans: Record<string, Plan>;
  accounts: Record<string, Account>;
  tx: Record<string, Tx>;
  events: Record<string, Ev>;
}
export type TableName = keyof Tables;
export type Row<T extends TableName> = Tables[T][string];
