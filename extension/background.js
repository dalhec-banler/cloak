/**
 * Cloak Background Service Worker
 *
 * Handles communication between the extension, the Urbit ship,
 * and the Cloudflare Worker. This is the coordination layer.
 * It stores nothing persistent except connection config.
 */

// --- Ship API ---

async function getConfig() {
  const data = await chrome.storage.local.get([
    'shipUrl',
    'apiToken',
    'workerUrl',
    'workerSecret',
  ]);
  if (!data.shipUrl || !data.apiToken) return null;
  return data;
}

async function shipRequest(path, method = 'GET', body = null) {
  const config = await getConfig();
  if (!config) throw new Error('Not connected to ship');

  const opts = {
    method,
    headers: {
      Authorization: config.apiToken,
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${config.shipUrl}${path}`, opts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ship request failed: ${res.status} ${text}`);
  }
  return res.json();
}

// Write operations use the same HTTP API as reads —
// the agent handles POST /cloak-api/create and /burn directly,
// authenticated via the Authorization header (no Eyre channels needed).

// --- Cloudflare Worker (email client) ---

async function checkInbox(aliasAddress) {
  const config = await getConfig();
  if (!config?.workerUrl || !config?.workerSecret) return [];

  const res = await fetch(
    `${config.workerUrl}/inbox/${encodeURIComponent(aliasAddress)}`,
    {
      headers: { 'X-Cloak-Auth': config.workerSecret },
    }
  );

  if (!res.ok) return [];
  const data = await res.json();
  return data.messages || [];
}

async function deleteInbox(aliasAddress) {
  const config = await getConfig();
  if (!config?.workerUrl || !config?.workerSecret) return;

  await fetch(
    `${config.workerUrl}/inbox/${encodeURIComponent(aliasAddress)}`,
    {
      method: 'DELETE',
      headers: { 'X-Cloak-Auth': config.workerSecret },
    }
  );
}

// --- Message handlers ---

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handleMessage(msg)
    .then(sendResponse)
    .catch((err) => sendResponse({ error: err.message }));
  return true; // keep channel open for async response
});

async function handleMessage(msg) {
  switch (msg.type) {
    // --- Connection ---
    case 'connect': {
      await chrome.storage.local.set({
        shipUrl: msg.shipUrl,
        apiToken: msg.apiToken,
        workerUrl: msg.workerUrl || '',
        workerSecret: msg.workerSecret || '',
      });
      return { ok: true };
    }

    case 'disconnect': {
      await chrome.storage.local.clear();
      return { ok: true };
    }

    case 'getStatus': {
      const config = await getConfig();
      if (!config) return { connected: false };
      try {
        const cfConfig = await shipRequest('/cloak-api/config');
        return { connected: true, config: cfConfig };
      } catch {
        return { connected: false };
      }
    }

    // --- Identities ---
    case 'getIdentities': {
      return shipRequest('/cloak-api/identities');
    }

    case 'getIdentity': {
      return shipRequest(`/cloak-api/identity/${msg.id}`);
    }

    case 'matchDomain': {
      return shipRequest(`/cloak-api/match/${encodeURIComponent(msg.domain)}`);
    }

    case 'createCloak': {
      return shipRequest('/cloak-api/create', 'POST', {
        service: msg.service,
        label: msg.label,
      });
    }

    case 'burnCloak': {
      return shipRequest('/cloak-api/burn', 'POST', { id: msg.id });
    }

    // --- Email ---
    case 'checkMail': {
      return checkInbox(msg.alias);
    }

    case 'deleteInbox': {
      return deleteInbox(msg.alias);
    }

    // --- Autofill ---
    case 'autofill': {
      // Forward credentials to content script
      const tab = await getActiveTab();
      if (!tab) return { error: 'no active tab' };
      await chrome.tabs.sendMessage(tab.id, {
        type: 'fillForm',
        username: msg.username,
        password: msg.password,
      });
      return { ok: true };
    }

    default:
      return { error: `unknown message type: ${msg.type}` };
  }
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

// --- Periodic inbox check ---

chrome.alarms.create('check-inbox', { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'check-inbox') return;

  const config = await getConfig();
  if (!config) return;

  try {
    const identities = await shipRequest('/cloak-api/identities');
    if (!Array.isArray(identities)) return;

    const active = identities.filter((i) => i.status === 'active');

    for (const identity of active) {
      const full = await shipRequest(`/cloak-api/identity/${identity.id}`);
      if (!full?.alias?.address) continue;

      const messages = await checkInbox(full.alias.address);
      const withCodes = messages.filter((m) => m.code);

      if (withCodes.length > 0) {
        // Notify the user about new verification codes
        chrome.action.setBadgeText({ text: String(withCodes.length) });
        chrome.action.setBadgeBackgroundColor({ color: '#6c5ce7' });

        // Store latest codes temporarily for popup access
        await chrome.storage.session.set({
          pendingCodes: withCodes.map((m) => ({
            alias: full.alias.address,
            service: identity.service,
            label: identity.label,
            code: m.code,
            received: m.received,
          })),
        });
      }
    }
  } catch {
    // Silent fail on periodic check
  }
});
