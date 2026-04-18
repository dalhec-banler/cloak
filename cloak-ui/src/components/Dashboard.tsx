import type { CloakedIdentity } from '../types';

interface Props {
  identities: CloakedIdentity[];
  cfConfigured: boolean;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onSetup: () => void;
}

export default function Dashboard({ identities, cfConfigured, onSelect, onCreate, onSetup }: Props) {
  const active = identities.filter((i) => i.status === 'active');
  const burned = identities.filter((i) => i.status === 'burned');

  return (
    <div>
      {/* Setup banner */}
      {!cfConfigured && (
        <div className="mb-6 p-4 bg-accent-soft border border-accent/30 rounded-lg">
          <p className="text-sm text-ink mb-2">
            Set up your email domain to start creating cloaks.
          </p>
          <button
            onClick={onSetup}
            className="text-sm font-medium text-accent hover:underline"
          >
            Configure Cloudflare →
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-medium text-white">
          Active Cloaks
          {active.length > 0 && (
            <span className="ml-2 text-sm text-muted">{active.length}</span>
          )}
        </h2>
        <button
          onClick={onCreate}
          disabled={!cfConfigured}
          className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          + New Cloak
        </button>
      </div>

      {/* Active identities */}
      {active.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted text-sm">No cloaked identities yet</p>
          {cfConfigured && (
            <button
              onClick={onCreate}
              className="mt-3 text-sm text-accent hover:underline"
            >
              Create your first cloak
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {active.map((identity) => (
            <button
              key={identity.id}
              onClick={() => onSelect(identity.id)}
              className="w-full flex items-center justify-between p-4 bg-surface border border-border rounded-lg hover:border-accent/50 transition-colors text-left"
            >
              <div>
                <p className="text-sm font-medium text-white">{identity.label}</p>
                <p className="text-xs text-muted mt-0.5">{identity.service}</p>
              </div>
              <div className="w-2 h-2 rounded-full bg-success" title="Active" />
            </button>
          ))}
        </div>
      )}

      {/* Burned identities */}
      {burned.length > 0 && (
        <div className="mt-10">
          <h3 className="text-xs font-medium text-muted uppercase tracking-wider mb-3">
            Burned ({burned.length})
          </h3>
          <div className="space-y-2 opacity-50">
            {burned.map((identity) => (
              <div
                key={identity.id}
                className="flex items-center justify-between p-4 bg-surface border border-border rounded-lg"
              >
                <div>
                  <p className="text-sm text-muted line-through">{identity.label}</p>
                  <p className="text-xs text-faint mt-0.5">{identity.service}</p>
                </div>
                <div className="w-2 h-2 rounded-full bg-danger" title="Burned" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
