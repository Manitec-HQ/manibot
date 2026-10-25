# ManiBot

ManiBot (Mani) is Manitec's custom streaming chat application, built with Next.js, the Vercel AI SDK, and Groq. The project documents its public address as https://chat.manitec.pw.

This README describes repository behavior, not a guarantee that production credentials, tools, or persistence have passed a live test.

## Stack

- Next.js 15 App Router, React 19, TypeScript.
- Vercel AI SDK 5 beta and Groq provider SDK 2 beta; see package.json for pinned versions.
- Tailwind CSS 4 and shadcn/ui components.
- Firebase Admin SDK / Firestore for chat sessions.
- Shared-password cookie gate.
- pnpm; Vercel deployment.

## Models and routing

All registered models use Groq. The default is `openai/gpt-oss-20b`.

| Registered model ID | Role |
|---|---|
| `openai/gpt-oss-20b` | Default used by the chat route |
| `llama-3.3-70b-versatile` | Registered alternative |
| `llama-3.1-8b-instant` | Registered alternative |

`ai/providers.ts` is the source of truth for registrations, `MODELS`, and `defaultModel`. `app/api/chat/route.ts` uses that shared default. There is no automatic cross-model fallback. A frontend selector does not change the backend model unless the route explicitly accepts and validates that choice.

Provider availability and account access can change. Verify model IDs against Groq's catalog before changing configuration.

## Chat behavior

- Streams responses through `POST /api/chat`.
- Loads identity and behavior instructions from `prompts/manibot-system.md`.
- Appends application-supplied runtime metadata: harness, provider, configured model ID, and exposed tool names.
- Leaves the exact model revision unspecified; it should not be guessed.
- Allows up to five generation/tool steps per request.
- Uses a 60-second route duration setting.
- Applies in-memory, per-IP limits of 10 requests/minute and 60/hour. These are per-process controls, not distributed rate limiting.
- Attempts to save the conversation after generation finishes. A successful response does not by itself prove persistence succeeded.

## Tools

| Tool | Actual behavior |
|---|---|
| `kairosSearch` | Calls Kairos `/api/search`, then `/api/answer`, returning an answer and sources or an error. Requires a working Kairos service. |
| `getWeather` | Demo that returns a randomly generated temperature. Not a live weather service; do not use it as factual weather evidence. |

Tools are defined in `ai/tools.ts` and exposed by the chat route. Backend session storage is not a general-purpose database tool available to the model. No email or FleetRegistry tool is exposed by this route.

## Session persistence

`lib/manibot-session.ts` stores sessions in Firestore collection `manibot_sessions`. Each document holds its ID, title, messages, and creation/update timestamps. Message arrays retain at most the latest 200 messages; session listing returns up to 50 sessions.

Firebase Admin credentials are read by `lib/firebase-admin.ts`. If they are missing, storage helpers return without writing and emit a warning. Write failures during chat completion are logged. Test both saving and reloading history before relying on persistence.

The active session implementation uses Firestore, not Neon Postgres.

## Local setup

```bash
git clone https://github.com/Manitec-HQ/manibot.git
cd manibot
pnpm install
cp .env.example .env.local
```

The example environment file may lag implementation. Configure these variables according to the code:

```env
# Chat generation and shared-password login
GROQ_API_KEY=
GATE_PASSWORD=

# Required for Firestore session persistence
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=

# Optional override for the Kairos service
KAIROS_URL=
```

The private-key loader converts escaped `\n` sequences to newlines. Keep service-account credentials server-side; never commit them or expose them through `NEXT_PUBLIC_` variables.

If `KAIROS_URL` is unset, the search tool currently uses `https://kairos-orcin-eight.vercel.app`. This default is not a guarantee of service availability.

```bash
pnpm dev
```

Open http://localhost:3000 and use the configured gate password. Session documents are created by application writes; no Neon initialization or SQL migration is part of this session path.

## Build and deployment

```bash
pnpm exec tsc --noEmit
pnpm build
```

The repository is connected to the Vercel project `mani_bot`; pushes to `main` can trigger production builds. Configure server environment variables in the appropriate Vercel environment.

After deploying, verify a completed chat response, Kairos tool behavior, and saving/reloading a session. Check server logs for failures. A completed build alone does not verify those integrations.

The system-prompt file is read on the server. On Vercel, deploy the changed file to update the running application; editing GitHub does not hot-update an existing deployment.

## Authentication boundary

`middleware.ts` uses a shared-password cookie gate, with exclusions for login and selected assets. It is not individual-user authentication, role-based authorization, or per-user session isolation. Do not treat it as a complete multi-user security model.

## FleetRegistry

Mani can be asked to draft a JSON summary for manual review and pasting into FleetRegistry. That does not install a relay, send a heartbeat, upload files, or connect this application to FleetRegistry.

For a summary, report the application harness and configured model, leave unknown revisions blank, distinguish exposed tools from tested connections, and leave `acts` empty when requested. Never include credentials or personal conversation data.

## Project layout

```text
ai/providers.ts             Groq registrations and shared default
ai/tools.ts                 Kairos search and demo weather tool
app/api/chat/route.ts        Streaming generation and completion save
app/api/login/              Login endpoint
app/api/messages/           Message endpoints
app/api/sessions/           Session endpoints
lib/firebase-admin.ts       Server-side Firebase initialization
lib/manibot-session.ts      Firestore session helpers
prompts/manibot-system.md   Identity and behavior instructions
components/                 UI components
public/                     Static and PWA assets
middleware.ts               Shared-password gate
```

## Customization

- Identity/behavior: edit `prompts/manibot-system.md` and redeploy.
- Default model: register an exact Groq model ID in `ai/providers.ts` and update `defaultModel`.
- Tools: define a tool in `ai/tools.ts`, register it in the route, and keep runtime metadata consistent.
- Model selection: validate client selections against registered IDs before adding backend selection support.

## Contribution

A Manitec project. Coordinate changes with the repository owner. Keep credentials out of code, documentation, issues, and logs.
