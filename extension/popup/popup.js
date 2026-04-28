/**
 * Cloak Popup
 *
 * Thin UI layer. All data comes from the background script,
 * which gets it from the ship. Nothing is stored here.
 */

// --- DOM refs ---

const setupView = document.getElementById('setup-view');
const mainView = document.getElementById('main-view');
const createView = document.getElementById('create-view');

const shipUrlInput = document.getElementById('ship-url');
const apiTokenInput = document.getElementById('api-token');
const workerUrlInput = document.getElementById('worker-url');
const workerSecretInput = document.getElementById('worker-secret');
const connectBtn = document.getElementById('connect-btn');
const setupError = document.getElementById('setup-error');

const currentDomain = document.getElementById('current-domain');
const matchSection = document.getElementById('match-section');
const matchLabel = document.getElementById('match-label');
const matchAlias = document.getElementById('match-alias');
const autofillBtn = document.getElementById('autofill-btn');
const noMatchSection = document.getElementById('no-match-section');
const createBtn = document.getElementById('create-btn');
const codesSection = document.getElementById('codes-section');
const codesList = document.getElementById('codes-list');
const identitiesSection = document.getElementById('identities-section');
const identitiesList = document.getElementById('identities-list');
const settingsBtn = document.getElementById('settings-btn');

const backBtn = document.getElementById('back-btn');
const serviceNameInput = document.getElementById('service-name');
const serviceLabelInput = document.getElementById('service-label');
const submitCreateBtn = document.getElementById('submit-create-btn');
const createResult = document.getElementById('create-result');
const resultEmail = document.getElementById('result-email');
const resultPassword = document.getElementById('result-password');
const autofillNewBtn = document.getElementById('autofill-new-btn');

// --- State ---

let currentMatch = null;
let pageDomain = '';

// --- Views ---

function showView(view) {
  setupView.classList.add('hidden');
  mainView.classList.add('hidden');
  createView.classList.add('hidden');
  view.classList.remove('hidden');
}

// --- Init ---

async function init() {
  const status = await sendMessage({ type: 'getStatus' });

  if (!status.connected) {
    showView(setupView);
    return;
  }

  showView(mainView);

  // Get current tab domain
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.url) {
    try {
      const url = new URL(tab.url);
      pageDomain = url.hostname;
      currentDomain.textContent = pageDomain;
    } catch {
      pageDomain = '';
      currentDomain.textContent = '—';
    }
  }

  // Check for matching identity
  if (pageDomain) {
    try {
      const match = await sendMessage({ type: 'matchDomain', domain: pageDomain });
      if (match && !match.error) {
        currentMatch = match;
        matchLabel.textContent = match.identity.label;
        matchAlias.textContent = match.alias.address;
        matchSection.classList.remove('hidden');
        noMatchSection.classList.add('hidden');
      } else {
        matchSection.classList.add('hidden');
        noMatchSection.classList.remove('hidden');
        // Pre-fill create form with domain
        serviceNameInput.value = pageDomain.replace('www.', '').split('.')[0];
        serviceLabelInput.value = capitalize(serviceNameInput.value);
      }
    } catch {
      matchSection.classList.add('hidden');
      noMatchSection.classList.remove('hidden');
    }
  }

  // Check for pending verification codes
  const session = await chrome.storage.session.get('pendingCodes');
  if (session.pendingCodes?.length > 0) {
    codesSection.classList.remove('hidden');
    codesList.innerHTML = '';
    for (const pc of session.pendingCodes) {
      const card = document.createElement('div');
      card.className = 'code-card';
      card.innerHTML = `
        <div>
          <div class="code-value">${escapeHtml(pc.code)}</div>
          <div class="code-service">${escapeHtml(pc.label)}</div>
        </div>
        <button class="btn-small" data-code="${escapeHtml(pc.code)}">Fill</button>
      `;
      card.querySelector('button').addEventListener('click', async () => {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTab) {
          await chrome.tabs.sendMessage(activeTab.id, {
            type: 'fillCode',
            code: pc.code,
          });
        }
      });
      codesList.appendChild(card);
    }
    // Clear badge
    chrome.action.setBadgeText({ text: '' });
  }

  // Load all identities
  try {
    const identities = await sendMessage({ type: 'getIdentities' });
    if (Array.isArray(identities)) {
      const active = identities.filter((i) => i.status === 'active');
      identitiesList.innerHTML = '';

      if (active.length === 0) {
        identitiesList.innerHTML = '<div class="empty">No cloaks yet</div>';
      } else {
        for (const id of active) {
          const card = document.createElement('div');
          card.className = 'identity-card';
          card.innerHTML = `
            <div class="identity-info">
              <span class="identity-label">${escapeHtml(id.label)}</span>
              <span class="identity-alias">${escapeHtml(id.service)}</span>
            </div>
          `;
          identitiesList.appendChild(card);
        }
      }
    }
  } catch {
    identitiesList.innerHTML = '<div class="empty">Could not load</div>';
  }
}

// --- Event handlers ---

connectBtn.addEventListener('click', async () => {
  const shipUrl = shipUrlInput.value.trim().replace(/\/+$/, '');
  const apiToken = apiTokenInput.value.trim();
  const workerUrl = workerUrlInput.value.trim().replace(/\/+$/, '');
  const workerSecret = workerSecretInput.value.trim();

  if (!shipUrl || !apiToken) {
    showError('Ship URL and API token are required');
    return;
  }

  const result = await sendMessage({
    type: 'connect',
    shipUrl,
    apiToken,
    workerUrl,
    workerSecret,
  });

  if (result.error) {
    showError(result.error);
    return;
  }

  // Verify connection
  const status = await sendMessage({ type: 'getStatus' });
  if (!status.connected) {
    showError('Could not connect to ship. Check URL and token.');
    return;
  }

  init();
});

settingsBtn.addEventListener('click', () => {
  showView(setupView);
  // Pre-fill with current config
  chrome.storage.local.get(['shipUrl', 'apiToken', 'workerUrl', 'workerSecret'], (data) => {
    if (data.shipUrl) shipUrlInput.value = data.shipUrl;
    if (data.apiToken) apiTokenInput.value = data.apiToken;
    if (data.workerUrl) workerUrlInput.value = data.workerUrl;
    if (data.workerSecret) workerSecretInput.value = data.workerSecret;
  });
});

createBtn.addEventListener('click', () => {
  showView(createView);
  createResult.classList.add('hidden');
});

backBtn.addEventListener('click', () => {
  init();
});

autofillBtn.addEventListener('click', async () => {
  if (!currentMatch) return;
  await sendMessage({
    type: 'autofill',
    username: currentMatch.credential.username,
    password: currentMatch.credential.password,
  });
});

submitCreateBtn.addEventListener('click', async () => {
  const service = serviceNameInput.value.trim().toLowerCase();
  const label = serviceLabelInput.value.trim();

  if (!service || !label) return;

  const result = await sendMessage({
    type: 'createCloak',
    service,
    label,
  });

  if (result.error) return;

  // POST /create returns the full identity directly
  if (result.credential) {
    resultEmail.textContent = result.credential.username;
    resultPassword.textContent = result.credential.password;
    createResult.classList.remove('hidden');

    autofillNewBtn.onclick = async () => {
      await sendMessage({
        type: 'autofill',
        username: result.credential.username,
        password: result.credential.password,
      });
    };
  }
});

// --- Helpers ---

function sendMessage(msg) {
  return chrome.runtime.sendMessage(msg);
}

function showError(text) {
  setupError.textContent = text;
  setupError.classList.remove('hidden');
  setTimeout(() => setupError.classList.add('hidden'), 5000);
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// --- Boot ---

init();
