import { useState } from 'react';
import type { ApiToken } from '../types';
import { parseUrbitDate } from '../types';

interface Props {
  tokens: ApiToken[];
  onGenerate: (label: string) => Promise<void>;
  onRevoke: (id: string) => Promise<void>;
  onBack: () => void;
}

export default function TokenManager({ tokens, onGenerate, onRevoke, onBack }: Props) {
  const [label, setLabel] = useState('');
  const [generating, setGenerating] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!label || generating) return;
    setGenerating(true);
    try {
      await onGenerate(label);
      setLabel('');
    } catch (err) {
      console.error('Failed to generate token:', err);
    }
    setGenerating(false);
  };

  const handleCopy = async (token: ApiToken) => {
    await navigator.clipboard.writeText(token.token);
    setCopiedId(token.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRevoke = async (id: string) => {
    setRevoking(id);
    try {
      await onRevoke(id);
    } catch (err) {
      console.error('Failed to revoke token:', err);
    }
    setRevoking(null);
  };

  return (
    <div>
      <button
        onClick={onBack}
        className="text-sm text-muted hover:text-ink mb-6 transition-colors"
      >
        ← Back
      </button>

      <h2 className="text-lg font-medium text-white mb-2">Extension Tokens</h2>
      <p className="text-sm text-muted mb-6">
        Generate tokens to connect browser extensions to this ship.
        Each extension should have its own token.
      </p>

      {/* Generate new token */}
      <div className="flex gap-3 max-w-md mb-8">
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Chrome on MacBook"
          className="flex-1 px-3 py-2 bg-surface border border-border rounded-lg text-sm text-ink placeholder:text-faint focus:border-accent focus:outline-none transition-colors"
        />
        <button
          onClick={handleGenerate}
          disabled={!label || generating}
          className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {generating ? '...' : 'Generate'}
        </button>
      </div>

      {/* Token list */}
      {tokens.length === 0 ? (
        <p className="text-sm text-faint text-center py-8">
          No tokens yet. Generate one to connect your extension.
        </p>
      ) : (
        <div className="space-y-2 max-w-md">
          {tokens.map((token) => (
            <div
              key={token.id}
              className="p-4 bg-surface border border-border rounded-lg"
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-white">{token.label}</p>
                <button
                  onClick={() => handleRevoke(token.id)}
                  disabled={revoking === token.id}
                  className="text-xs text-danger hover:underline disabled:opacity-50"
                >
                  {revoking === token.id ? '...' : 'Revoke'}
                </button>
              </div>
              <div className="flex items-center gap-2 mb-1">
                <code className="text-xs text-accent font-mono bg-bg px-2 py-1 rounded flex-1 overflow-hidden text-ellipsis">
                  {token.token}
                </code>
                <button
                  onClick={() => handleCopy(token)}
                  className="text-xs text-muted hover:text-ink transition-colors whitespace-nowrap"
                >
                  {copiedId === token.id ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p className="text-xs text-faint">
                Created {parseUrbitDate(token.created).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
