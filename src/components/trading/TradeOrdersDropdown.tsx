import type { Trade } from '@/store/tradeStore';

interface Props {
  trade: Trade;
}

function compactTime(value: string): string {
  if (!value) return '—';
  return value.slice(5, 16).replace(' ', ' · ');
}

export default function TradeOrdersDropdown({ trade }: Props) {
  const orders = trade.orders ?? [];
  if (orders.length <= 1) return null;

  return (
    <div className="border-t border-brand-accent/20 bg-brand-accent/[0.035] dark:bg-brand-accent/[0.06] px-3 py-3">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div>
          <p className="text-[11px] font-bold text-brand-accent uppercase tracking-wide">
            Underlying Exness Orders
          </p>
          <p className="text-[10px] text-brand-muted mt-0.5">
            {orders.length} orders consolidated by opening-time batch. Each exit remains separate below.
          </p>
        </div>
        <p className="text-[10px] text-brand-muted shrink-0">
          Combined PNL{' '}
          <span
            className={`font-bold ${trade.realizedPnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}
          >
            {trade.realizedPnl >= 0 ? '+' : ''}
            {trade.realizedPnl.toFixed(4)}
          </span>
        </p>
      </div>

      <div className="df-table-wrap overflow-x-auto">
        <div className="min-w-[900px]">
          <div
            className="grid items-center px-2.5 py-1.5 bg-gray-50 dark:bg-gray-700/50 text-[9px] uppercase tracking-wide font-semibold text-brand-muted"
            style={{ gridTemplateColumns: '120px 105px 105px 60px 90px 90px 80px 75px 1fr' }}
          >
            <span>Position ID</span>
            <span>Opened</span>
            <span>Closed</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Entry</span>
            <span className="text-right">Exit</span>
            <span className="text-right">PNL</span>
            <span className="text-right">Fee</span>
            <span className="text-right">Closed by</span>
          </div>

          <div className="divide-y dark:divide-gray-700">
            {orders.map((order, index) => (
              <div
                key={`${order.id}-${index}`}
                className="grid items-center px-2.5 py-2 text-[10px] dark:text-gray-200"
                style={{ gridTemplateColumns: '120px 105px 105px 60px 90px 90px 80px 75px 1fr' }}
              >
                <span className="font-semibold truncate" title={order.referenceOrderId ?? order.id}>
                  {order.referenceOrderId ?? `Order ${index + 1}`}
                </span>
                <span className="text-brand-muted tabular-nums">{compactTime(order.openTime)}</span>
                <span className="text-brand-muted tabular-nums">{compactTime(order.closeTime)}</span>
                <span className="text-right tabular-nums">{order.closingQty}</span>
                <span className="text-right tabular-nums">{order.avgEntryPrice.toFixed(3)}</span>
                <span className="text-right tabular-nums">{order.avgClosePrice.toFixed(3)}</span>
                <span
                  className={`text-right font-bold tabular-nums ${order.realizedPnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}
                >
                  {order.realizedPnl >= 0 ? '+' : ''}
                  {order.realizedPnl.toFixed(2)}
                </span>
                <span className="text-right text-brand-muted tabular-nums">
                  {order.tradingFee.toFixed(2)}
                </span>
                <span className="text-right text-brand-muted truncate" title={order.status}>
                  {order.status || '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
