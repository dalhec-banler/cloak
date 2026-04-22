# Cloak — Sovereign Identity Fragmentation

Cloak is a deterministic identity fragmentation system built on Urbit. It lets you create isolated, disposable identities for any online service — unique email alias, generated password, verification code capture — while the real mapping never leaves your ship.

**One-liner:** SimpleLogin but sovereign.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Urbit Ship (TRUSTED)                                       │
│  └─ %cloak Gall agent                                       │
│     ├─ Identity vault (alias ↔ identity ↔ credentials)      │
│     ├─ Cloudflare API automation via %iris                   │
│     ├─ API token auth for extension                          │
│     └─ Eyre HTTP endpoints + scry interface                  │
├─────────────────────────────────────────────────────────────┤
│  Browser Extension (SEMI-TRUSTED)                            │
│  ├─ Form detection (signup / login / verification)           │
│  ├─ Autofill engine                                          │
│  ├─ Email inbox polling (from Worker)                        │
│  └─ Popup UI (connect, create, match, fill)                  │
├─────────────────────────────────────────────────────────────┤
│  Cloudflare Worker + KV (UNTRUSTED)                          │
│  ├─ Email Routing catch-all → KV storage (7-day TTL)         │
│  ├─ Verification code + link extraction                      │
│  └─ REST API: GET/DELETE /inbox/{alias}                      │
└─────────────────────────────────────────────────────────────┘
```

**Key constraints:**
- Urbit can't speak SMTP — it only has Ames, Eyre, Iris, Behn. So email receiving is handled by Cloudflare Email Routing → Worker → KV, and the extension polls the Worker.
- The extension IS the email client. It polls the Worker REST API, displays verification codes, and autofills them.
- No sidecar, no relay, no centralized service. The user buys their own domain (shared domain = correlation risk).
- Extension authenticates to ship via API token over HTTPS (not Eyre sessions — too fragile).

## Directory Structure

```
cloak/
├── SPEC.md                    # Detailed architecture specification (604 lines)
├── cloak_spec.md              # Product specification (324 lines)
├── README.md                  # This file
│
├── cloak/                     # Urbit desk (the %cloak app)
│   ├── desk.bill              # App manifest — declares %cloak
│   ├── desk.docket-0          # Docket metadata (title, version, etc.)
│   ├── sys.kelvin             # Loom version requirement
│   ├── app/
│   │   └── cloak.hoon         # Main Gall agent (~448 lines)
│   ├── sur/
│   │   └── cloak.hoon         # Type definitions (~110 lines)
│   ├── lib/
│   │   ├── cloak.hoon         # Helper functions (~190 lines)
│   │   └── server.hoon        # HTTP utilities (~108 lines, copied from %base)
│   ├── mar/
│   │   └── cloak/
│   │       ├── action.hoon    # Mark: JSON → action poke
│   │       └── update.hoon    # Mark: update → JSON subscription facts
│   └── web/                   # Built frontend (Vite output)
│       ├── index.html
│       └── assets/
│           ├── index.js
│           └── index.css
│
├── cloak-ui/                  # React frontend source
│   ├── package.json           # React 18, @urbit/http-api, Vite, Tailwind
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── index.html
│   └── src/
│       ├── App.tsx            # Main app, routing, subscription
│       ├── api.ts             # Ship API client (poke, scry, subscribe)
│       ├── types.ts           # TypeScript interfaces matching Hoon types
│       ├── main.tsx
│       ├── index.css
│       └── components/
│           ├── Dashboard.tsx       # Identity list, setup banner
│           ├── CreateCloak.tsx     # Service + label form
│           ├── IdentityDetail.tsx  # Credentials, copy, burn
│           ├── SetupWizard.tsx     # Cloudflare config steps
│           └── TokenManager.tsx    # API token CRUD
│
├── extension/                 # Chrome/Firefox MV3 extension
│   ├── manifest.json          # MV3, permissions: activeTab, storage, alarms
│   ├── background.js          # Service worker: ship comms, inbox polling (~233 lines)
│   ├── content.js             # Form detection + autofill engine (~243 lines)
│   ├── icons/                 # Extension icons (16, 48, 128, SVG)
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.js           # Popup UI logic (~291 lines)
│   │   └── popup.css
│   └── shared/
│       └── types.js
│
└── worker/                    # Cloudflare Worker
    ├── worker.js              # Email handler + REST API (~230 lines)
    └── wrangler.toml          # Wrangler config (KV binding, secret)
```

## Data Models

All types live in `cloak/sur/cloak.hoon`. TypeScript mirrors in `cloak-ui/src/types.ts`.

### Cloaked Identity
```
id:       @uvH           unique identity ID
service:  @t             e.g. "youtube", "github"
label:    @t             human-readable name
status:   %active/%burned
alias-id: @uvH           links to alias
cred-id:  @uvH           links to credentials
created:  @da
burned:   (unit @da)     null if active
```

### Alias
```
id:          @uvH
address:     @t          e.g. "yt-a8f3k2@userdomain.com"
identity-id: @uvH
service:     @t
status:      %active/%burned
```

### Credential
```
id:          @uvH
identity-id: @uvH
username:    @t          usually the alias email
password:    @t          stored encrypted at Vere level
created:     @da
```

### Verification Message
```
id:       @uvH
alias-id: @uvH
from:     @t
subject:  @t
code:     (unit @t)     extracted verification code
link:     (unit @t)     extracted confirmation link
raw:      @t            full message body
received: @da
```

### Cloudflare Config (`cf-config`)
```
domain:        @t
api-token:     @t
account-id:    @t
zone-id:       @t
kv-id:         @t
worker-url:    @t
worker-secret: @t
configured:    ?
```

### API Token
```
id:        @uvH
token:     @t
label:     @t           e.g. "Chrome on MacBook"
created:   @da
last-used: @da
```

## Agent API Reference

### Poke Actions (`%cloak-action` mark)

| Action | Payload | Effect |
|--------|---------|--------|
| `%create-cloak` | service, label | Generate identity + alias + credentials |
| `%burn-cloak` | identity-id | Mark identity + alias as burned |
| `%set-cf-config` | domain, api-token, account-id | Store initial Cloudflare credentials |
| `%setup-cloudflare` | *(none)* | Orchestrate CF zone lookup → KV creation → email routing rule via %iris |
| `%set-worker-url` | worker-url, worker-secret | Store deployed Worker endpoint |
| `%generate-token` | label | Create API token for extension auth |
| `%revoke-token` | token-id | Delete API token |
| `%store-verification` | alias-id, from, subject, code, link, raw | Save extracted verification message |
| `%request-credentials` | identity-id | Respond with credentials for identity |

### Subscription Updates (`%cloak-update` mark, path `/updates`)

| Update | Payload | When |
|--------|---------|------|
| `%cloak-created` | full identity + alias + credential | Identity created |
| `%cloak-burned` | identity-id | Identity burned |
| `%cf-configured` | cf-config | Cloudflare setup complete |
| `%cf-setup-error` | error message | Cloudflare setup failed |
| `%token-generated` | token object | Token created |
| `%token-revoked` | token-id | Token deleted |
| `%verification-received` | verification message | Message stored |
| `%credentials-response` | identity + credentials | Credentials fetched |

### HTTP Endpoints (Eyre, bound at `/cloak-api`)

All require `Authorization: Bearer <token>` header.

| Method | Path | Returns |
|--------|------|---------|
| GET | `/cloak-api/identities` | All active identities (JSON) |
| GET | `/cloak-api/identity/{id}` | Full identity with alias + credentials |
| GET | `/cloak-api/match/{domain}` | Find active identity by service name |
| GET | `/cloak-api/config` | Cloudflare config status |
| GET | `/cloak-api/tokens` | API tokens (without token values) |

CORS enabled (`Access-Control-Allow-Origin: *`).

### Scry Endpoints

| Path | Returns |
|------|---------|
| `/x/identities` | All active identities |
| `/x/identity/<id>` | Single identity |
| `/x/aliases` | All aliases |
| `/x/cf-config` | Cloudflare config |
| `/x/tokens` | API tokens |
| `/x/messages/<alias-id>` | Verification messages for alias |

## Cloudflare Worker API

All require `X-Cloak-Auth` header matching `WORKER_SECRET`.

| Method | Path | Effect |
|--------|------|--------|
| GET | `/inbox/{alias}` | List messages for alias |
| DELETE | `/inbox/{alias}` | Delete all messages for alias |
| DELETE | `/message/{msgId}` | Delete single message |
| GET | `/health` | Status check |

Email handler: triggered by Cloudflare Email Routing catch-all rule. Parses MIME, extracts verification codes (regex: 4-8 digit patterns after "code:", "verify:", etc.) and confirmation links (URLs containing verify/confirm/auth/token). Stores in KV with 7-day TTL.

## Extension Architecture

### background.js (Service Worker)
- `shipRequest(path, method, body)` — authenticated fetch to ship Eyre
- `pokeShip(action)` — send action via `/~/channel`
- `checkInbox(aliasAddress)` — poll Worker REST API
- `chrome.alarms` — checks inbox every 1 minute, sets badge on pending codes
- Message handlers: connect, disconnect, getStatus, getIdentities, getIdentity, matchDomain, createCloak, burnCloak, checkMail, deleteInbox, autofill

### content.js (Injected)
- `findForms()` — scan page for forms with email/password/code inputs
- `analyzeForm(form)` — classify: signup (2+ passwords), login (1 password + email), verification (code field)
- `fillInput(input, value)` — set value + dispatch input/change/keyup events
- `fillForm(username, password)` — fill first detected form
- `fillCode(code)` — fill verification code (handles split-digit 6-field inputs)

### popup/popup.js
- **Setup view:** Ship URL, API token, Worker URL, Worker secret → `chrome.storage.local`
- **Main view:** Current domain, matched identity + autofill, create new, pending codes, identity list
- **Create view:** Service + label → poke ship → show result with copy + autofill buttons

## Security Model

| Component | Trust Level | Stores |
|-----------|------------|--------|
| Urbit Ship | Trusted | All secrets, all mappings, all credentials |
| Extension | Semi-trusted | Connection config only (`chrome.storage.local`), session codes (`chrome.storage.session`) |
| CF Worker + KV | Untrusted | Raw email bodies only, 7-day auto-expiry, no metadata |
| Websites | Untrusted | Alias email + unique password per service |

**Key principles:**
- Credentials decrypted on demand, never preloaded
- Extension stores only connection config (ship URL + token) — no secrets
- API tokens revocable from ship UI at any time
- KV data auto-expires in 7 days
- No data maps aliases to real identities outside the ship
- Burned identities: credentials kept for audit trail, disabled for use
- Encryption v1: Vere disk encryption + ship entropy key. YubiKey/WebAuthn planned.

## Core User Flows

### Create Cloak + Signup
1. User creates identity in UI (service name + label)
2. Agent generates unique alias email + 24-char password
3. User visits target site → extension detects signup form
4. Click autofill → extension fetches credentials from ship → fills form
5. Submit signup → service sends verification email to alias
6. CF Email Routing → Worker → KV (code extracted)
7. Extension polls Worker every 60s → displays code with badge
8. Click "Fill" → code autofilled into verification form

### Login
1. Visit site → extension calls `GET /cloak-api/match/{domain}`
2. If match found: show identity + autofill button
3. Click autofill → fill email + password → submit

### Burn
1. Click burn on identity detail → confirm dialog
2. Poke `%burn-cloak` → identity + alias marked burned
3. Credentials preserved for audit, identity no longer usable

### Cloudflare Setup (automated via %iris)
1. User enters domain, CF API token, account ID in Setup Wizard
2. Agent pokes CF API: zone lookup → KV namespace creation → catch-all email routing rule
3. On success: `%cf-configured` emitted, setup wizard shows success
4. User deploys Worker separately (`npx wrangler deploy`)

## Current State & Known Issues

**What works:**
- All type definitions (`sur/cloak.hoon`) build
- Helper library (`lib/cloak.hoon`) builds — includes CF headers, JSON en/dejs, ID/alias/password generation
- Marks (`mar/cloak/action.hoon`, `mar/cloak/update.hoon`) build
- React UI builds (174KB bundle) with all 5 components functional
- Browser extension ready to load unpacked
- Worker ready for `wrangler deploy`

**Known build issue:**
- `app/cloak.hoon` — the FULL version with `%iris` response handling in `on-arvo` fails to build on the ship. A stripped version (without iris handling) builds fine. The local file has the full version. The issue is isolated to the `on-arvo` arm's `|^` barket with iris response parsing. Suspected causes:
  - `+.+.sign-arvo` accessor pattern may be wrong
  - `outbound-config` mismatch (passing `~` vs `*outbound-config:iris`)
  - sign-arvo type narrowing in the iris response handler

**Dev environment:**
- Dev moon: `~midlut-sarseb-palrum-roclur`
- Desk `%cloak` exists on moon but was `|uninstall`ed for Clay consistency

## Resume Checklist

If picking this up, follow this order:

1. **Fix the `on-arvo` %iris build failure** in `app/cloak.hoon`. The full agent with Cloudflare automation doesn't compile. The stripped version (no iris) does. Compare the two, fix the iris response parsing in the `on-arvo` barket. Key area: how the agent handles `%iris` `%http-response` signs.

2. **Install and test the agent:**
   ```
   |install our %cloak
   :cloak &cloak-action [%generate-token 'test-token']
   :cloak &cloak-action [%set-cf-config 'domain.com' 'cf-api-token' 'account-id']
   :cloak &cloak-action [%create-cloak 'youtube' 'YouTube']
   :cloak &cloak-action [%burn-cloak 0v1234.5678]
   ```

3. **Test %iris Cloudflare automation** — poke `%setup-cloudflare` after setting CF config. Watch for zone lookup, KV creation, email routing rule creation.

4. **Build and deploy frontend:**
   ```
   cd cloak-ui && npm install && npm run build
   ```
   Copy `dist/` output to `cloak/web/`. Upload globe.

5. **Set up docket** — `desk.docket-0` exists but the ship may not have the `docket-0` mark available. May need to copy mark from `%garden` or `%base`.

6. **Deploy Worker:**
   ```
   cd worker
   # Fill in KV namespace ID and secret in wrangler.toml
   npx wrangler deploy
   ```

7. **Load extension** — `chrome://extensions` → Developer mode → Load unpacked → point to `extension/`

8. **End-to-end test:** Create identity → signup on a real site → receive verification email → autofill code → complete signup → login again later.

## Future Roadmap

- YubiKey / WebAuthn hardware-backed decryption
- SMS verification (Twilio integration)
- OAuth callback handler
- Self-hosted mail (Native Planet hardware)
- Leak detection (breach database check)
- Alias rotation
- Session isolation / network routing
- Firefox Add-ons submission
- Chrome Web Store submission

## Distribution

- **Urbit agent:** Published via app star distribution
- **Extension:** Chrome Web Store + Firefox Add-ons (future)
- **Worker:** User deploys their own via Wrangler during setup (no shared infra)
- **GitHub:** `dalhec-banler/cloak`