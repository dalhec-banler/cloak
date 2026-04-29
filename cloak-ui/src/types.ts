export interface CloakedIdentity {
  id: string;
  service: string;
  label: string;
  status: 'active' | 'burned';
  aliasId: string;
  credId: string;
  created: string;
  burned: string | null;
}

export interface Alias {
  id: string;
  address: string;
  identityId: string;
  service: string;
  status: 'active' | 'burned';
}

export interface Credential {
  id: string;
  identityId: string;
  username: string;
  password: string;
  created: string;
}

export interface VerificationMessage {
  id: string;
  aliasId: string;
  from: string;
  subject: string;
  code: string | null;
  link: string | null;
  received: string;
}

export interface CfConfig {
  domain: string;
  workerUrl: string;
  configured: boolean;
}

export interface ApiToken {
  id: string;
  token: string;
  label: string;
  created: string;
  lastUsed: string;
}

export function parseUrbitDate(ud: string): Date {
  const s = ud.replace(/^~/, '');
  const [datePart, ...rest] = s.split('..');
  const [year, month, day] = datePart.split('.').map(Number);
  if (rest.length === 0) return new Date(year, month - 1, day);
  const tp = rest[0].split('.');
  return new Date(Date.UTC(
    year, month - 1, day,
    parseInt(tp[0]) || 0,
    parseInt(tp[1]) || 0,
    parseInt(tp[2]) || 0,
  ));
}

export interface FullIdentity {
  identity: CloakedIdentity;
  alias: Alias;
  credential: Credential;
}

export type View = 'dashboard' | 'create' | 'detail' | 'setup' | 'tokens';

export type CloakAction =
  | { 'create-cloak': { service: string; label: string } }
  | { 'burn-cloak': { id: string } }
  | { 'set-cf-config': { domain: string; 'api-token': string; 'account-id': string } }
  | { 'setup-cloudflare': null }
  | { 'generate-token': { label: string } }
  | { 'revoke-token': { id: string } };

export type Update =
  | { type: 'cloakCreated'; identity: CloakedIdentity; alias: Alias; credential: Credential }
  | { type: 'cloakBurned'; id: string }
  | { type: 'cfConfigured'; config: CfConfig }
  | { type: 'cfSetupError'; msg: string }
  | { type: 'tokenGenerated'; token: ApiToken }
  | { type: 'tokenRevoked'; id: string }
  | { type: 'verificationReceived'; message: VerificationMessage }
  | { type: 'credentialsResponse'; credential: Credential };
