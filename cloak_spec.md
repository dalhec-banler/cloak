# Cloak — Urbit Identity Firewall + Browser Companion
## v1 Product & System Specification

---

## Core Thesis

Cloak is a deterministic identity fragmentation system.

- Urbit = source of truth (identity control plane)
- Browser extension = execution layer
- Clearweb = untrusted environment

Cloak creates isolated identities per service while maintaining internal mapping inside Urbit.

---

## MVP Goal

User can:

1. Create a cloaked identity
2. Receive alias + credentials
3. Autofill signup/login via extension
4. Receive verification codes
5. Complete signup without exposing real identity

---

## Core Concepts

- Cloak: the system
- Cloaked Identity: one identity per service
- Alias: email endpoint
- Burn: revoke identity

---

## System Architecture

User (~zod)
→ Urbit Ship
→ Cloak Agent
→ Alias + Credential System
→ Browser Extension
→ External Services

---

## Data Models

### Cloaked Identity

{
  "id": "identity_123",
  "owner": "~zod",
  "service": "youtube",
  "label": "YouTube",
  "status": "active",
  "alias_id": "alias_abc",
  "credentials_id": "cred_xyz",
  "created_at": "timestamp"
}

### Alias

{
  "alias_id": "alias_abc",
  "email": "yt-a8f3k2@domain.com",
  "identity_id": "identity_123",
  "service": "youtube",
  "status": "active"
}

### Credentials

{
  "credentials_id": "cred_xyz",
  "identity_id": "identity_123",
  "username": "yt-a8f3k2@domain.com",
  "password": "ENCRYPTED",
  "created_at": "timestamp"
}

### Verification Message

{
  "message_id": "msg_001",
  "alias_id": "alias_abc",
  "code": "482193",
  "link": "https://...",
  "timestamp": "..."
}

---

## Core Mapping

alias → identity → service → urbit id

- Must never leave Urbit
- Must be encrypted at rest

---

## Email / Verification System

### Requirements

- Catch-all domain
- Email provider with webhook support

Examples:
- Mailgun
- Postmark
- Amazon SES

### Flow

Email received  
→ Webhook  
→ Inbound API  
→ Parser  
→ Urbit agent  
→ Extension/UI  

### Parser

Extract:
- verification codes
- confirmation links

---

## Browser Extension

### Principle

Extension is a thin client. Not a vault.

### Responsibilities

- Detect signup/login forms
- Request cloaked identity from Urbit
- Fetch credentials on demand
- Autofill fields
- Display verification codes

### Must Not

- Store secrets long-term
- Maintain identity database
- Act as password manager

---

## Extension Architecture

Content Script  
→ Background Script  
→ Secure API → Urbit Ship  

---

## Permissions

{
  "permissions": ["activeTab", "storage", "scripting"],
  "host_permissions": ["<all_urls>"]
}

---

## User Flows

### Create Cloak

1. User initiates creation
2. System returns:
   - alias email
   - password

---

### Signup

1. Extension detects form
2. User selects Cloak
3. Autofill executes
4. User submits

---

### Verification

1. Email arrives
2. Code extracted
3. Extension displays code
4. User pastes or auto-fills

---

### Login

1. Extension detects login form
2. Suggests identity
3. Autofill executes

---

## Security Model

### Trust Boundaries

- Urbit Ship: trusted
- Extension: semi-trusted
- Websites: untrusted

### Rules

- Secrets decrypted only on demand
- No persistent storage in extension
- Use short-lived tokens

---

## Storage Policy

| Location   | Data Stored        |
|------------|-------------------|
| Urbit      | All secrets       |
| Extension  | Minimal state     |
| Server     | Temporary email   |

---

## Alias Format

<service>-<random>@domain.com

Example:
yt-a8f3k2@domain.com

---

## Core Features

- Cloak creation
- Alias generation
- Verification inbox
- Autofill engine
- Burn / revoke

---

## Build Order

### Phase 1

1. Cloak creation
2. Alias generator
3. Email receiving
4. Parser
5. Urbit agent
6. Basic UI
7. Extension (minimal)

### Phase 2

- Auto-fill verification codes
- Identity switching

### Phase 3

- Leak detection
- Alias rotation

### Phase 4

- Session isolation
- Network routing

---

## Non-Goals

Do not build:

- Full email client
- Gmail replacement
- Full password manager
- Browser

---

## Product Positioning

Create a cloaked identity for any website.

Cloak handles:
- email
- verification
- identity separation

Urbit remains the control layer.

---

## Success Criteria

User can:

- create identity
- sign up for service
- verify account
- log in again
- revoke identity

---

## Final Principle

Precision fragmentation, not randomness.
