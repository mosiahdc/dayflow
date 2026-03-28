/**
 * OfflineBanner — shows a non-intrusive banner when the device is offline.
 * Mount once at the top of AuthenticatedApp.
 */
import { useEffect, useRef } from 'react';
import { useOfflineStore } from '@/store/offlineStore';
import { format } from 'date-fns';

export default function OfflineBanner() {
  const { isOnline, mutationQueue, lastSyncedAt } = useOfflineStore();
  const prevOnline = useRef(isOnline);

  // Track transitions for animation
  useEffect(() => {
    prevOnline.current = isOnline;
  }, [isOnline]);

  if (isOnline && mutationQueue.length === 0) return null;

  const pending = mutationQueue.length;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '7px 16px',
        fontSize: 12,
        fontWeight: 500,
        background: isOnline ? 'rgba(16,185,129,0.92)' : 'rgba(239,68,68,0.92)',
        color: '#fff',
        backdropFilter: 'blur(8px)',
        transition: 'background 0.3s ease',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      }}
    >
      {isOnline ? (
        <>
          <span>✓</span>
          <span>
            Back online — syncing {pending} pending change{pending !== 1 ? 's' : ''}…
          </span>
        </>
      ) : (
        <>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: '#fff',
              opacity: 0.8,
              display: 'inline-block',
              animation: 'df-pulse 1.5s ease-in-out infinite',
            }}
          />
          <span>
            Offline — changes will sync when you reconnect
            {pending > 0 && ` (${pending} queued)`}
          </span>
          {lastSyncedAt && (
            <span style={{ opacity: 0.7, marginLeft: 4 }}>
              · Last synced {format(new Date(lastSyncedAt), 'h:mm a')}
            </span>
          )}
        </>
      )}
    </div>
  );
}
