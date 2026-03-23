import { Capacitor } from '@capacitor/core';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getFingerprintPlugin(): Promise<any | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    // Use a runtime string so tsc never tries to resolve the module
    const pluginName = '@capacitor-community/fingerprint-auth';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = await (Function('m', 'return import(m)')(pluginName)) as any;
    return mod.FingerprintAIO ?? mod.default ?? null;
  } catch {
    return null;
  }
}

export async function isBiometricAvailable(): Promise<boolean> {
  const plugin = await getFingerprintPlugin();
  if (!plugin) return false;
  try {
    await plugin.isAvailable();
    return true;
  } catch {
    return false;
  }
}

export async function promptBiometric(reason = 'Confirm your identity'): Promise<boolean> {
  const plugin = await getFingerprintPlugin();
  if (!plugin) return false;
  try {
    await plugin.show({
      title: 'DayFlow',
      subtitle: reason,
      description: '',
      fallbackButtonTitle: 'Use PIN',
      disableBackup: false,
    });
    return true;
  } catch {
    return false;
  }
}

const BIOMETRIC_KEY = 'dayflow-biometric-enabled';

export function isBiometricLockEnabled(): boolean {
  return localStorage.getItem(BIOMETRIC_KEY) === 'true';
}

export function setBiometricLockEnabled(enabled: boolean): void {
  localStorage.setItem(BIOMETRIC_KEY, String(enabled));
}
