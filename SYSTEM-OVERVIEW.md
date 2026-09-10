# ManiBot — System Overview

**Repo:** `Manitec-HQ/manibot`  
**Purpose:** Mani's mind — support, routing, session management, and knowledge-base search via Command Hub.  
**State:** Active, but currently failing due to dead model IDs (meta-llama/llama-4-scout-17b-16e-instruct, deepseek-r1-distill-llama-70b).

## Core Architecture

### 1. Chat Engine
- **Entry point:** `app/api/chat/route.ts`
- **Flow:** Receives messages → routes to Groq model → streams response.
- **Known failure:** Attempts to use decommissioned/inaccessible models:
  - `meta-llama/llama-4-scout-17b-16e-instruct` (not found/inaccessible)
  - `deepseek-r1-distill-llama-70b` (decommissioned)

### 2. Memory Layers

#### Hot Memory (Firestore)
- **Collections:**
  - `manibot_sessions/{sessionId}` — session summary, messages, lastUpdated.
  - `manibot_sessions/{sessionId}/messages/{ts}` — individual messages.
- **Writers:**
  - `lib/manibot-session.ts` — reads/writes session data.
  - `lib/firebase-admin.ts` — Firebase Admin initialization.

#### Knowledge Base (Command Hub)
- **Search:** `POST /api/chat` → Command Hub API (`COMMAND_HUB_URL`)
  - Queries `manitec-docs-public` collection.
  - Requires `MANIBOT_API_KEY` for auth.

### 3. Key Files

| File | Purpose |
|------|---------|
| `app/api/chat/route.ts` | Main chat endpoint |
| `app/api/login/route.ts` | Password-based login |
| `app/api/sessions/route.ts` | Session CRUD operations |
| `app/api/messages/route.ts` | Message retrieval |
| `lib/manibot-session.ts` | Session reads/writes |
| `lib/firebase-admin.ts` | Firebase Admin setup |

### 4. Dependencies

| Dependency | Confirmed consumers | Behavior found |
|---|---|---|
| Groq | `app/api/chat/route.ts` | Chat constructs Groq client using `GROQ_API_KEY`; currently failing due to dead model IDs |
| Firebase Admin / Firestore | `lib/manibot-session.ts`, `lib/firebase-admin.ts` | Service-account config uses project ID, client email, private key |
| Command Hub | `app/api/chat/route.ts` | `POST /api/chat` queries Command Hub for KB search; requires `COMMAND_HUB_URL` and `MANIBOT_API_KEY` |

### 5. Environment Variables

```text
GROQ_API_KEY
FIREBASE_ADMIN_PROJECT_ID
FIREBASE_ADMIN_CLIENT_EMAIL
FIREBASE_ADMIN_PRIVATE_KEY
COMMAND_HUB_URL
MANIBOT_API_KEY
GATE_PASSWORD
```

## Known Issues

1. **Dead model IDs** — chat route attempts to use decommissioned/inaccessible Groq models (confirmed 500 errors on 2026-09-07).
2. **Firebase quota exhaustion** — hot memory reads/writes can throttle or break chat (shared Firebase project with HexBot, NyxBot, Plex-Sable).
3. **No discovery audit** — unlike HexBot and NyxBot, no `docs/audits/` discovery log exists yet.

## Next Steps (for ONEsystem integration)

- [ ] Fix dead model IDs — update to current, accessible Groq models.
- [ ] Create discovery audit — map all API routes, memory writers, and dependencies (like HexBot/NyxBot logs).
- [ ] Audit Firestore usage — identify top read/write offenders.
- [ ] Consolidate memory writers into a `memoryStore` facade (Firestore + GitHub + future backends).
- [ ] Map ManiBot's role in ONEsystem — how it relates to Plex, Hex, Nyx.

---

*This is a living doc. Update as the system evolves.*
