import { useState, useEffect, useCallback } from 'react';
import type { CloakedIdentity, Alias, Credential, FullIdentity, CfConfig, ApiToken, View, Update } from './types';
import { poke, subscribe, fetchIdentities, fetchIdentity, fetchCfConfig, fetchTokens } from './api';
import SetupWizard from './components/SetupWizard';
import Dashboard from './components/Dashboard';
import IdentityDetail from './components/IdentityDetail';
import CreateCloak from './components/CreateCloak';
import TokenManager from './components/TokenManager';

export default function App() {
  const [view, setView] = useState<View>('dashboard');
  const [identities, setIdentities] = useState<CloakedIdentity[]>([]);
  const [cfConfig, setCfConfig] = useState<CfConfig | null>(null);
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedFull, setSelectedFull] = useState<FullIdentity | null>(null);
  const [loading, setLoading] = useState(true);

  // Initial data fetch
  useEffect(() => {
    async function load() {
      try {
        const [ids, cf, toks] = await Promise.all([
          fetchIdentities(),
          fetchCfConfig(),
          fetchTokens(),
        ]);
        setIdentities(Array.isArray(ids) ? ids : []);
        setCfConfig(cf);
        setTokens(Array.isArray(toks) ? toks : []);
      } catch (err) {
        console.error('Failed to load initial data:', err);
      }
      setLoading(false);
    }
    load();
  }, []);

  // Subscribe to updates
  useEffect(() => {
    let subId: number | null = null;

    subscribe((update: Update) => {
      switch (update.type) {
        case 'cloakCreated':
          setIdentities((prev) => [...prev, update.identity]);
          break;
        case 'cloakBurned':
          setIdentities((prev) =>
            prev.map((i) =>
              i.id === update.id ? { ...i, status: 'burned' as const } : i
            )
          );
          break;
        case 'cfConfigured':
          setCfConfig(update.config);
          break;
        case 'tokenGenerated':
          setTokens((prev) => [...prev, update.token]);
          break;
        case 'tokenRevoked':
          setTokens((prev) => prev.filter((t) => t.id !== update.id));
          break;
      }
    }).then((id) => {
      subId = id;
    });

    return () => {
      // cleanup would unsubscribe
    };
  }, []);

  // Load full identity when selecting
  useEffect(() => {
    if (!selectedId) {
      setSelectedFull(null);
      return;
    }
    fetchIdentity(selectedId).then(setSelectedFull).catch(console.error);
  }, [selectedId]);

  const handleCreateCloak = useCallback(
    async (service: string, label: string) => {
      await poke({ 'create-cloak': { service, label } });
    },
    []
  );

  const handleBurn = useCallback(async (id: string) => {
    await poke({ 'burn-cloak': { id } });
    setSelectedId(null);
    setView('dashboard');
  }, []);

  const handleSetupCf = useCallback(
    async (domain: string, apiToken: string, accountId: string) => {
      await poke({
        'set-cf-config': { domain, 'api-token': apiToken, 'account-id': accountId },
      });
      await poke({ 'setup-cloudflare': null });
    },
    []
  );

  const handleGenerateToken = useCallback(async (label: string) => {
    await poke({ 'generate-token': { label } });
  }, []);

  const handleRevokeToken = useCallback(async (id: string) => {
    await poke({ 'revoke-token': { id } });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <p className="text-muted text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <button
          onClick={() => { setView('dashboard'); setSelectedId(null); }}
          className="text-xl font-semibold text-white tracking-wide hover:text-accent transition-colors"
        >
          Cloak
        </button>
        <nav className="flex gap-3">
          <button
            onClick={() => setView('tokens')}
            className="text-sm text-muted hover:text-ink transition-colors"
          >
            Tokens
          </button>
          <button
            onClick={() => setView('setup')}
            className="text-sm text-muted hover:text-ink transition-colors"
          >
            Settings
          </button>
        </nav>
      </header>

      {/* Main content */}
      <main className="max-w-3xl mx-auto px-6 py-8">
        {view === 'setup' && (
          <SetupWizard
            config={cfConfig}
            onSubmit={handleSetupCf}
            onBack={() => setView('dashboard')}
          />
        )}

        {view === 'tokens' && (
          <TokenManager
            tokens={tokens}
            onGenerate={handleGenerateToken}
            onRevoke={handleRevokeToken}
            onBack={() => setView('dashboard')}
          />
        )}

        {view === 'dashboard' && (
          <Dashboard
            identities={identities}
            cfConfigured={cfConfig?.configured ?? false}
            onSelect={(id) => { setSelectedId(id); setView('detail'); }}
            onCreate={() => setView('create')}
            onSetup={() => setView('setup')}
          />
        )}

        {view === 'create' && (
          <CreateCloak
            onSubmit={handleCreateCloak}
            onBack={() => setView('dashboard')}
          />
        )}

        {view === 'detail' && selectedFull && (
          <IdentityDetail
            full={selectedFull}
            onBurn={handleBurn}
            onBack={() => { setSelectedId(null); setView('dashboard'); }}
          />
        )}
      </main>
    </div>
  );
}
