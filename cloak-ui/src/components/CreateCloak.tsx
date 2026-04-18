import { useState } from 'react';

interface Props {
  onSubmit: (service: string, label: string) => Promise<void>;
  onBack: () => void;
}

export default function CreateCloak({ onSubmit, onBack }: Props) {
  const [service, setService] = useState('');
  const [label, setLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleServiceChange = (val: string) => {
    setService(val.toLowerCase().replace(/\s+/g, '-'));
    if (!label || label === capitalize(service)) {
      setLabel(capitalize(val));
    }
  };

  const handleSubmit = async () => {
    if (!service || !label || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(service, label);
      onBack();
    } catch (err) {
      console.error('Failed to create cloak:', err);
    }
    setSubmitting(false);
  };

  return (
    <div>
      <button
        onClick={onBack}
        className="text-sm text-muted hover:text-ink mb-6 transition-colors"
      >
        ← Back
      </button>

      <h2 className="text-lg font-medium text-white mb-6">Create New Cloak</h2>

      <div className="space-y-4 max-w-md">
        <div>
          <label className="block text-xs text-muted mb-1">Service</label>
          <input
            type="text"
            value={service}
            onChange={(e) => handleServiceChange(e.target.value)}
            placeholder="youtube"
            className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-ink placeholder:text-faint focus:border-accent focus:outline-none transition-colors"
          />
          <p className="text-xs text-faint mt-1">
            Used in the alias prefix (e.g., yt-a8f3k2@domain.com)
          </p>
        </div>

        <div>
          <label className="block text-xs text-muted mb-1">Label</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="YouTube"
            className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-ink placeholder:text-faint focus:border-accent focus:outline-none transition-colors"
          />
          <p className="text-xs text-faint mt-1">
            Display name for this identity
          </p>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!service || !label || submitting}
          className="w-full py-2.5 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? 'Creating...' : 'Generate Identity'}
        </button>
      </div>
    </div>
  );
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
