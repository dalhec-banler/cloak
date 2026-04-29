import Urbit from '@urbit/http-api';
import type { CloakAction, Update, CloakedIdentity, FullIdentity, CfConfig, ApiToken } from './types';

let api: Urbit | null = null;

export function getApi(): Urbit {
  if (!api) {
    api = new Urbit('', '', 'cloak');
    api.ship = window.ship;
  }
  return api;
}

declare global {
  interface Window {
    ship: string;
  }
}

export async function poke(action: CloakAction): Promise<void> {
  await getApi().poke({
    app: 'cloak',
    mark: 'cloak-action',
    json: action,
  });
}

export async function subscribe(
  onUpdate: (update: Update) => void,
  onError?: (err: unknown) => void
): Promise<number> {
  return getApi().subscribe({
    app: 'cloak',
    path: '/updates',
    event: onUpdate,
    err: onError,
    quit: onError,
  });
}

// --- HTTP fetch helpers (bypass broken lens scry) ---

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`/cloak-api${path}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`API ${path}: ${res.status}`);
  return res.json();
}

export async function fetchIdentities(): Promise<CloakedIdentity[]> {
  return apiFetch<CloakedIdentity[]>('/identities');
}

export async function fetchIdentity(id: string): Promise<FullIdentity> {
  return apiFetch<FullIdentity>(`/identity/${id}`);
}

export async function fetchCfConfig(): Promise<CfConfig | null> {
  const res = await apiFetch<CfConfig | string>('/config');
  if (typeof res === 'string') return null;
  return res;
}

export async function fetchTokens(): Promise<ApiToken[]> {
  return apiFetch<ApiToken[]>('/tokens');
}
