# PLS Your Life Calendar — OAuth Identity, Account Linking, and Calendar Sync Plan

**Repository:** `Hunter52302/life-calendar`  
**Baseline:** v1.2.2  
**Status:** Architecture and implementation plan  
**Primary goal:** Add Google and Apple sign-in without allowing either provider to own, strand, duplicate, or erase a PLS account. Preserve optional local-only use. Add Google Calendar and Apple Calendar connections as separate, user-controlled integrations.

---

## 1. Required product behavior

PLS must support four independent choices:

1. **No account / local-only**
   - No sign-in required.
   - No OAuth prompt.
   - No backend dependency.
   - Existing local calendar remains fully usable.
   - User may export/import backups.

2. **PLS account**
   - PLS-generated internal user ID owns account and encrypted data.
   - Password/recovery-key authentication may remain available.
   - Google and Apple may be added as optional sign-in methods.

3. **Identity-provider sign-in**
   - Google or Apple verifies control of an external identity.
   - Provider identity resolves to an existing PLS user ID.
   - Provider loss, revocation, outage, or account closure must not delete PLS data.
   - User may link multiple providers and multiple provider accounts.

4. **External calendar connection**
   - Google Calendar or Apple Calendar connection is separate from login.
   - Signing in with Google must not silently connect Google Calendar.
   - Connecting Google Calendar must not make Google the account owner.
   - Apple sign-in must not imply Apple Calendar access.
   - Calendar permissions must be explicit, revocable, and least-privilege.

Core doctrine:

> Providers verify identities. PLS owns accounts, sessions, encryption envelopes, recovery, authorization, and data.

> Calendar providers supply calendar data. PLS controls local display, sync policy, conflict handling, and disconnection behavior.

---

## 2. Current v1.2.2 baseline

Current repository already contains important foundations:

- React/Vite frontend.
- Tauri desktop shell.
- Capacitor mobile targets.
- Express API.
- PocketBase internal data store.
- Local-only mode.
- Password-derived zero-knowledge account encryption.
- Recovery envelope and recovery code flow.
- JWT account sessions.
- Google Calendar OAuth connection flow.
- Microsoft Calendar OAuth connection flow.
- Encrypted storage of calendar access and refresh tokens.
- Connected-calendar records separated from core event records.

Current limitations:

- `users.email` still acts as primary login lookup.
- External identity subjects are not modeled independently.
- Google OAuth currently connects calendars only; it does not authenticate PLS accounts.
- Apple sign-in does not exist.
- Safe multi-provider linking does not exist.
- Duplicate-account prevention and deliberate merge flows do not exist.
- Current JWTs are long-lived bearer tokens without a full refresh-token/device-session model.
- Calendar connection token encryption depends on `JWT_SECRET`; rotation disconnects every integration.
- Apple Calendar sync architecture is not defined.

Do not replace working calendar OAuth while building identity. Refactor it behind shared provider modules only after tests cover current behavior.

---

## 3. Non-negotiable identity rules

### 3.1 Internal identity

Every server-backed PLS account has an immutable PLS-generated ID:

```text
PLS user ID: 8d42...  ← account owner
  ├─ password credential
  ├─ recovery key
  ├─ Google subject A
  ├─ Google subject B
  ├─ Apple subject C
  ├─ trusted device 1
  └─ trusted device 2
```

Never use any of these as the account primary key:

- email address
- Google email
- Google `sub`
- Apple `sub`
- Apple private relay email
- device ID
- calendar account ID
- refresh token

### 3.2 No automatic account merge by email

Do not merge two PLS accounts because provider emails match.

Reasons:

- Apple Hide My Email may return a relay address.
- Google email may change.
- Two providers can return the same email but represent different provider identities.
- Shared or recycled addresses exist.
- Email matching creates account-takeover risk.

Email may be used as a hint only.

### 3.3 Explicit linking

A new provider identity may attach to an existing PLS account only when:

- user is already authenticated to that PLS account; or
- user proves control of both accounts in a dedicated merge flow.

A provider callback must never silently move an identity from one PLS account to another.

### 3.4 No sole-provider lockout

After first login through Google or Apple, user should be prompted to add at least one independent recovery path:

- PLS recovery key
- password credential
- second provider
- passkey later
- existing trusted device

Do not block initial use. Show a persistent but non-manipulative account-safety notice until recovery exists.

### 3.5 Provider removal safety

User may unlink Google or Apple only when another valid sign-in/recovery method remains.

If removing it would strand account:

```text
Cannot remove this sign-in method yet.
Add another sign-in method or recovery key first.
```

Calendar connections may always be disconnected without deleting account or PLS-created events.

---

## 4. Separate identity from calendar authorization

Use separate consent surfaces, scopes, records, routes, and token stores.

### 4.1 Google login

Purpose: authenticate identity.

Recommended scopes:

```text
openid
email
profile
```

Do not request Calendar scopes during login.

### 4.2 Google Calendar connection

Purpose: read or sync calendar data.

Start with read-only:

```text
https://www.googleapis.com/auth/calendar.readonly
```

Add write scope later only behind a separate feature and consent:

```text
https://www.googleapis.com/auth/calendar.events
```

### 4.3 Apple login

Purpose: authenticate identity using Sign in with Apple.

Store provider subject. Treat email and name as optional profile claims. Apple may provide name/email only during first authorization. Never depend on receiving them again.

### 4.4 Apple Calendar connection

Sign in with Apple does not grant Apple Calendar access.

Use two different implementation paths:

#### Preferred first path: native EventKit bridge

For iOS, iPadOS, and macOS native builds:

- request calendar permission from operating system
- read device calendars through EventKit
- optionally write events later through EventKit
- keep permission and sync device-local
- do not send Apple calendar credentials to PLS server
- identify calendars by stable local bridge identifiers where possible

This gives access to calendars configured on device, which may include iCloud, Google, Exchange, or local calendars. UI must call this **Device Calendars**, not automatically **iCloud Sync**.

#### Later optional path: iCloud CalDAV

For cross-platform/server-side Apple calendar sync, evaluate CalDAV with an Apple app-specific password.

Risks:

- not Sign in with Apple OAuth
- user must create and revoke an app-specific password
- server must hold a sensitive reusable credential
- more complex discovery and sync semantics
- poorer onboarding than Google Calendar OAuth

Do not make CalDAV part of first OAuth milestone. Complete a separate security review first.

---

## 5. Target architecture

```text
Google OIDC ───────┐
Apple OIDC ────────┤
Password verifier ─┤
Recovery key ──────┤
Future passkey ────┘
        ↓
Identity verification adapters
        ↓
PLS identity resolution service
        ↓
PLS user ID
        ↓
Device session + PLS authorization
        ↓
Encrypted PLS data sync

Google Calendar OAuth ─┐
Microsoft Calendar ────┤
Native EventKit ───────┤
Future CalDAV ─────────┘
        ↓
Calendar connection service
        ↓
External calendar sync engine
        ↓
Linked-calendar/event projection
```

Create server modules without restructuring unrelated code:

```text
server/auth/
├── identityService.js
├── sessionService.js
├── linkingService.js
├── recoveryPolicy.js
├── accountMergeService.js
├── auditService.js
├── providerRegistry.js
└── providers/
    ├── googleIdentity.js
    └── appleIdentity.js

server/calendar/
├── connectionService.js
├── syncService.js
├── conflictPolicy.js
├── providerRegistry.js
└── providers/
    ├── googleCalendar.js
    ├── microsoftCalendar.js
    ├── deviceCalendar.js
    └── caldav.js              # future, disabled
```

Provider adapters verify external claims. They do not create users, link accounts, merge users, issue PLS sessions, or decide authorization.

---

## 6. PocketBase data model

Add new numbered PocketBase migrations. Do not edit released migrations.

### 6.1 `auth_identities`

One external login identity linked to one PLS user.

```text
id                      text/uuid primary key
user_id                 relation users required
provider                text required: google | apple
provider_subject        text required
email_normalized        text nullable
email_verified          bool nullable
is_private_relay        bool default false
display_name            text nullable
provider_metadata       json nullable, allow-listed only
created_at              datetime
updated_at              datetime
last_authenticated_at   datetime nullable
revoked_at              datetime nullable
```

Unique active identity:

```text
(provider, provider_subject)
```

Do not make email unique here.

### 6.2 `auth_sessions`

```text
id                  text/uuid primary key
user_id             relation users required
device_id           relation auth_devices required
access_jti          text required
created_at          datetime
last_seen_at        datetime nullable
authenticated_at    datetime
expires_at          datetime
revoked_at          datetime nullable
revoke_reason       text nullable
```

### 6.3 `auth_refresh_tokens`

```text
id                    text/uuid primary key
session_id            relation auth_sessions required
token_hash            text required
created_at            datetime
expires_at            datetime
used_at               datetime nullable
revoked_at             datetime nullable
replacement_token_id  relation auth_refresh_tokens nullable
reuse_detected_at     datetime nullable
```

Store token hashes only. Rotate refresh token on every use. Revoke token family on reuse.

### 6.4 `auth_devices`

```text
id                text/uuid primary key
user_id           relation users required
device_public_id  text required
platform          text required
device_name       text nullable
app_version       text nullable
os_version        text nullable
created_at        datetime
last_seen_at      datetime
revoked_at        datetime nullable
```

Unique:

```text
(user_id, device_public_id)
```

Generate random app-specific device IDs. Do not fingerprint hardware.

### 6.5 `auth_link_challenges`

Short-lived proof for linking providers.

```text
id                  text/uuid primary key
user_id             relation users required
provider            text required
nonce_hash          text required
pkce_verifier_hash  text nullable
created_at          datetime
expires_at          datetime
consumed_at         datetime nullable
origin              text nullable
```

### 6.6 `auth_events`

Security audit trail.

```text
id               text/uuid primary key
user_id          relation users nullable
session_id       relation auth_sessions nullable
event_type       text required
provider         text nullable
result           text required
ip_hash          text nullable
user_agent_class text nullable
metadata         json nullable
created_at       datetime
```

Examples:

```text
login_succeeded
login_failed
provider_linked
provider_link_rejected
provider_unlinked
recovery_key_created
recovery_used
session_revoked
refresh_reuse_detected
account_merge_started
account_merge_completed
calendar_connected
calendar_disconnected
```

Avoid raw IP retention unless necessary. Prefer keyed hash and short retention.

### 6.7 Extend `calendar_connections`

Current provider connection record should support multiple accounts per provider and clearer state.

Add or verify:

```text
user_id
provider
provider_account_subject nullable
account_email nullable
connection_label nullable
scopes
access_token_ciphertext nullable
refresh_token_ciphertext nullable
token_expires_at nullable
sync_cursor nullable
last_successful_sync_at nullable
last_sync_attempt_at nullable
sync_status
last_error_code nullable
revoked_at nullable
created_at
updated_at
```

Unique connection should not be `(user_id, provider)` because user may connect multiple Google accounts.

Use:

```text
(user_id, provider, provider_account_subject)
```

For device calendars, connection IDs are local and should not require server token records.

---

## 7. Encryption and zero-knowledge account implications

Current password flow derives a key-encryption key from password and unwraps the account data-encryption key client-side. OAuth login does not provide a reusable secret suitable for deriving that key.

Therefore OAuth must authenticate account access **and** provide a safe way to unlock the existing encrypted DEK.

### Recommended staged model

#### Stage A: OAuth as linked login plus trusted-device unlock

- Existing password-created users link Google/Apple.
- OAuth verifies account identity.
- Device stores DEK or device-wrapped DEK in secure platform storage.
- OAuth login on an already trusted device unlocks local wrapped DEK.
- New device still requires password or recovery key to obtain/decrypt DEK.

This preserves current zero-knowledge properties and is safest first implementation.

#### Stage B: OAuth-first account enrollment

For users who create account with Google/Apple:

1. Client generates random DEK.
2. Client generates recovery key immediately.
3. Client wraps DEK under recovery-key-derived KEK.
4. Client generates device key pair.
5. Client wraps DEK to trusted device key or secure enclave/keychain mechanism.
6. Server stores ciphertext envelopes and public device data only.
7. Additional devices require provider authentication plus an approved device/recovery proof.

Do not encrypt DEK directly with Google or Apple tokens. Tokens expire, rotate, and are visible to provider/server flows.

#### Stage C: passkeys

Add passkeys as provider-independent account authentication and recovery. Passkeys should resolve to PLS user ID and may become preferred long-term login.

### Secure storage targets

- iOS/iPadOS/macOS: Keychain; Secure Enclave-backed key when practical.
- Android: Android Keystore.
- Windows Tauri: OS credential/key storage plugin or DPAPI-backed secret store.
- Linux Tauri: Secret Service/libsecret where available; documented fallback.
- Web: IndexedDB-held encrypted envelope; no claim of equivalent device security.

Never store plaintext DEK in ordinary localStorage.

---

## 8. Authentication API design

Use versioned or clearly separated routes.

### 8.1 Provider configuration

```http
GET /api/auth/providers
```

Response:

```json
{
  "password": true,
  "recoveryKey": true,
  "google": { "enabled": true },
  "apple": { "enabled": false },
  "passkeys": { "enabled": false }
}
```

### 8.2 Begin provider login

```http
POST /api/auth/oauth/:provider/start
```

Body:

```json
{
  "intent": "login",
  "redirectTarget": "desktop|web|ios|android",
  "devicePublicId": "random-app-generated-id"
}
```

Server generates:

- state
- nonce
- PKCE verifier/challenge where supported
- short-lived flow record
- provider authorization URL

Return URL only. Never let client choose arbitrary callback origins.

### 8.3 Provider callback

```http
GET|POST /api/auth/oauth/:provider/callback
```

Server:

1. validates state and expiry
2. validates nonce
3. exchanges code server-side
4. validates ID token signature, issuer, audience, expiry, and subject
5. resolves `(provider, subject)`
6. returns short-lived one-time completion code
7. never places access JWT or refresh token in query string

### 8.4 Complete login

```http
POST /api/auth/oauth/complete
```

Body contains one-time completion code and device metadata.

Possible results:

```text
authenticated_existing_account
new_account_requires_recovery_setup
provider_not_linked_choose_create_or_sign_in
account_merge_required
blocked
```

### 8.5 Link provider while signed in

```http
POST /api/auth/identities/:provider/link/start
DELETE /api/auth/identities/:identityId
GET /api/auth/identities
```

Requirements:

- active PLS session
- recent authentication for sensitive link/unlink
- state bound to current user and intent `link`
- reject identity already linked elsewhere

### 8.6 Sessions

```http
POST /api/auth/sessions/refresh
GET  /api/auth/sessions
DELETE /api/auth/sessions/:sessionId
POST /api/auth/sessions/revoke-all
```

Access token target: 10–20 minutes.  
Refresh token target: 30 days with rotation.  
Trusted-device status does not mean permanent session.

### 8.7 Existing password routes

Keep current routes during migration:

```text
/prelogin
/register
/login
/recovery-envelope
/reset-password
```

Move session issuance behind shared `sessionService`. Password and OAuth must issue identical PLS session types.

---

## 9. Google identity implementation

Create a Google Identity OAuth client separate from, or clearly scoped alongside, Google Calendar OAuth.

Server verification requirements:

- authorization code flow
- PKCE for public clients
- state and nonce
- validate issuer
- validate audience/client ID
- validate signature against Google JWKS
- validate `exp`, `iat`, and `sub`
- treat `sub` as stable external identity key
- treat email as optional mutable claim
- require `email_verified` before using email as a contact/recovery hint

Configuration:

```text
GOOGLE_IDENTITY_CLIENT_ID=
GOOGLE_IDENTITY_CLIENT_SECRET=
GOOGLE_IDENTITY_REDIRECT_URI=
```

Do not reuse calendar scopes for login. It is acceptable to use same Google Cloud project, but consent purpose and route code must remain separated.

Platform clients may need distinct client IDs:

```text
GOOGLE_WEB_CLIENT_ID
GOOGLE_IOS_CLIENT_ID
GOOGLE_ANDROID_CLIENT_ID
```

Backend audience validation must allow only configured IDs.

---

## 10. Apple identity implementation

### 10.1 Required Apple setup

Sign in with Apple production setup requires Apple Developer configuration:

- App ID / bundle identifier
- Sign in with Apple capability
- Services ID for web flow
- private key (`.p8`)
- Key ID
- Team ID
- registered return URLs/domains

Configuration:

```text
APPLE_TEAM_ID=
APPLE_KEY_ID=
APPLE_PRIVATE_KEY=
APPLE_SERVICE_ID=
APPLE_BUNDLE_ID=
APPLE_REDIRECT_URI=
```

Store private key in Infisical or protected host secret, never repository.

### 10.2 Verification

Validate:

- Apple JWKS signature
- issuer
- audience
- expiration
- nonce
- authorization code
- provider subject

Persist name/email only when first returned. Do not overwrite existing profile with null on later logins.

Detect private relay:

```text
email ends with @privaterelay.appleid.com
```

Store `is_private_relay=true`; do not expose relay status publicly.

### 10.3 Native and web flows

- iOS/macOS: native Sign in with Apple bridge can obtain authorization credential.
- Web/Tauri/other platforms: browser-based Services ID flow.
- All paths send proof to same backend verifier and identity resolver.
- Deep-link callback must use allow-listed schemes/domains.

### 10.4 Account lifecycle

Implement later but design now for Apple credential revocation/account-change notifications. A revocation event should disable that identity, not delete PLS user or encrypted data.

---

## 11. Duplicate-account prevention and merge policy

### 11.1 First provider login decision

When `(provider, subject)` is unknown:

Show:

```text
Continue by creating a new PLS account
or
Sign in to an existing PLS account and link this method
```

If provider email matches an existing PLS email, show a neutral warning:

```text
A PLS account may already use this email.
Sign in to that account to link this method.
PLS will not merge accounts automatically.
```

Do not reveal whether account definitely exists before proof.

### 11.2 Merge flow

Account merge should be a later protected flow, not first milestone.

Required proof:

- active recent session for account A
- recent authentication for account B
- recovery/decryption access to both encrypted datasets
- explicit selection of destination account
- preview of conflicts
- resumable transaction
- audit record
- post-merge revocation of all sessions except current approved device

Never perform server-only ciphertext reassignment without client participation. Data must be decrypted/re-encrypted or envelopes must be correctly rewrapped client-side.

### 11.3 Merge conflicts

Handle:

- same event ID with different ciphertext/version
- duplicate imported external event
- category ID collisions
- habits and completion IDs
- connected calendar ownership
- notification integrations
- appearance/settings
- deleted-record tombstones

Prefer deterministic rename/remap tables, not silent overwrite.

---

## 12. Account settings UX

Add **Account & Sign-in** page.

Sections:

### Sign-in methods

```text
PLS password               Connected / Not set
Recovery key               Created / Not created
Google — user@gmail.com    Connected
Apple — relay/private      Connected
Add sign-in method
```

### Devices and sessions

```text
This MacBook — current
iPhone — last active...
Web browser — last active...
Sign out
Revoke device
Sign out everywhere
```

### Calendar connections

Separate page/section:

```text
Google Calendar — work@gmail.com
Google Calendar — personal@gmail.com
Device Calendars — enabled on this device
Microsoft Calendar — disconnected
```

Each connection displays:

- account label
- calendars selected
- read-only/write capability
- last successful sync
- current error state
- reconnect
- disconnect

### Local-only mode

Account page should state:

```text
This calendar is stored only on this device.
No sign-in is required.
Export a backup to protect against device loss or cleared app data.
```

Offer **Create account and sync** without coercion.

---

## 13. Local-only to account migration

When local-only user creates or signs into account:

Do not automatically upload local data.

Show options:

```text
Keep local calendar separate
Upload local calendar into this PLS account
Replace local calendar with account calendar
Review and merge
```

Default safest option: **Review and merge**.

Before migration:

- create local JSON backup
- assign stable IDs where missing
- detect duplicates
- encrypt locally before upload
- show item counts
- preserve undo/import backup

Signing out must not silently delete local cached data. Offer:

```text
Keep encrypted offline copy on this device
Remove account data from this device
```

---

## 14. Google Calendar sync plan

### 14.1 Preserve existing connection flow

Current `oauthProvider.js` and Google provider module already create encrypted connection records. Refactor only after characterization tests.

### 14.2 Multi-account support

Allow multiple Google identities and multiple Google Calendar connections. Identity account and calendar account may differ.

Examples:

```text
PLS login: Apple
Calendar 1: personal Gmail
Calendar 2: work Google Workspace
```

### 14.3 Sync behavior

Initial sync:

1. list calendar list
2. user selects calendars
3. fetch bounded historical/future window
4. store provider event identifiers and etags
5. store sync token

Incremental sync:

- use provider sync token/page token
- handle invalidated sync token with controlled full resync
- use exponential backoff
- respect rate limits
- never loop indefinitely

### 14.4 Imported event model

External event should include:

```text
source_type: external
authority: google
connection_id
external_calendar_id
external_event_id
external_etag
external_updated_at
read_only
```

Do not overwrite PLS-native event with external record merely because title/time match.

### 14.5 Conflict policy

First release: read-only Google import.

This avoids bidirectional conflict complexity. Later write-back release must define:

- source-of-truth selection
- deletion propagation
- recurring event exceptions
- attendee and organizer fields
- reminders
- time zone changes
- all-day event semantics
- unsupported field preservation

---

## 15. Apple Device Calendar sync plan

### 15.1 Native bridge

Add Capacitor plugin and Tauri/macOS command bridge exposing a narrow API:

```text
requestCalendarAccess()
getCalendarAuthorizationStatus()
listDeviceCalendars()
fetchDeviceEvents(range, calendarIds)
createDeviceEvent(event)          # later
updateDeviceEvent(event)          # later
deleteDeviceEvent(id)             # later
```

Do not expose arbitrary EventKit objects directly to JavaScript. Normalize fields.

### 15.2 Permission design

- no permission prompt during onboarding
- prompt only after user selects Connect Device Calendars
- explain read vs write request
- support denial without breaking app
- provide link/instructions to OS Settings
- do not repeatedly prompt

### 15.3 Privacy

- process device calendar data locally by default
- do not upload external event content to PLS server unless user explicitly enables cross-device encrypted sync
- when uploading, encrypt content client-side under account DEK
- server stores provider metadata needed for sync but not plaintext titles/notes

### 15.4 Platform naming

Use accurate labels:

- **Device Calendars** for EventKit data available on that Apple device
- **iCloud Calendar via CalDAV** only if future CalDAV connection is implemented

Do not market EventKit access as universal iCloud server sync.

---

## 16. Calendar token and secret management

Replace direct `JWT_SECRET` token-encryption dependency with dedicated key versioning.

Configuration:

```text
OAUTH_TOKEN_KEY_CURRENT_VERSION=2
OAUTH_TOKEN_KEY_V1=
OAUTH_TOKEN_KEY_V2=
```

Ciphertext envelope:

```text
version
algorithm
auth_tag
iv
ciphertext
```

Requirements:

- AES-256-GCM or equivalent authenticated encryption
- provider, connection ID, and user ID bound as associated data
- rotation supports decrypt-old/encrypt-new
- secrets loaded through Infisical or environment
- no token logging
- redact provider response bodies from production logs

Access tokens should remain ephemeral when possible. Refresh tokens stored encrypted.

---

## 17. Security requirements

### OAuth/OIDC

- authorization code flow
- PKCE
- state
- nonce
- exact redirect allow-list
- one-time flow records
- short expiry
- issuer validation
- audience validation
- JWKS caching with rotation
- no token in URL query/fragment returned to app
- no open redirects
- no client-supplied user ID trust

### Sessions

- short-lived access JWT
- rotating refresh tokens
- refresh reuse detection
- per-device revocation
- server-side session state
- logout revokes refresh token
- password reset/recovery may revoke all sessions
- sensitive linking requires recent authentication

### Linking

- identity uniqueness by provider subject
- no auto-link by email
- current-account binding in state
- reject cross-account identity reassignment
- audit all link/unlink attempts

### Calendar integrations

- least-privilege scopes
- read-only first
- encrypted refresh tokens
- provider disconnect/revocation endpoint
- connection-specific sync cursors
- bounded retries
- sanitize imported HTML/notes before rendering
- protect against oversized event payloads

---

## 18. Environment and deployment changes

Update `.env.example` with separated sections.

```text
# Identity — Google
GOOGLE_IDENTITY_CLIENT_ID=
GOOGLE_IDENTITY_CLIENT_SECRET=
GOOGLE_IDENTITY_REDIRECT_URI=

# Identity — Apple
APPLE_TEAM_ID=
APPLE_KEY_ID=
APPLE_PRIVATE_KEY=
APPLE_SERVICE_ID=
APPLE_BUNDLE_ID=
APPLE_REDIRECT_URI=

# Calendar — Google
GOOGLE_CALENDAR_CLIENT_ID=
GOOGLE_CALENDAR_CLIENT_SECRET=
GOOGLE_CALENDAR_REDIRECT_URI=

# Token encryption
OAUTH_TOKEN_KEY_CURRENT_VERSION=
OAUTH_TOKEN_KEY_V1=

# Session
ACCESS_TOKEN_TTL_MINUTES=15
REFRESH_TOKEN_TTL_DAYS=30
```

Coolify/reverse proxy requirements:

- stable HTTPS API origin
- stable callback URLs
- frontend deep-link handoff page
- secrets injected server-side only
- PocketBase remains private
- callback endpoints reachable publicly
- health check does not expose provider secrets
- provider configuration status returns booleans only

Development callback examples:

```text
http://localhost:3001/api/auth/oauth/google/callback
http://localhost:3001/api/auth/oauth/apple/callback
http://localhost:3001/api/oauth/google/callback       # existing calendar route
```

Production must use HTTPS.

---

## 19. Implementation phases

### Phase 0 — Baseline and tests

Branch:

```text
codex/auth-baseline-tests
```

Tasks:

- record v1.2.2 commit
- map current frontend auth state
- map PocketBase users and calendar connection collections
- add tests for password register/login/recovery
- add tests for Google Calendar connect callback
- add tests for local-only startup
- document pre-existing failures

Exit criteria:

- current behavior covered before refactor
- no production behavior change

### Phase 1 — Identity domain and migrations

Branch:

```text
codex/provider-neutral-identity-foundation
```

Tasks:

- create `auth_identities`, `auth_devices`, `auth_sessions`, `auth_refresh_tokens`, `auth_link_challenges`, `auth_events`
- build identity/session services
- migrate password login to shared session issuer
- preserve current client compatibility temporarily
- add provider registry interfaces

Exit criteria:

- password login works through new session model
- no external provider enabled yet
- tests cover refresh rotation and revocation

### Phase 2 — Google sign-in

Branch:

```text
codex/google-identity-login
```

Tasks:

- add Google OIDC adapter
- add start/callback/complete flow
- add create-vs-link screen
- add Account & Sign-in identity list
- add link/unlink rules
- keep Google Calendar scopes separate

Exit criteria:

- Google can sign into existing linked PLS account
- unknown Google identity cannot silently claim matching-email account
- user cannot unlink last method

### Phase 3 — Apple sign-in

Branch:

```text
codex/apple-identity-login
```

Tasks:

- add Apple verifier and client-secret generation
- add web flow
- add native iOS/macOS bridge
- handle relay email and first-login-only claims
- add provider revocation-ready state

Exit criteria:

- same PLS account may link Google and Apple
- loss/unlink of either leaves account intact
- provider subject, not email, resolves identity

### Phase 4 — OAuth-first enrollment and recovery hardening

Branch:

```text
codex/oauth-first-enrollment-recovery
```

Tasks:

- create client-generated DEK for provider-first user
- create recovery-key envelope
- device-bound DEK wrapping
- recovery warning and setup screen
- new-device approval/recovery flow

Exit criteria:

- OAuth-first user can recover without provider
- server cannot decrypt calendar data
- new device does not receive plaintext DEK from server

### Phase 5 — Multi-provider and multi-email account management

Branch:

```text
codex/account-linking-management
```

Tasks:

- support multiple identities per provider
- label linked accounts
- add recent-auth requirement
- duplicate-account warning
- build merge-preflight API only; do not auto-merge

Exit criteria:

- two Google identities can link to one PLS account
- one Google identity cannot link to two PLS accounts
- matching email never causes automatic merge

### Phase 6 — Google Calendar sync hardening

Branch:

```text
codex/google-calendar-sync-v2
```

Tasks:

- separate identity and calendar OAuth configuration
- support multiple Google calendar connections
- read-only scope first
- calendar selection
- incremental sync tokens
- reconnect/error states
- token-key versioning

Exit criteria:

- login provider and calendar provider can differ
- multiple Google accounts sync without collisions
- revoked calendar connection does not affect login

### Phase 7 — Apple Device Calendars

Branch:

```text
codex/apple-device-calendar-bridge
```

Tasks:

- Capacitor EventKit bridge
- Tauri/macOS EventKit bridge
- permission UX
- local read-only import
- calendar selection and per-device state
- encrypted cross-device upload toggle later

Exit criteria:

- no Apple credential stored server-side
- denial does not affect PLS use
- device calendars can be disconnected independently

### Phase 8 — Account merge

Branch:

```text
codex/account-merge
```

Tasks:

- dual-account proof
- merge preview
- client-side decrypt/remap/re-encrypt
- transaction journal
- rollback export
- session revocation
- audit events

Exit criteria:

- no silent merge
- no data overwrite
- interrupted merge resumes or rolls back safely

### Phase 9 — Passkeys and final provider independence

Branch:

```text
codex/passkeys
```

Tasks:

- WebAuthn registration/authentication
- platform and third-party passkeys
- passkey management
- recovery hierarchy

Exit criteria:

- account can remain accessible without Google, Apple, or password

---

## 20. Test matrix

### Identity

- password-only account still works
- Google-only enrollment creates recovery key
- Apple-only enrollment creates recovery key
- Google + Apple link to same user ID
- same email from unlinked providers does not merge
- Apple relay email does not create duplicate after repeat login
- provider email change does not create new account
- provider subject collision rejected
- link state replay rejected
- expired callback rejected
- wrong nonce rejected
- wrong audience rejected
- revoked identity cannot authenticate
- unlink last method rejected

### Sessions

- access token expiry
- refresh rotation
- refresh reuse revokes token family
- device revoke
- revoke all
- recovery revokes sessions as policy requires
- blocked user cannot refresh

### Local-only

- app starts without API
- no OAuth requests occur
- local data remains after account feature disabled
- export/import works
- local-to-account merge requires explicit choice

### Google Calendar

- login without Calendar permission
- Calendar connection without Google login
- multiple Google calendar accounts
- revoked refresh token
- invalid sync token/full resync
- recurring events
- deleted events
- all-day events
- timezone changes
- rate-limit backoff

### Apple Device Calendar

- permission allowed
- permission denied
- permission later revoked
- multiple device calendars
- iCloud/Google/Exchange calendars exposed by EventKit
- all-day and recurring events
- no server upload in local-only mode

### Security

- open redirect attempts
- forged state
- callback replay
- account enumeration
- raw token log scan
- CORS/deep-link allow-list
- PocketBase collection rules remain server-only

---

## 21. Documentation deliverables

Create/update:

```text
docs/OAUTH_IDENTITY_AND_CALENDAR_SYNC_PLAN.md
docs/IDENTITY_OWNERSHIP_DOCTRINE.md
docs/ACCOUNT_LINKING_AND_MERGE_POLICY.md
docs/GOOGLE_IDENTITY_SETUP.md
docs/APPLE_SIGN_IN_SETUP.md
docs/GOOGLE_CALENDAR_SYNC.md
docs/APPLE_DEVICE_CALENDARS.md
docs/RECOVERY_AND_TRUSTED_DEVICES.md
docs/SECURITY_THREAT_MODEL_AUTH.md
.env.example
README.md
docs/SELF_HOSTING.md
```

Each external setup guide must separate:

- actions Codex can implement
- actions repository owner must perform in Google/Apple consoles
- development callback values
- production callback values
- secrets that must never be committed

---

## 22. Owner actions outside code

### Google

- create/select Google Cloud project
- configure OAuth consent screen
- create identity OAuth clients
- enable Google Calendar API
- create separate or clearly separated Calendar OAuth client configuration
- register exact redirect URLs
- add test users while app remains in testing
- complete verification if requested scopes/distribution require it

### Apple

- enroll/maintain Apple Developer Program membership for production Sign in with Apple capabilities
- register bundle ID/App ID
- enable Sign in with Apple
- create Services ID
- configure domains and return URLs
- create Sign in with Apple key
- store `.p8`, Team ID, and Key ID in secret manager
- add calendar usage descriptions to Apple native app manifests for EventKit

### Hosting

- deploy stable HTTPS API URL
- configure callback routes through reverse proxy
- inject secrets through Coolify/Infisical
- back up PocketBase data volume
- verify no PocketBase public exposure

---

## 23. Recommended first working milestone

Do not attempt Apple Calendar, account merging, and OAuth-first zero-knowledge enrollment in one change.

First milestone:

1. Build provider-neutral identity/session tables.
2. Move password login to shared session service.
3. Add Google sign-in for existing accounts only.
4. Require user to sign in with password/recovery before linking Google.
5. Add Google as an additional login method.
6. Keep local-only mode untouched.
7. Keep existing Google Calendar OAuth untouched except UI wording that distinguishes **Sign in with Google** from **Connect Google Calendar**.
8. Add Apple adapter scaffold and owner setup documentation.

This milestone provides value without weakening encryption or creating unrecoverable provider-only accounts.

Second milestone:

- Apple sign-in for existing accounts.
- OAuth-first enrollment with mandatory recovery-key generation.
- trusted-device envelope model.

Third milestone:

- hardened multi-account Google Calendar sync.
- Apple Device Calendars through EventKit.

---

## 24. Definition of done

OAuth identity work is not complete until all statements are true:

- local-only use remains fully functional and skippable
- PLS user ID remains account owner
- Google and Apple subjects map to PLS user ID
- email never acts as automatic merge key
- one PLS account can hold multiple sign-in identities
- one provider identity cannot belong to multiple PLS accounts
- user cannot remove last recovery/sign-in path
- provider revocation does not delete PLS account or data
- login OAuth and calendar OAuth use separate consent/scopes
- Google Calendar may connect without Google login
- Apple login does not imply Apple Calendar permission
- Apple Device Calendar permission is optional and device-scoped
- access tokens are short-lived
- refresh tokens rotate and are revocable per device
- calendar credentials use dedicated versioned encryption keys
- all sensitive flows have tests and audit events
- documentation lists owner-only setup steps
- no provider secret exists in repository or client bundle

---

## 25. Codex handoff instruction

Use this document as architecture authority. Implement one phase per branch. Before coding each phase:

```bash
git status
git rev-parse --short HEAD
npm ci
npm run lint
npm test
npm run build
```

Then inspect current files and migrations. Preserve unrelated behavior. Add migrations rather than editing released migrations. Add tests before changing existing auth/calendar OAuth modules. Do not implement automatic account merging. Do not weaken current zero-knowledge encryption to make OAuth easier. Do not require sign-in for local-only mode.
