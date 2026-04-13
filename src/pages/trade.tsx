import { useEffect, useMemo, useState } from 'react';
import { format, addMonths, subMonths } from 'date-fns';
import { useTradeStore } from '@/store/tradeStore';
import TradeCalendar from '@/components/trading/TradeCalendar';
import TradeList from '@/components/trading/TradeList';
import ProjectDiscipline from '@/components/trading/ProjectDiscipline';

type TradeTab = 'discipline' | 'dashboard' | 'trades';

export default function TradePage() {
  const { trades, fetchTrades, loading } = useTradeStore();
  const [activeTab, setActiveTab] = useState<TradeTab>('discipline');
  const [activeMonth, setActiveMonth] = useState(() => format(new Date(), 'yyyy-MM'));

  const monthDate = useMemo(() => new Date(`${activeMonth}-01`), [activeMonth]);

  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

  const goMonth = (dir: 1 | -1) => {
    const fn = dir === 1 ? addMonths : subMonths;
    setActiveMonth(format(fn(monthDate, 1), 'yyyy-MM'));
  };

  const tabs: { id: TradeTab; label: string }[] = [
    { id: 'discipline', label: '🎯 Project Discipline' },
    { id: 'dashboard', label: '📊 Dashboard' },
    { id: 'trades', label: '📋 Trades' },
  ];

  return (
    <div className="max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold dark:text-white">📈 Trading Journey</h1>
      </div>

      {/* Sub-tab navigation */}
      <div className="flex gap-1 mb-4 bg-gray-100 dark:bg-gray-700 p-1 rounded-xl w-fit">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all
              ${
                activeTab === id
                  ? 'bg-white dark:bg-gray-800 text-brand-accent shadow-sm'
                  : 'text-brand-muted hover:text-brand-dark dark:hover:text-white'
              }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-brand-muted text-sm">Loading trades…</div>
      ) : (
        <>
          {activeTab === 'discipline' && <ProjectDiscipline trades={trades} />}

          {activeTab === 'dashboard' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => goMonth(-1)}
                  className="px-3 py-1 rounded border text-sm dark:text-white dark:border-gray-600 hover:border-brand-accent transition-colors"
                >
                  ← Prev
                </button>
                <span className="font-semibold text-sm dark:text-white">
                  {format(monthDate, 'MMMM yyyy')}
                </span>
                <button
                  onClick={() => goMonth(1)}
                  className="px-3 py-1 rounded border text-sm dark:text-white dark:border-gray-600 hover:border-brand-accent transition-colors"
                >
                  Next →
                </button>
              </div>
              <TradeCalendar monthDate={monthDate} trades={trades} />
            </div>
          )}

          {activeTab === 'trades' && <TradeList trades={trades} />}
        </>
      )}
    </div>
  );
}
