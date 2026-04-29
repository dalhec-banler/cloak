import { useState } from 'react';
import type { FullIdentity } from '../types';
import { parseUrbitDate } from '../types';

interface Props {
  full: FullIdentity;
  onBurn: (id: string) => Promise<void>;
  onBack: () => void;
}

export default function IdentityDetail({ full, onBurn, onBack }: Props) {
  const [showPassword, setShowPassword] = useState(false);
  const [confirmBurn, setConfirmBurn] = useState(false);
  const [burning, setBurning] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const { identity, alias, credential } = full;
  const isBurned = identity.status === 'burned';

  const copy = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleBurn = async () => {
    if (!confirmBurn) {
      setConfirmBurn(true);
      return;
    }
    setBurning(true);
    await onBurn(identity.id);
  };

  return (
    <div>
      <button
        onClick={onBack}
        className="text-sm text-muted hover:text-ink mb-6 transition-colors"
      >
        ← Back
      </button>

      <div className="flex items-center gap-3 mb-8">
        <div
          className={`w-3 h-3 rounded-full ${isBurned ? 'bg-danger' : 'bg-success'}`}
        />
        <div>
          <h2 className="text-lg font-medium text-white">{identity.label}</h2>
          <p className="text-xs text-muted">{identity.service}</p>
        </div>
      </div>

      {/* Credentials */}
      <div className="space-y-4 max-w-lg">
        <div className="p-4 bg-surface border border-border rounded-lg">
          <label className="block text-xs text-muted mb-1">Alias Email</label>
          <div className="flex items-center justify-between">
            <code className="text-sm font-mono text-accent">{alias.address}</code>
            <button
              onClick={() => copy(alias.address, 'email')}
              className="text-xs text-muted hover:text-ink transition-colors"
            >
              {copied === 'email' ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        <div className="p-4 bg-surface border border-border rounded-lg">
          <label className="block text-xs text-muted mb-1">Username</label>
          <div className="flex items-center justify-between">
            <code className="text-sm font-mono text-ink">{credential.username}</code>
            <button
              onClick={() => copy(credential.username, 'user')}
              className="text-xs text-muted hover:text-ink transition-colors"
            >
              {copied === 'user' ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        <div className="p-4 bg-surface border border-border rounded-lg">
          <label className="block text-xs text-muted mb-1">Password</label>
          <div className="flex items-center justify-between">
            <code className="text-sm font-mono text-ink">
              {showPassword ? credential.password : '••••••••••••••••'}
            </code>
            <div className="flex gap-3">
              <button
                onClick={() => setShowPassword(!showPassword)}
                className="text-xs text-muted hover:text-ink transition-colors"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
              <button
                onClick={() => copy(credential.password, 'pass')}
                className="text-xs text-muted hover:text-ink transition-colors"
              >
                {copied === 'pass' ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        </div>

        {/* Metadata */}
        <div className="pt-4 border-t border-border">
          <p className="text-xs text-faint">
            Created {parseUrbitDate(identity.created).toLocaleDateString()}
          </p>
          {identity.burned && (
            <p className="text-xs text-danger mt-1">
              Burned {parseUrbitDate(identity.burned).toLocaleDateString()}
            </p>
          )}
        </div>

        {/* Burn */}
        {!isBurned && (
          <div className="pt-4">
            <button
              onClick={handleBurn}
              disabled={burning}
              className={`w-full py-2.5 text-sm font-medium rounded-lg transition-colors ${
                confirmBurn
                  ? 'bg-danger text-white hover:bg-danger/80'
                  : 'bg-danger-soft text-danger border border-danger/30 hover:bg-danger/20'
              }`}
            >
              {burning
                ? 'Burning...'
                : confirmBurn
                  ? 'Confirm Burn — this cannot be undone'
                  : 'Burn Identity'}
            </button>
            {confirmBurn && (
              <button
                onClick={() => setConfirmBurn(false)}
                className="w-full mt-2 text-xs text-muted hover:text-ink transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
