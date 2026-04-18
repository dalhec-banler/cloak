# Cloak — Sovereign Identity Fragmentation System
## Architecture Specification v1

---

## One-liner

SimpleLogin but sovereign — alias-to-identity mapping never leaves your Urbit ship.

---

## Core Thesis

Cloak creates isolated identities per clearweb service. Each identity gets a
unique email alias, generated credentials, and autofill support. The mapping
between aliases and identities lives exclusively inside the user's Urbit ship.
No company, relay, or third party holds the graph.

- **Urbit ship** — identity vault, credential storage, single source of truth
- **Browser extension** — thin client, email handler, form detection, autofill
- **Cloudflare** — dumb mailbox infrastructure, managed via API from the ship
- **Clearweb** — untrusted environment

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────┐
│                    Urbit Ship                        │
│                                                      │
│  Cloak Agent (Gall)                                  │
│  ├── Identity CRUD (create, read, update, burn)      │
│  ├── Credential generation + encrypted storage       │
│  ├── Alias ↔ identity ↔ service mapping              │
│  ├── API token management (extension auth)           │
│  ├── Cloudflare API integration (%iris)              │
│  │   ├── Domain setup (DNS, MX, email routing)       │
│  │   ├── Worker deployment                           │
│  │   └── Domain registration (optional)              │
│  └── Verification code storage                       │
│                                                      │
└───────────────────────┬──────────────────────────────┘
                        │ API token auth (HTTPS)
                        │
┌───────────────────────▼──────────────────────────────┐
│               Browser Extension                      │
│                                                      │
│  ├── Ship communication (API token)                  │
│  ├── Email client (Cloudflare Worker REST API)       │
│  │   ├── Create alias inbox                          │
│  │   ├── Poll for messages                           │
│  │   ├── Parse verification codes                    │
│  │   └── Delete burned inboxes                       │
│  ├── Form detection (signup / login / verification)  │
│  ├── Autofill engine                                 │
│  └── UI (popup + notifications)                      │
│                                                      │
│  Stores nothing persistent. Thin client.             │
│                                                      │
└───────────────────────┬──────────────────────────────┘
                        │ HTTPS (REST)
                        │
┌───────────────────────▼──────────────────────────────┐
│           Cloudflare (user-owned account)             │
│                                                      │
│  ├── Email Routing (catch-all → Worker)              │
│  ├── Worker (receives mail, stores in KV, REST API)  │
│  ├── KV (temporary message storage)                  │
│  └── DNS (MX records for user's domain)              │
│                                                      │
│  Dumb mailbox. No identity knowledge.                │
│  "Powered by Cloudflare"                             │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## Data Models

### Cloaked Identity

```
{
  id:             @uvH        :: unique identity ID
  service:        @t          :: "youtube", "github", etc.
  label:          @t          :: human-readable display name
  status:         ?(%active %burned)
  alias-id:       @uvH        :: links to alias
  credentials-id: @uvH        :: links to credentials
  created:        @da
  burned:         (unit @da)  :: null if active
}
```

### Alias

```
{
  id:           @uvH
  address:      @t          :: "yt-a8f3k2@userdomain.com"
  identity-id:  @uvH        :: back-reference
  service:      @t
  status:       ?(%active %burned)
}
```

### Credentials

```
{
  id:           @uvH
  identity-id:  @uvH
  username:     @t          :: usually the alias email
  password:     @t          :: stored in agent state (encrypted at rest by ship)
  created:      @da
}
```

### Verification Message

```
{
  id:           @uvH
  alias-id:     @uvH
  from:         @t
  subject:      @t
  code:         (unit @t)   :: extracted verification code, if found
  link:         (unit @t)   :: extracted confirmation link, if found
  raw:          @t          :: full message body
  received:     @da
}
```

### Cloudflare Config

```
{
  domain:       @t          :: "userdomain.com"
  api-token:    @t          :: Cloudflare API token
  account-id:   @t          :: Cloudflare account ID
  worker-url:   @t          :: deployed worker endpoint
  configured:   ?           :: setup complete flag
}
```

### API Token (extension auth)

```
{
  token:        @uvH
  created:      @da
  label:        @t          :: "Chrome on MacBook", etc.
  last-used:    @da
}
```

---

## Core Mapping

```
alias address → alias → identity → service → ship (@p)
```

This mapping exists ONLY in the ship's Cloak agent state. Not in the
extension. Not in Cloudflare. Not anywhere else.

---

## Identity Lifecycle

### Create Cloak

1. User selects service (or types custom)
2. Agent generates:
   - Random alias: `<service-prefix>-<6-random>@userdomain.com`
   - Strong random password
   - Unique identity ID linking them
3. Agent stores identity, alias, credentials in state
4. Extension receives credentials on demand

### Signup

1. Extension detects signup form on target service
2. User clicks "Use Cloak" in extension popup
3. Extension requests credentials from ship via API token
4. Extension autofills email + password
5. User submits form

### Verification

1. Service sends verification email to alias address
2. Email hits Cloudflare Email Routing → Worker → KV
3. Extension polls Worker REST API for new messages
4. Extension parses verification code or confirmation link
5. Extension displays code in popup or auto-fills verification field
6. Extension sends code to ship for storage (audit trail)

### Login

1. Extension detects login form
2. Extension matches domain to known identity
3. Extension requests credentials from ship
4. Autofill executes

### Burn

1. User burns a cloak from the Urbit UI
2. Agent marks identity + alias as burned
3. Extension deletes inbox from Cloudflare KV
4. Credentials retained in state (marked burned) for audit
5. No more mail received for that alias

---

## Email Architecture

### Cloudflare Setup (automated from Cloak UI)

One-time setup flow inside the Urbit app:

1. User creates free Cloudflare account (only step requiring browser)
2. User generates API token with permissions:
   - Zone:DNS:Edit
   - Zone:Zone:Edit  
   - Account:Workers:Edit
   - Account:KV:Edit
   - Account:Email Routing:Edit
3. User pastes API token + account ID into Cloak UI
4. User enters domain name (buy from Cloudflare or bring their own)
5. Cloak agent calls Cloudflare API via %iris:
   - Adds domain (or verifies existing)
   - Sets MX records for Email Routing
   - Creates KV namespace ("cloak-mail")
   - Deploys Worker from bundled template
   - Configures catch-all email rule → Worker
6. If user brings own domain: Cloak displays nameserver instructions
7. Setup complete. User never visits Cloudflare dashboard again.

### Cloudflare Worker

The Worker is ~150 lines of JavaScript. It does two things:

**Receive mail** (Email Worker handler):
- Triggered by Cloudflare Email Routing
- Extracts: from, to (alias address), subject, text body
- Stores in KV keyed by alias address
- Key format: `inbox:<alias-address>:<timestamp>`
- TTL: 7 days (auto-cleanup)

**REST API** (fetch handler):
- `GET /inbox/:alias` — list messages for an alias
- `DELETE /inbox/:alias` — delete all messages for an alias
- `DELETE /inbox/:alias/:messageId` — delete single message
- Auth: shared secret between Worker and extension (generated during setup,
  stored in ship state, passed to extension via API token handshake)

### Alias Format

```
<service-prefix>-<6-alphanumeric-random>@userdomain.com
```

Examples:
- `yt-a8f3k2@userdomain.com`
- `gh-m7x9p2@userdomain.com`
- `rd-w4k8n1@userdomain.com`

Service prefix is 2-3 chars, internal only (not exposed to the service).
The full address looks like a normal email to external services.

---

## Browser Extension

### Principle

The extension is a thin client and a dumb email reader. It is NOT a vault.

### Architecture

```
Extension
├── manifest.json (MV3 for Chrome, MV2/3 for Firefox)
├── background.js (service worker)
│   ├── Ship API client (token auth, HTTPS)
│   ├── Cloudflare Worker client (inbox polling)
│   └── Alarm scheduler (periodic inbox checks)
├── content.js (injected into web pages)
│   ├── Form detector (signup, login, verification)
│   ├── Autofill engine
│   └── Page context reporter
├── popup/ (extension popup UI)
│   ├── Active cloaks for current domain
│   ├── Verification code display
│   ├── Quick-create new cloak
│   └── Settings / ship connection
└── shared/
    ├── types
    └── crypto utils
```

### Permissions

```json
{
  "permissions": ["activeTab", "storage", "alarms"],
  "host_permissions": ["<all_urls>"]
}
```

`storage` is used ONLY for:
- Ship URL
- API token
- Worker URL + auth secret
- NO credentials, NO identity data

### Form Detection

Content script scans pages for:
- `<input type="email">` — email fields
- `<input type="password">` — password fields
- `<form>` elements containing the above
- Common signup patterns (name + email + password)
- Common login patterns (email/username + password)
- Verification code inputs (single or split digit fields)

Detection is heuristic-based. No DOM injection unless the user activates
Cloak on the page.

### Must Not

- Store credentials beyond the current session
- Maintain an identity database
- Make decisions about identity management
- Act as a password manager
- Phone home to any server except the user's own ship + their own Worker

---

## Authentication

### Extension ↔ Ship

1. User opens Cloak UI on ship
2. Clicks "Generate Extension Token"
3. Agent creates `@uvH` token, stores in state with label
4. User copies token
5. In extension popup: pastes ship URL + token
6. Extension stores URL + token in `chrome.storage.local`
7. All subsequent requests include `Authorization: Bearer <token>` header
8. Agent validates token on every request

Token can be revoked from the ship UI at any time.

### Extension ↔ Cloudflare Worker

- Shared secret generated during Cloudflare setup
- Stored in ship state, passed to extension during token handshake
- Extension sends secret as `X-Cloak-Auth` header to Worker
- Worker validates before serving inbox data

---

## Security Model

### Trust Boundaries

| Component | Trust Level | Holds Secrets |
|-----------|------------|---------------|
| Urbit Ship | Trusted | All secrets |
| Extension | Semi-trusted | Session tokens only |
| Cloudflare Worker | Untrusted | Raw email content (temporary, 7-day TTL) |
| Websites | Untrusted | Alias email + password (per-service) |

### Rules

- Credentials decrypted only on demand, never preloaded
- Extension requests credentials per-autofill, discards after use
- API tokens are ship-scoped, revocable
- Cloudflare KV data auto-expires (7-day TTL)
- No correlation data exists outside the ship
- Burned identities have credentials wiped from active use

### Encryption

v1: Ship-entropy-derived key stored in agent state. Urbit's existing disk
encryption provides the outer layer. Credentials stored as plain `@t` in
agent state (which is encrypted at the Vere level).

Future: YubiKey integration via WebAuthn for hardware-backed decryption
of the credential store.

---

## Urbit Agent Design

### State

```hoon
+$  state-0
  $:  %0
      identities=(map identity-id cloaked-identity)
      aliases=(map alias-id alias)
      credentials=(map credentials-id credential)
      messages=(map message-id verification-message)
      cf-config=(unit cloudflare-config)
      api-tokens=(map token-id api-token)
      counters=[next-id=@ud]
  ==
```

### Actions

```hoon
+$  action
  $%  :: identity management
      [%create-cloak service=@t label=@t]
      [%burn-cloak id=identity-id]
      :: cloudflare setup
      [%set-cf-config domain=@t api-token=@t account-id=@t]
      [%setup-cloudflare ~]
      :: extension auth
      [%generate-token label=@t]
      [%revoke-token id=token-id]
      :: verification
      [%store-verification alias-id=alias-id code=@t]
  ==
```

### Scry Endpoints

```
/x/identities          :: all active identities
/x/identity/<id>       :: single identity with alias + credentials
/x/aliases             :: all aliases
/x/cf-config           :: cloudflare configuration status
/x/tokens              :: all API tokens (without token values)
/x/messages/<alias-id> :: verification messages for an alias
```

### API Endpoints (Eyre)

The agent exposes HTTP endpoints via Eyre for the extension:

```
POST /~/cloak/credentials   :: get credentials for a service
POST /~/cloak/create        :: create new cloak
POST /~/cloak/verify        :: store verification code
GET  /~/cloak/match/:domain :: find identity matching a domain
```

All authenticated via API token in Authorization header.

---

## UI Design (Urbit Frontend)

### Views

**Dashboard** — list of all cloaked identities with status indicators
**Create Cloak** — service name + label, returns alias + credentials
**Identity Detail** — alias, credentials, verification history, burn button
**Settings**
  - Cloudflare setup wizard
  - API token management (generate, label, revoke)
  - Domain status
**Setup Wizard** — first-run Cloudflare configuration flow

### Stack

- React + TypeScript (same patterns as Grove UI)
- Vite build
- Served from ship via %docket

---

## Build Order

### Phase 1 — Foundation

1. `sur/cloak.hoon` — type definitions
2. `lib/cloak.hoon` — helper functions (ID generation, alias formatting)
3. `app/cloak.hoon` — Gall agent (identity CRUD, state management)
4. `mar/cloak/action.hoon` — action mark
5. `mar/cloak/update.hoon` — update mark
6. Cloudflare Worker template (`worker/`)

### Phase 2 — Extension Core

7. Extension scaffold (manifest, background, popup)
8. Ship communication layer (API token auth)
9. Email client (Worker REST API integration)
10. Form detection engine
11. Autofill engine

### Phase 3 — UI + Integration

12. Urbit frontend (React app)
13. Setup wizard (Cloudflare config flow)
14. Identity management UI
15. Extension popup UI (active cloaks, verification codes)

### Phase 4 — Polish

16. Verification code auto-fill
17. Cross-browser testing (Chrome + Firefox)
18. Error handling + edge cases
19. Documentation

### Future

- YubiKey / WebAuthn integration
- SMS verification via Twilio webhook
- OAuth callback handler
- Self-hosted mail option (Native Planet)
- Identity export / backup
- Leak detection (check if alias appeared in breach databases)
- Session isolation
- Network routing per identity

---

## Non-Goals (v1)

- Full email client
- Email sending
- Password manager replacement
- Phone number generation
- Payment card masking
- Native mobile app
- Centralized relay service
- Custom domain support (all aliases use one domain per user)

---

## Distribution

- Open source (GitHub)
- Urbit desk distributed via app star
- Extension published to Chrome Web Store + Firefox Add-ons
- Cloudflare Worker template bundled in repo

---

## Success Criteria

User can:

1. Set up Cloudflare from inside the Cloak UI (one-time)
2. Create a cloaked identity for any website
3. Sign up for that service using generated alias + credentials
4. Receive and auto-fill the verification code
5. Log back in later with stored credentials
6. Burn the identity when done
7. All without any data leaving their Urbit ship

---

## File Structure

```
cloak/
├── desk.bill
├── desk.docket-0
├── sys.kelvin
├── sur/
│   └── cloak.hoon
├── lib/
│   └── cloak.hoon
├── app/
│   └── cloak.hoon
├── mar/
│   └── cloak/
│       ├── action.hoon
│       └── update.hoon
├── cloak-ui/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── src/
│       ├── App.tsx
│       ├── main.tsx
│       ├── types.ts
│       ├── api.ts
│       └── components/
├── extension/
│   ├── manifest.json
│   ├── background.js
│   ├── content.js
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.js
│   │   └── popup.css
│   └── shared/
│       └── types.js
└── worker/
    ├── worker.js
    ├── wrangler.toml
    └── README.md
```
