import { useState, useEffect } from 'react';
import {
  isBiometricAvailable,
  isBiometricLockEnabled,
  promptBiometric,
} from '@/lib/biometric';
import { Capacitor } from '@capacitor/core';

interface Props {
  children: React.ReactNode;
}

export default function BiometricLock({ children }: Props) {
  const [unlocked, setUnlocked] = useState(false);
  const [available, setAvailable] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function init() {
      // Only run on native platform
      if (!Capacitor.isNativePlatform()) {
        setUnlocked(true);
        setChecking(false);
        return;
      }
      // Only lock if user has enabled it
      if (!isBiometricLockEnabled()) {
        setUnlocked(true);
        setChecking(false);
        return;
      }
      const avail = await isBiometricAvailable();
      setAvailable(avail);
      if (avail) {
        await attemptUnlock();
      } else {
        // No biometric hardware — just let them in
        setUnlocked(true);
      }
      setChecking(false);
    }
    init();
  }, []);

  const attemptUnlock = async () => {
    setError('');
    const success = await promptBiometric('Unlock DayFlow');
    if (success) {
      setUnlocked(true);
    } else {
      setError('Biometric failed. Try again.');
    }
  };

  if (checking) {
    return (
      <div style={{
        position: 'fixed', inset: 0, background: 'var(--df-bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ color: 'var(--df-muted)', fontSize: 13 }}>Loading…</div>
      </div>
    );
  }

  if (!unlocked) {
    return (
      <div style={{
        position: 'fixed', inset: 0, background: 'var(--df-bg)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 20, padding: 32,
      }}>
        <div style={{ fontSize: 48 }}>🔒</div>
        <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--df-text)' }}>DayFlow</div>
        <div style={{ fontSize: 13, color: 'var(--df-muted)', textAlign: 'center' }}>
          Biometric authentication required
        </div>
        {error && (
          <div style={{ fontSize: 12, color: '#ef4444', textAlign: 'center' }}>{error}</div>
        )}
        <button
          onClick={attemptUnlock}
          style={{
            background: 'var(--df-accent)', color: '#fff', border: 'none',
            borderRadius: 10, padding: '12px 32px', fontSize: 15,
            fontWeight: 600, cursor: 'pointer',
          }}
        >
          👆 Unlock with Biometrics
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
