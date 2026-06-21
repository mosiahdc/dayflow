import { useEffect, useState, useMemo } from 'react';
import { format, parseISO, subDays } from 'date-fns';
import { useTradeJournalStore } from '@/store/tradeJournalStore';
import { useTradeSettingsStore } from '@/store/tradeSettingsStore';
import type { MentalState, SessionGrade } from '@/store/tradeJournalStore';

// UTC+8 today
function todayUTC8(): string {
  const now = new Date();
  return new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

const MENTAL_STATES: MentalState[] = [
  'Calm',
  'Bored',
  'Rushed',
  'Confident',
  'Hyped',
  'Neutral',
  'Ecstatic',
  'Impatient',
];
const MENTAL_COLORS: Record<MentalState, string> = {
  Calm: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  Bored: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  Rushed: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  Confident: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  Hyped: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  Neutral: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  Ecstatic: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  Impatient: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
};

// ── Tri-toggle: null | true | false ─────────────────────────────────────────

function YesNoToggle({
  value,
  onChange,
  nullLabel = '—',
}: {
  value: boolean | null;
  onChange: (v: boolean | null) => void;
  nullLabel?: string;
}) {
  return (
    <div className="flex gap-1 items-center">
      <button
        onClick={() => onChange(value === true ? null : true)}
        className={`text-xs px-2 py-0.5 rounded font-semibold transition-all ${value === true ? 'bg-green-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-brand-muted hover:bg-green-100'}`}
      >
        Y
      </button>
      <button
        onClick={() => onChange(value === false ? null : false)}
        className={`text-xs px-2 py-0.5 rounded font-semibold transition-all ${value === false ? 'bg-red-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-brand-muted hover:bg-red-100'}`}
      >
        N
      </button>
      {value === null && <span className="text-xs text-brand-muted">{nullLabel}</span>}
    </div>
  );
}

// ── Trade row (one of 3 trades) ──────────────────────────────────────────────

function TradeRow({
  tradeNumber,
  date,
  circuitLocked,
  onSave,
}: {
  tradeNumber: 1 | 2 | 3;
  date: string;
  circuitLocked: boolean;
  onSave: (data: {
    emaSetup: boolean | null;
    roePercent: number | null;
    pnlAmount: number | null;
    mentalState: MentalState | null;
    rulesMaintained: boolean | null;
  }) => void;
}) {
  const { entries } = useTradeJournalStore();
  const existing = entries.find((e) => e.date === date && e.tradeNumber === tradeNumber);

  const [ema, setEma] = useState<boolean | null>(existing?.emaSetup ?? null);
  const [roe, setRoe] = useState(existing?.roePercent != null ? String(existing.roePercent) : '');
  const [pnl, setPnl] = useState(existing?.pnlAmount != null ? String(existing.pnlAmount) : '');
  const [mental, setMental] = useState<MentalState | null>(existing?.mentalState ?? null);
  const [rules, setRules] = useState<boolean | null>(existing?.rulesMaintained ?? null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Sync when existing changes (store reload)
  useEffect(() => {
    if (existing) {
      setEma(existing.emaSetup ?? null);
      setRoe(existing.roePercent != null ? String(existing.roePercent) : '');
      setPnl(existing.pnlAmount != null ? String(existing.pnlAmount) : '');
      setMental(existing.mentalState ?? null);
      setRules(existing.rulesMaintained ?? null);
    }
  }, [existing?.id]);

  const tradeLabel = ['Trade 1', 'Trade 2', 'Trade 3'][tradeNumber - 1];
  const isLocked = circuitLocked && tradeNumber === 3;

  const save = async () => {
    setSaving(true);
    await onSave({
      emaSetup: ema,
      roePercent: roe ? parseFloat(roe) : null,
      pnlAmount: pnl ? parseFloat(pnl) : null,
      mentalState: mental,
      rulesMaintained: rules,
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div
      className={`grid items-center gap-2 px-3 py-2.5 border-b dark:border-gray-700
      ${isLocked ? 'opacity-40 pointer-events-none' : 'hover:bg-gray-50 dark:hover:bg-gray-700/20'}`}
      style={{ gridTemplateColumns: '72px 80px 80px 100px 80px 120px 70px' }}
    >
      <span className="text-xs font-semibold dark:text-white">{tradeLabel}</span>

      {/* EMA Setup */}
      <YesNoToggle value={ema} onChange={setEma} />

      {/* ROE % */}
      <div className="flex items-center gap-1">
        <input
          type="number"
          step="0.01"
          value={roe}
          onChange={(e) => setRoe(e.target.value)}
          placeholder="0.00"
          className="w-full text-xs border rounded px-2 py-1 dark:bg-gray-700 dark:text-white dark:border-gray-600"
        />
        <span className="text-xs text-brand-muted">%</span>
      </div>

      {/* P&L */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-brand-muted">$</span>
        <input
          type="number"
          step="0.0001"
          value={pnl}
          onChange={(e) => setPnl(e.target.value)}
          placeholder="0.00"
          className="w-full text-xs border rounded px-2 py-1 dark:bg-gray-700 dark:text-white dark:border-gray-600"
        />
      </div>

      {/* Mental state */}
      <select
        value={mental ?? ''}
        onChange={(e) => setMental((e.target.value as MentalState) || null)}
        className="text-xs border rounded px-1 py-1 dark:bg-gray-700 dark:text-white dark:border-gray-600"
      >
        <option value="">— Pick —</option>
        {MENTAL_STATES.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>

      {/* Rules maintained */}
      <YesNoToggle value={rules} onChange={setRules} />

      {/* Save */}
      <button
        onClick={save}
        disabled={saving}
        className={`text-xs px-2 py-1 rounded font-semibold transition-all
          ${saved ? 'bg-green-500 text-white' : 'bg-brand-accent text-white hover:opacity-90 disabled:opacity-50'}`}
      >
        {saving ? '…' : saved ? '✓ Saved' : 'Save'}
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TradeJournal() {
  const { entries, assessments, fetchJournal, upsertEntry, upsertAssessment, loading } =
    useTradeJournalStore();
  const { initialBalance, transactions } = useTradeSettingsStore();
  const [selectedDate, setSelectedDate] = useState(todayUTC8());
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    fetchJournal();
  }, [fetchJournal]);

  const today = todayUTC8();

  // Weekly capital = initial + tx net (no PNL since week is in-progress)
  const txNet = transactions.reduce((s, t) => s + t.amount, 0);
  const weeklyCapital = initialBalance + txNet;
  const baseMargin = weeklyCapital * 0.1;
  const tpDollar = baseMargin * 0.35;
  const slDollar = baseMargin;

  // Assessment for selected date
  const assessment = assessments.find((a) => a.date === selectedDate);
  const dayEntries = entries.filter((e) => e.date === selectedDate);

  // Circuit breaker: loss on trade 1 or trade 2 locks trade 3
  const hasLoss = dayEntries.some(
    (e) => e.rulesMaintained === false || (e.pnlAmount != null && e.pnlAmount < 0)
  );
  const circuitLocked = assessment?.lossOccurred ?? hasLoss;

  // Today's stats
  const todayEntries = entries.filter((e) => e.date === today);
  const todayWins = todayEntries.filter((e) => (e.pnlAmount ?? 0) > 0).length;
  const todayLosses = todayEntries.filter((e) => (e.pnlAmount ?? 0) < 0).length;

  // Past 14 days for history
  const pastDays = useMemo(() => {
    const days: string[] = [];
    for (let i = 1; i <= 14; i++) {
      const d = format(subDays(parseISO(today), i), 'yyyy-MM-dd');
      if (assessments.find((a) => a.date === d) || entries.find((e) => e.date === d)) days.push(d);
    }
    return days;
  }, [assessments, entries, today]);

  const saveAssessment = async (patch: Partial<typeof assessment>) => {
    await upsertAssessment({
      date: selectedDate,
      lossOccurred: patch?.lossOccurred ?? assessment?.lossOccurred ?? false,
      circuitBreakerExecuted:
        patch?.circuitBreakerExecuted ?? assessment?.circuitBreakerExecuted ?? null,
      chasingOccurred: patch?.chasingOccurred ?? assessment?.chasingOccurred ?? false,
      grade: patch?.grade !== undefined ? patch.grade : (assessment?.grade ?? null),
      notes: patch?.notes ?? assessment?.notes ?? '',
    });
  };

  const gradeColor = (g: SessionGrade) =>
    g === 'A'
      ? 'bg-green-500 text-white'
      : g === 'F'
        ? 'bg-red-500 text-white'
        : 'bg-gray-100 dark:bg-gray-700 text-brand-muted';

  return (
    <div className="flex flex-col gap-4">
      {/* ── Weekly block ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 shadow p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted mb-3">
            Weekly Block — updated every Monday
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-brand-muted">Starting weekly capital</p>
              <p className="text-lg font-bold dark:text-white">${weeklyCapital.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-brand-muted">Base trade margin (10%)</p>
              <p className="text-lg font-bold text-brand-accent">${baseMargin.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-brand-muted">TP target (+35% ROE)</p>
              <p className="text-base font-bold text-green-600 dark:text-green-400">
                +${tpDollar.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-brand-muted">Hard SL (−100% ROE)</p>
              <p className="text-base font-bold text-red-500 dark:text-red-400">
                −${slDollar.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 shadow p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted mb-3">
            Today's session — {format(parseISO(today), 'MMM d, yyyy')}
          </p>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="text-center bg-gray-50 dark:bg-gray-700/50 rounded-lg py-2">
              <p className="text-xl font-bold dark:text-white">{todayEntries.length}</p>
              <p className="text-[10px] text-brand-muted">Trades taken</p>
            </div>
            <div className="text-center bg-green-50 dark:bg-green-900/20 rounded-lg py-2">
              <p className="text-xl font-bold text-green-600 dark:text-green-400">{todayWins}</p>
              <p className="text-[10px] text-green-600 dark:text-green-400">Wins</p>
            </div>
            <div className="text-center bg-red-50 dark:bg-red-900/20 rounded-lg py-2">
              <p className="text-xl font-bold text-red-500 dark:text-red-400">{todayLosses}</p>
              <p className="text-[10px] text-red-500 dark:text-red-400">Losses</p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-brand-muted">Circuit breaker</span>
            {circuitLocked ? (
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                ⚡ Active — trade 3 locked
              </span>
            ) : (
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                ✓ Clear
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Date selector ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted">
          Logging for:
        </p>
        <div className="relative">
          <button
            onClick={() => setShowDatePicker(!showDatePicker)}
            className="text-sm font-semibold dark:text-white px-3 py-1.5 rounded-lg border dark:border-gray-600 hover:border-brand-accent transition-colors flex items-center gap-2"
          >
            {format(parseISO(selectedDate), 'MMM d, yyyy')}
            {selectedDate === today && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-accent text-white">
                Today
              </span>
            )}
            <span className="text-brand-muted">▾</span>
          </button>
          {showDatePicker && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowDatePicker(false)} />
              <div className="absolute left-0 top-10 z-20 bg-white dark:bg-gray-800 rounded-xl shadow-xl border dark:border-gray-700 p-3 min-w-[200px]">
                <p className="text-xs font-semibold text-brand-muted mb-2">Select date</p>
                <input
                  type="date"
                  value={selectedDate}
                  max={today}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    setShowDatePicker(false);
                  }}
                  className="w-full border rounded-lg px-2 py-1.5 text-sm dark:bg-gray-700 dark:text-white dark:border-gray-600"
                />
                <div className="mt-2 flex flex-col gap-0.5">
                  <button
                    onClick={() => {
                      setSelectedDate(today);
                      setShowDatePicker(false);
                    }}
                    className="text-xs text-left px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-gray-700 text-brand-accent font-semibold"
                  >
                    Today
                  </button>
                  {pastDays.slice(0, 7).map((d) => (
                    <button
                      key={d}
                      onClick={() => {
                        setSelectedDate(d);
                        setShowDatePicker(false);
                      }}
                      className="text-xs text-left px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-white"
                    >
                      {format(parseISO(d), 'MMM d, yyyy')}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Daily trade entry & compliance log ──────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 shadow overflow-hidden">
        <div className="bg-brand-accent text-white px-4 py-2.5 flex justify-between items-center">
          <span className="font-semibold text-sm">Daily Trade Entry & Compliance Log</span>
          <span className="text-xs opacity-80">
            {format(parseISO(selectedDate), 'EEEE, MMM d yyyy')} · UTC+8
          </span>
        </div>

        {/* Table header */}
        <div
          className="bg-gray-50 dark:bg-gray-700/50 px-3 py-2 grid text-xs font-semibold text-brand-muted border-b dark:border-gray-700"
          style={{ gridTemplateColumns: '72px 80px 80px 100px 80px 120px 70px' }}
        >
          <span>Trade</span>
          <span>EMA Setup?</span>
          <span>ROE %</span>
          <span>P&L ($)</span>
          <span>Mental State</span>
          <span>Rules Maintained?</span>
          <span></span>
        </div>

        {([1, 2, 3] as const).map((n) => (
          <TradeRow
            key={n}
            tradeNumber={n}
            date={selectedDate}
            circuitLocked={circuitLocked}
            onSave={(data) => upsertEntry({ date: selectedDate, tradeNumber: n, ...data })}
          />
        ))}

        {circuitLocked && (
          <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-t dark:border-gray-700">
            <p className="text-xs text-amber-700 dark:text-amber-400 font-semibold">
              ⚡ Circuit breaker active — Trade 3 is locked. No more entries today.
            </p>
          </div>
        )}
      </div>

      {/* ── End-of-session assessment ────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 shadow overflow-hidden">
        <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700">
          <p className="text-sm font-semibold dark:text-white">End-of-Session Assessment</p>
          <p className="text-xs text-brand-muted">
            Complete immediately after your last trade of the day
          </p>
        </div>
        <div className="p-4 flex flex-col gap-4">
          {/* Q1: Loss today? */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm dark:text-white font-medium">
                1. Did a trade hit stop loss today?
              </p>
            </div>
            <YesNoToggle
              value={assessment?.lossOccurred ?? null}
              onChange={(v) => saveAssessment({ lossOccurred: v ?? false })}
            />
          </div>

          {/* Q1b: Circuit breaker? (only if loss) */}
          {assessment?.lossOccurred && (
            <div className="flex items-center justify-between pl-4 border-l-2 border-amber-300 dark:border-amber-700">
              <p className="text-sm dark:text-white">
                ↳ Did you execute the physical circuit breaker and refuse all subsequent entries?
              </p>
              <YesNoToggle
                value={assessment?.circuitBreakerExecuted ?? null}
                onChange={(v) => saveAssessment({ circuitBreakerExecuted: v })}
              />
            </div>
          )}

          {/* Q2: Chasing? */}
          <div className="flex items-center justify-between">
            <p className="text-sm dark:text-white font-medium">
              2. Did you chase any unconfirmed trends or scale position margin out of FOMO?
            </p>
            <YesNoToggle
              value={assessment?.chasingOccurred ?? null}
              onChange={(v) => saveAssessment({ chasingOccurred: v ?? false })}
            />
          </div>

          {/* Grade */}
          <div>
            <p className="text-sm font-medium dark:text-white mb-2">Daily Executive Grade</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => saveAssessment({ grade: assessment?.grade === 'A' ? null : 'A' })}
                className={`rounded-xl p-3 border-2 text-left transition-all
                  ${
                    assessment?.grade === 'A'
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-green-300'
                  }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-sm font-bold px-2 py-0.5 rounded ${gradeColor('A')}`}>
                    A
                  </span>
                  <span className="text-sm font-semibold dark:text-white">Flawless Execution</span>
                </div>
                <p className="text-xs text-brand-muted">
                  Followed every parameter, target, and structural rule. Framework protected
                  regardless of monetary outcome.
                </p>
              </button>
              <button
                onClick={() => saveAssessment({ grade: assessment?.grade === 'F' ? null : 'F' })}
                className={`rounded-xl p-3 border-2 text-left transition-all
                  ${
                    assessment?.grade === 'F'
                      ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-red-300'
                  }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-sm font-bold px-2 py-0.5 rounded ${gradeColor('F')}`}>
                    F
                  </span>
                  <span className="text-sm font-semibold dark:text-white">Systemic Breakdown</span>
                </div>
                <p className="text-xs text-brand-muted">
                  Over-traded, manually adjusted stops, chased late candles, or transferred
                  secondary funds into futures wallet.
                </p>
              </button>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs text-brand-muted mb-1 block">Session notes (optional)</label>
            <textarea
              rows={3}
              value={assessment?.notes ?? ''}
              onChange={(e) => saveAssessment({ notes: e.target.value })}
              placeholder="What happened today? What did you learn?"
              className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white dark:border-gray-600 resize-none"
            />
          </div>

          {/* Motivational quote */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl px-4 py-3 border dark:border-gray-700">
            <p className="text-xs italic text-brand-muted text-center">
              "I am not trading the market to confirm my intelligence. I am an automated execution
              vehicle for a mathematical edge. The market can behave randomly; my execution remains
              completely absolute."
            </p>
          </div>
        </div>
      </div>

      {/* ── History ──────────────────────────────────────────────────────── */}
      {pastDays.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 shadow overflow-hidden">
          <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700">
            <p className="text-sm font-semibold dark:text-white">Past sessions</p>
          </div>
          <div className="divide-y dark:divide-gray-700">
            {pastDays.map((d) => {
              const a = assessments.find((x) => x.date === d);
              const es = entries.filter((e) => e.date === d);
              const pnl = es.reduce((s, e) => s + (e.pnlAmount ?? 0), 0);
              return (
                <button
                  key={d}
                  onClick={() => setSelectedDate(d)}
                  className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                >
                  <span className="text-xs font-semibold dark:text-white w-20 text-left">
                    {format(parseISO(d), 'MMM d')}
                  </span>
                  <span className="text-xs text-brand-muted w-16">{es.length}/3 trades</span>
                  <span
                    className={`text-xs font-bold tabular-nums w-20 text-left ${pnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}
                  >
                    {pnl !== 0 ? `${pnl >= 0 ? '+' : ''}$${pnl.toFixed(4)}` : '—'}
                  </span>
                  {a?.grade && (
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded ${gradeColor(a.grade)}`}
                    >
                      {a.grade}
                    </span>
                  )}
                  {a?.lossOccurred && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      Loss day
                    </span>
                  )}
                  <span className="ml-auto text-brand-muted text-xs">Edit →</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
