import { useState } from 'react';
import { useTradeStore } from '@/store/tradeStore';

interface Props {
  onClose: () => void;
}

export default function TradeForm({ onClose }: Props) {
  const { addTrade } = useTradeStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [futures, setFutures] = useState('');
  const [openTime, setOpenTime] = useState('');
  const [closeTime, setCloseTime] = useState('');
  const [marginMode, setMarginMode] = useState('Cross');
  const [avgEntryPrice, setAvgEntryPrice] = useState('');
  const [avgClosePrice, setAvgClosePrice] = useState('');
  const [direction, setDirection] = useState<'Long' | 'Short'>('Long');
  const [closingQty, setClosingQty] = useState('');
  const [tradingFee, setTradingFee] = useState('0');
  const [realizedPnl, setRealizedPnl] = useState('');
  const [status, setStatus] = useState('All Closed');

  const save = async () => {
    if (!futures.trim()) { setError('Futures symbol required'); return; }
    if (!closeTime) { setError('Close time required'); return; }
    if (!realizedPnl) { setError('Realized PNL required'); return; }

    setLoading(true);
    try {
      await addTrade({
        futures: futures.trim().toUpperCase(),
        openTime: openTime || closeTime,
        closeTime,
        marginMode,
        avgEntryPrice: parseFloat(avgEntryPrice) || 0,
        avgClosePrice: parseFloat(avgClosePrice) || 0,
        direction,
        closingQty: parseFloat(closingQty) || 1,
        tradingFee: parseFloat(tradingFee) || 0,
        realizedPnl: parseFloat(realizedPnl) || 0,
        status,
      });
      onClose();
    } catch {
      setError('Failed to save trade');
    } finally {
      setLoading(false);
    }
  };

  const labelCls = 'text-xs text-brand-muted mb-1 block';
  const inputCls = 'w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white dark:border-gray-600';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm max-h-[90vh] overflow-y-auto">
        <div className="px-6 pt-5 pb-4">
          <h2 className="font-bold text-lg mb-4 dark:text-white">Add Trade</h2>

          <label className={labelCls}>Futures Symbol</label>
          <input className={`${inputCls} mb-3`} placeholder="e.g. SOLUSDT" value={futures} onChange={(e) => setFutures(e.target.value)} />

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className={labelCls}>Open Time</label>
              <input type="datetime-local" className={inputCls} value={openTime} onChange={(e) => setOpenTime(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Close Time *</label>
              <input type="datetime-local" className={inputCls} value={closeTime} onChange={(e) => setCloseTime(e.target.value)} />
            </div>
          </div>

          <label className={labelCls}>Direction</label>
          <div className="flex gap-2 mb-3">
            {(['Long', 'Short'] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDirection(d)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold border-2 transition-all
                  ${direction === d
                    ? d === 'Long' ? 'bg-green-600 border-green-600 text-white' : 'bg-red-500 border-red-500 text-white'
                    : 'dark:border-gray-600 dark:text-white border-gray-200'}`}
              >
                {d === 'Long' ? '↑ Long' : '↓ Short'}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className={labelCls}>Avg Entry Price</label>
              <input type="number" className={inputCls} placeholder="0.00" value={avgEntryPrice} onChange={(e) => setAvgEntryPrice(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Avg Close Price</label>
              <input type="number" className={inputCls} placeholder="0.00" value={avgClosePrice} onChange={(e) => setAvgClosePrice(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className={labelCls}>Closing Qty</label>
              <input type="number" className={inputCls} placeholder="1" value={closingQty} onChange={(e) => setClosingQty(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Trading Fee (USDT)</label>
              <input type="number" className={inputCls} placeholder="0" value={tradingFee} onChange={(e) => setTradingFee(e.target.value)} />
            </div>
          </div>

          <label className={labelCls}>Realized PNL (USDT) *</label>
          <input type="number" step="0.001" className={`${inputCls} mb-3`} placeholder="e.g. 0.038 or -0.044" value={realizedPnl} onChange={(e) => setRealizedPnl(e.target.value)} />

          <label className={labelCls}>Margin Mode</label>
          <select className={`${inputCls} mb-3`} value={marginMode} onChange={(e) => setMarginMode(e.target.value)}>
            <option>Cross</option>
            <option>Isolated</option>
          </select>

          {error && <p className="text-red-500 text-xs mb-3">{error}</p>}
        </div>

        <div className="px-6 pb-5 flex gap-2">
          <button onClick={onClose} className="flex-1 border rounded-lg py-2 text-sm dark:text-white dark:border-gray-600">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={loading}
            className="flex-1 bg-brand-accent text-white rounded-lg py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Saving…' : 'Add Trade'}
          </button>
        </div>
      </div>
    </div>
  );
}
