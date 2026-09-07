import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export interface TradeTransaction {
  id: string;
  type: 'deposit' | 'withdrawal' | 'funding_fee';
  amount: number;
  note: string;
  createdAt: string;
}

export interface ExnessTransactionImportSummary {
  imported: number;
  skippedDuplicates: number;
  skippedInvalid: number;
  deposits: number;
  withdrawals: number;
  importedNet: number;
  warnings: string[];
}

interface TradeSettingsStore {
  initialBalance: number;
  transactions: TradeTransaction[];
  loading: boolean;
  fetchSettings: () => Promise<void>;
  setInitialBalance: (v: number) => Promise<void>;
  addTransaction: (
    type: 'deposit' | 'withdrawal' | 'funding_fee',
    amount: number,
    note: string
  ) => Promise<void>;
  importExnessTransactions: (rawJson: string) => Promise<ExnessTransactionImportSummary>;
  deleteTransaction: (id: string) => Promise<void>;
}

interface ExnessAmount {
  raw?: unknown;
  value?: unknown;
  currency?: unknown;
}

interface ExnessTransactionInput {
  type?: unknown;
  status?: unknown;
  dateText?: unknown;
  sectionDateText?: unknown;
  timeText?: unknown;
  invoiceId?: unknown;
  transactionId?: unknown;
  amount?: ExnessAmount | null;
  from?: unknown;
  to?: unknown;
  details?: unknown;
  rawText?: unknown;
}

interface ExnessPayload {
  schemaVersion?: unknown;
  source?: unknown;
  scrapedAt?: unknown;
  transactions?: unknown;
}

interface PreparedExnessTransaction {
  type: 'deposit' | 'withdrawal';
  amount: number;
  note: string;
  createdAt: string;
  dedupeKey: string;
  originalType: 'Deposit' | 'Withdrawal';
}

const EXNESS_MARKER_PREFIX = '[EXNESS_TX:';
const PHT_OFFSET_HOURS = 8;

const MONTHS: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

const mapTx = (t: Record<string, unknown>): TradeTransaction => ({
  id: t.id as string,
  type: t.type as 'deposit' | 'withdrawal' | 'funding_fee',
  amount: Number(t.amount),
  note: (t.note as string) ?? '',
  createdAt: t.created_at as string,
});

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asDetails(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' || typeof item === 'number' ? String(item).trim() : ''))
    .filter(Boolean);
}

function monthIndex(name: string): number | null {
  return MONTHS[name.toLowerCase()] ?? null;
}

function toPhtIso(year: number, month: number, day: number, hour: number, minute: number): string {
  return new Date(Date.UTC(year, month, day, hour - PHT_OFFSET_HOURS, minute, 0, 0)).toISOString();
}

function parseExnessTimestamp(tx: ExnessTransactionInput, scrapedAt: string | null): string | null {
  const dateText = asString(tx.dateText);
  const sectionDateText = asString(tx.sectionDateText);
  const timeText = asString(tx.timeText);
  const scrapedDate = scrapedAt ? new Date(scrapedAt) : new Date();
  const fallbackYear = Number.isNaN(scrapedDate.getTime()) ? new Date().getUTCFullYear() : scrapedDate.getUTCFullYear();

  if (dateText) {
    // Examples: "05 Sep, 12:00" or "05 Sep 2026, 12:00".
    const match = dateText.match(/^(\d{1,2})\s+([A-Za-z]+)(?:\s+(\d{4}))?,?\s+(\d{1,2}):(\d{2})$/);
    if (match) {
      const dayText = match[1];
      const monthText = match[2];
      const yearText = match[3];
      const hourText = match[4];
      const minuteText = match[5];
      if (dayText && monthText && hourText && minuteText) {
        const month = monthIndex(monthText);
        if (month !== null) {
          return toPhtIso(
            yearText ? Number(yearText) : fallbackYear,
            month,
            Number(dayText),
            Number(hourText),
            Number(minuteText)
          );
        }
      }
    }
  }

  if (sectionDateText && timeText) {
    // Example: "Today, 07 September 2026" + "16:03".
    const dateMatch = sectionDateText.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
    const timeMatch = timeText.match(/^(\d{1,2}):(\d{2})$/);
    if (dateMatch && timeMatch) {
      const dayText = dateMatch[1];
      const monthText = dateMatch[2];
      const yearText = dateMatch[3];
      const hourText = timeMatch[1];
      const minuteText = timeMatch[2];
      if (dayText && monthText && yearText && hourText && minuteText) {
        const month = monthIndex(monthText);
        if (month !== null) {
          return toPhtIso(
            Number(yearText),
            month,
            Number(dayText),
            Number(hourText),
            Number(minuteText)
          );
        }
      }
    }
  }

  // Last-resort fallback: use scrape date + transaction time if present.
  if (timeText && !Number.isNaN(scrapedDate.getTime())) {
    const timeMatch = timeText.match(/^(\d{1,2}):(\d{2})$/);
    if (timeMatch) {
      const hourText = timeMatch[1];
      const minuteText = timeMatch[2];
      if (!hourText || !minuteText) return null;
      const phtScrape = new Date(scrapedDate.getTime() + PHT_OFFSET_HOURS * 60 * 60 * 1000);
      return toPhtIso(
        phtScrape.getUTCFullYear(),
        phtScrape.getUTCMonth(),
        phtScrape.getUTCDate(),
        Number(hourText),
        Number(minuteText)
      );
    }
  }

  return null;
}

function exnessKey(tx: ExnessTransactionInput): string | null {
  // Exness Invoice ID is the canonical unique key for cash-flow imports.
  // Transactions without an Invoice ID are skipped so repeated pastes can never duplicate them.
  return asString(tx.invoiceId);
}

function buildNote(
  tx: ExnessTransactionInput,
  key: string,
  originalType: 'Deposit' | 'Withdrawal'
): string {
  const invoiceId = asString(tx.invoiceId);
  const details = asDetails(tx.details);
  const status = asString(tx.status);
  const parts = ['Exness', originalType];
  if (status) parts.push(status);
  if (invoiceId) parts.push(`Invoice ${invoiceId}`);
  if (details.length > 0) parts.push(details.join(' → '));
  parts.push(`${EXNESS_MARKER_PREFIX}${key}]`);
  return parts.join(' · ');
}

function isLegacyExnessTransfer(tx: TradeTransaction): boolean {
  return /Exness\s*·\s*Transfer\s+(In|Out)/i.test(tx.note);
}

function prepareExnessTransactions(payload: ExnessPayload): {
  prepared: PreparedExnessTransaction[];
  skippedInvalid: number;
  warnings: string[];
} {
  if (asString(payload.source)?.toLowerCase() !== 'exness') {
    throw new Error('This JSON is not an Exness transaction-history export.');
  }
  if (!Array.isArray(payload.transactions)) {
    throw new Error('No transactions array was found in the pasted JSON.');
  }

  const scrapedAt = asString(payload.scrapedAt);
  const rawTransactions = payload.transactions.filter(
    (item): item is ExnessTransactionInput => typeof item === 'object' && item !== null
  );
  const prepared: PreparedExnessTransaction[] = [];
  const warnings: string[] = [];
  let skippedInvalid = payload.transactions.length - rawTransactions.length;

  for (const tx of rawTransactions) {
    const rawType = asString(tx.type);
    if (!rawType) {
      skippedInvalid += 1;
      continue;
    }

    const normalizedType = rawType.toLowerCase();

    // Cash-flow sync intentionally ignores Transfers. They are movement between Exness endpoints,
    // not a Deposit/Withdrawal adjustment for the Project Discipline balance.
    if (normalizedType !== 'deposit' && normalizedType !== 'withdrawal') continue;

    const status = asString(tx.status)?.toLowerCase();
    if (status !== 'done' && status !== 'sent') continue;

    const invoiceId = exnessKey(tx);
    if (!invoiceId) {
      skippedInvalid += 1;
      warnings.push(`Skipped ${rawType}: missing Invoice ID.`);
      continue;
    }

    const amountValue = Number(tx.amount?.value);
    if (!Number.isFinite(amountValue) || amountValue === 0) {
      skippedInvalid += 1;
      continue;
    }

    const createdAt = parseExnessTimestamp(tx, scrapedAt);
    if (!createdAt) {
      skippedInvalid += 1;
      warnings.push(`Skipped ${rawType} ${invoiceId}: date/time could not be read.`);
      continue;
    }

    const isDeposit = normalizedType === 'deposit';
    const type: 'deposit' | 'withdrawal' = isDeposit ? 'deposit' : 'withdrawal';
    const signedAmount = isDeposit ? Math.abs(amountValue) : -Math.abs(amountValue);
    const originalType: 'Deposit' | 'Withdrawal' = isDeposit ? 'Deposit' : 'Withdrawal';

    prepared.push({
      type,
      amount: signedAmount,
      note: buildNote(tx, invoiceId, originalType),
      createdAt,
      dedupeKey: invoiceId,
      originalType,
    });
  }

  return { prepared, skippedInvalid, warnings };
}

export const useTradeSettingsStore = create<TradeSettingsStore>((set, get) => ({
  initialBalance: 0,
  transactions: [],
  loading: false,

  fetchSettings: async () => {
    set({ loading: true });

    const { data: settingsData } = await supabase
      .from('trade_settings')
      .select('initial_balance')
      .single();

    const { data: txData } = await supabase
      .from('trade_transactions')
      .select('*')
      .order('created_at', { ascending: false });

    set({
      initialBalance: settingsData ? Number(settingsData.initial_balance) : 0,
      // Keep legacy Transfer rows in Supabase for audit/history, but do not load them into
      // the active balance model. Only Deposit / Withdrawal cash flow should affect DayFlow.
      transactions: (txData ?? []).map(mapTx).filter((tx) => !isLegacyExnessTransfer(tx)),
      loading: false,
    });
  },

  setInitialBalance: async (initialBalance) => {
    set({ initialBalance });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('trade_settings')
      .upsert(
        { user_id: user.id, initial_balance: initialBalance, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );
  },

  addTransaction: async (type, amount, note) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('trade_transactions')
      .insert({ user_id: user.id, type, amount, note })
      .select()
      .single();

    if (data) {
      set((s) => ({ transactions: [mapTx(data), ...s.transactions] }));
    }
  },

  importExnessTransactions: async (rawJson) => {
    let payload: ExnessPayload;
    try {
      payload = JSON.parse(rawJson) as ExnessPayload;
    } catch {
      throw new Error('The pasted Exness transaction history is not valid JSON.');
    }

    const { prepared, skippedInvalid, warnings } = prepareExnessTransactions(payload);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('You need to be signed in before syncing Exness transactions.');

    // Dedupe against BOTH the current in-memory history and the persisted Supabase history.
    // This makes repeated / overlapping JSON pastes incremental: old transactions remain,
    // and only Invoice IDs that DayFlow has never seen before are appended.
    const existingKeys = new Set<string>();
    const collectKey = (note: string) => {
      const markerMatch = note.match(/\[EXNESS_TX:([^\]]+)\]/);
      if (markerMatch?.[1]) existingKeys.add(markerMatch[1]);
    };

    for (const tx of get().transactions) collectKey(tx.note);

    const { data: persistedRows, error: existingError } = await supabase
      .from('trade_transactions')
      .select('note')
      .eq('user_id', user.id);
    if (existingError) {
      throw new Error(`Could not check existing Exness Invoice IDs: ${existingError.message}`);
    }
    for (const row of persistedRows ?? []) {
      if (typeof row.note === 'string') collectKey(row.note);
    }

    const batchKeys = new Set<string>();
    let skippedDuplicates = 0;
    const newTransactions = prepared.filter((tx) => {
      if (existingKeys.has(tx.dedupeKey) || batchKeys.has(tx.dedupeKey)) {
        skippedDuplicates += 1;
        return false;
      }
      batchKeys.add(tx.dedupeKey);
      return true;
    });

    const summary: ExnessTransactionImportSummary = {
      imported: 0,
      skippedDuplicates,
      skippedInvalid,
      deposits: 0,
      withdrawals: 0,
      importedNet: 0,
      warnings,
    };

    for (const tx of newTransactions) {
      if (tx.originalType === 'Deposit') summary.deposits += 1;
      if (tx.originalType === 'Withdrawal') summary.withdrawals += 1;
      summary.importedNet += tx.amount;
    }

    if (newTransactions.length === 0) return summary;

    const rows = newTransactions.map((tx) => ({
      user_id: user.id,
      type: tx.type,
      amount: tx.amount,
      note: tx.note,
      created_at: tx.createdAt,
    }));

    const { data, error } = await supabase.from('trade_transactions').insert(rows).select('*');
    if (error) throw new Error(`Could not save Exness transactions: ${error.message}`);

    const imported = (data ?? []).map(mapTx);
    summary.imported = imported.length;

    if (imported.length > 0) {
      set((s) => ({
        transactions: [...imported, ...s.transactions].sort((a, b) =>
          b.createdAt.localeCompare(a.createdAt)
        ),
      }));
    }

    return summary;
  },

  deleteTransaction: async (id) => {
    await supabase.from('trade_transactions').delete().eq('id', id);
    set((s) => ({ transactions: s.transactions.filter((t) => t.id !== id) }));
  },
}));
