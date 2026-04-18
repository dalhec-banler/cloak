import { useState } from 'react';
import type { CfConfig } from '../types';

interface Props {
  config: CfConfig | null;
  onSubmit: (domain: string, apiToken: string, accountId: string) => Promise<void>;
  onBack: () => void;
}

export default function SetupWizard({ config, onSubmit, onBack }: Props) {
  const [domain, setDomain] = useState(config?.domain ?? '');
  const [apiToken, setApiToken] = useState('');
  const [accountId, setAccountId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const handleSubmit = async () => {
    if (!domain || !apiToken || !accountId || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(domain, apiToken, accountId);
      setStep(3);
    } catch (err) {
      console.error('Setup failed:', err);
    }
    setSubmitting(false);
  };

  if (config?.configured) {
    return (
      <div>
        <button
          onClick={onBack}
          className="text-sm text-muted hover:text-ink mb-6 transition-colors"
        >
          ← Back
        </button>
        <h2 className="text-lg font-medium text-white mb-6">Email Settings</h2>
        <div className="p-4 bg-surface border border-border rounded-lg max-w-md">
          <div className="mb-3">
            <label className="block text-xs text-muted mb-1">Domain</label>
            <p className="text-sm text-ink">{config.domain}</p>
          </div>
          <div className="mb-3">
            <label className="block text-xs text-muted mb-1">Worker</label>
            <p className="text-sm font-mono text-accent text-xs">{config.workerUrl || 'Deployed'}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-success" />
            <p className="text-xs text-success">Configured</p>
          </div>
        </div>
        <p className="text-xs text-faint mt-6">Powered by Cloudflare</p>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={onBack}
        className="text-sm text-muted hover:text-ink mb-6 transition-colors"
      >
        ← Back
      </button>

      <h2 className="text-lg font-medium text-white mb-2">Set Up Email</h2>
      <p className="text-sm text-muted mb-8">
        Cloak uses Cloudflare Email Routing to receive verification emails.
        You need a free Cloudflare account and a domain.
      </p>

      {/* Step 1: Instructions */}
      {step === 1 && (
        <div className="max-w-md space-y-6">
          <div className="space-y-3">
            <div className="flex gap-3">
              <span className="text-accent font-mono text-sm">1.</span>
              <p className="text-sm text-ink">
                Create a free account at{' '}
                <a
                  href="https://dash.cloudflare.com/sign-up"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline"
                >
                  cloudflare.com
                </a>
              </p>
            </div>
            <div className="flex gap-3">
              <span className="text-accent font-mono text-sm">2.</span>
              <p className="text-sm text-ink">
                Register a domain (or add an existing one)
              </p>
            </div>
            <div className="flex gap-3">
              <span className="text-accent font-mono text-sm">3.</span>
              <div>
                <p className="text-sm text-ink">
                  Generate an API token with these permissions:
                </p>
                <ul className="mt-1 text-xs text-muted space-y-0.5 ml-4">
                  <li>Zone : DNS : Edit</li>
                  <li>Zone : Zone : Edit</li>
                  <li>Account : Workers Scripts : Edit</li>
                  <li>Account : Workers KV Storage : Edit</li>
                  <li>Account : Email Routing Addresses : Edit</li>
                </ul>
              </div>
            </div>
          </div>

          <button
            onClick={() => setStep(2)}
            className="w-full py-2.5 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/80 transition-colors"
          >
            I have my token ready
          </button>
        </div>
      )}

      {/* Step 2: Enter credentials */}
      {step === 2 && (
        <div className="max-w-md space-y-4">
          <div>
            <label className="block text-xs text-muted mb-1">Domain</label>
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value.trim().toLowerCase())}
              placeholder="mydomain.com"
              className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-ink placeholder:text-faint focus:border-accent focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">Cloudflare API Token</label>
            <input
              type="password"
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value.trim())}
              placeholder="Paste your API token"
              className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-ink placeholder:text-faint focus:border-accent focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">Cloudflare Account ID</label>
            <input
              type="text"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value.trim())}
              placeholder="Found in your Cloudflare dashboard URL"
              className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-ink placeholder:text-faint focus:border-accent focus:outline-none transition-colors"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2.5 text-sm text-muted hover:text-ink transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={!domain || !apiToken || !accountId || submitting}
              className="flex-1 py-2.5 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? 'Configuring...' : 'Set Up Email'}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Done */}
      {step === 3 && (
        <div className="max-w-md text-center py-8">
          <div className="w-12 h-12 rounded-full bg-success-soft border border-success/30 flex items-center justify-center mx-auto mb-4">
            <span className="text-success text-xl">✓</span>
          </div>
          <h3 className="text-white font-medium mb-2">Email configured</h3>
          <p className="text-sm text-muted mb-6">
            Your domain is set up and ready to receive verification emails.
          </p>
          <button
            onClick={onBack}
            className="px-6 py-2.5 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/80 transition-colors"
          >
            Start Creating Cloaks
          </button>
        </div>
      )}

      <p className="text-xs text-faint mt-8">Powered by Cloudflare</p>
    </div>
  );
}
