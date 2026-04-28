import Urbit from '@urbit/http-api';
import type { CloakAction, Update, CloakedIdentity, FullIdentity, CfConfig, ApiToken } from './types';

let api: Urbit | null = null;

export function getApi(): Urbit {
  if (!api) {
    api = new Urbit('', '', window.ship);
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

export async function scry<T>(path: string): Promise<T> {
  return getApi().scry({ app: 'cloak', path });
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

// --- Typed scry helpers ---

export async function fetchIdentities(): Promise<CloakedIdentity[]> {
  return scry<CloakedIdentity[]>('/identities');
}

export async function fetchIdentity(id: string): Promise<FullIdentity> {
  return scry<FullIdentity>(`/full-identity/${id}`);
}

export async function fetchCfConfig(): Promise<CfConfig | null> {
  const res = await scry<CfConfig | string>('/cf-config');
  if (typeof res === 'string') return null;
  return res;
}

export async function fetchTokens(): Promise<ApiToken[]> {
  return scry<ApiToken[]>('/tokens');
}
