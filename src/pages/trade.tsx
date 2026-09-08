import { useEffect, useMemo, useState } from 'react';
import { format, addMonths, subMonths } from 'date-fns';
import { useTradeStore } from '@/store/tradeStore';
import TradeCalendar from '@/components/trading/TradeCalendar';
import TradeList from '@/components/trading/TradeList';
import ProjectDiscipline from '@/components/trading/ProjectDiscipline';
import TradeJournal from '@/components/trading/TradeJournal';

type TradeTab = 'discipline' | 'journal' | 'dashboard' | 'trades';

export default function TradePage() {
  const { trades, fetchTrades, loading } = useTradeStore();
  const [activeTab, setActiveTab] = useState<TradeTab>('discipline');
  const [activeMonth, setActiveMonth] = useState(() => format(new Date(), 'yyyy-MM'));
  const monthDate = useMemo(() => new Date(`${activeMonth}-01`), [activeMonth]);

  useEffect(() => { fetchTrades(); }, [fetchTrades]);

  const goMonth = (dir: 1 | -1) => {
    const fn = dir === 1 ? addMonths : subMonths;
    setActiveMonth(format(fn(monthDate, 1), 'yyyy-MM'));
  };

  const tabs: { id: TradeTab; label: string; hint: string }[] = [
    { id: 'discipline', label: 'Project Discipline', hint: 'Risk & weekly rules' },
    { id: 'journal', label: 'Journal', hint: 'Review execution' },
    { id: 'dashboard', label: 'Calendar', hint: 'P&L by day' },
    { id: 'trades', label: 'Trades', hint: 'All positions' },
  ];

  return (
    <div className="df-trade-page">
      <section className="df-trade-journey-head">
        <div>
          <span className="df-kicker">TRADING JOURNEY</span>
          <h2>Separate the decision, the execution, and the result.</h2>
          <p>Project Discipline protects the rules. Journal explains the decision. Calendar shows the rhythm. Trades preserves every position and underlying Exness order.</p>
        </div>
        <div className="df-trade-journey-meta"><span>{trades.length}</span><small>loaded trades</small></div>
      </section>
      <div className="df-trade-subnav" role="tablist" aria-label="Trading sections">
        {tabs.map(({ id, label }) => (
          <button key={id} onClick={() => setActiveTab(id)} className={activeTab === id ? 'is-active' : ''} title={tabs.find((t) => t.id === id)?.hint}>
            {label}
          </button>
        ))}
      </div>

      {loading && activeTab !== 'journal' ? (
        <div className="df-card text-center py-12 text-brand-muted text-sm">Loading trading data…</div>
      ) : (
        <>
          {activeTab === 'discipline' && <ProjectDiscipline trades={trades} />}
          {activeTab === 'journal' && <TradeJournal />}
          {activeTab === 'dashboard' && (
            <div className="df-card">
              <div className="df-trade-toolbar">
                <div>
                  <span className="df-kicker">TRADING CALENDAR</span>
                  <h2>Daily performance</h2>
                </div>
                <div className="df-trade-month-nav">
                  <button onClick={() => goMonth(-1)} aria-label="Previous month">←</button>
                  <span>{format(monthDate, 'MMMM yyyy')}</span>
                  <button onClick={() => goMonth(1)} aria-label="Next month">→</button>
                </div>
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
