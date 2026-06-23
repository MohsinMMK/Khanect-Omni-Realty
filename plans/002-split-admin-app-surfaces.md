# Plan 002: Split the admin app into maintainable screen modules

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 0804202..HEAD -- apps/web/src/App.tsx apps/web/src`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: `plans/001-restore-web-verification-baseline.md`
- **Category**: tech-debt
- **Planned at**: commit `0804202`, 2026-06-22

## Why this matters

`apps/web/src/App.tsx` is currently the router, layout shell, API client, dashboard, content desk, RAG view, chat lab, and shared display library in one 929-line file. That makes production UI work slow and fragile because a content desk change requires reviewing unrelated chat and RAG code. Splitting the file into focused modules will make subsequent shadcn refactors easier and safer.

## Current state

- `apps/web/src/App.tsx` owns all top-level app concerns:

```tsx
// apps/web/src/App.tsx:64-139
export function App() {
  const [page, setPage] = useState<Page>(() => pageFromPath(window.location.pathname))
  ...
  return (
    <div className="flex h-svh flex-col overflow-hidden bg-background text-foreground">
      ...
      <main className="min-h-0 overflow-y-auto p-4 sm:p-6 lg:overflow-hidden">
        {page === "admin" && <Dashboard goTo={navigate} />}
        {page === "content" && <ContentView goTo={navigate} />}
        {page === "rag" && <RagView goTo={navigate} />}
        {page === "chat-lab" && <ChatLabView />}
      </main>
    </div>
  )
}
```

- `ContentView` starts at `apps/web/src/App.tsx:267`.
- `RagView` starts at `apps/web/src/App.tsx:498`.
- `ChatLabView` starts at `apps/web/src/App.tsx:628`.
- Shared cards/helpers and the API client live near the bottom:

```tsx
// apps/web/src/App.tsx:777-929
function AnswerPanel(...)
function HeroCard(...)
function PipelineCard(...)
function ChecklistCard(...)
function Stat(...)
function SourceCard(...)
function EmptyState(...)
function AlertCallout(...)
function StatusBadge(...)
async function api<T>(...)
function pageFromPath(...)
```

- Project convention: UI imports use the shadcn monorepo alias from `apps/web/components.json:13-18`, especially `@workspace/ui/components`.
- TypeScript is enabled and React Server Components are not used (`apps/web/components.json:3-5` has `style: "base-luma"`, `rsc: false`, `tsx: true`).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck web | `pnpm --filter web typecheck` | exit 0, no errors |
| Lint web | `pnpm --filter web lint` | exit 0, no errors |
| Build web | `pnpm --filter web build` | exit 0 |

## Scope

**In scope**:
- `apps/web/src/App.tsx`
- Create `apps/web/src/lib/api.ts`
- Create `apps/web/src/lib/routes.ts`
- Create `apps/web/src/features/admin/types.ts`
- Create `apps/web/src/features/admin/constants.ts`
- Create `apps/web/src/features/admin/components.tsx`
- Create `apps/web/src/features/admin/dashboard-view.tsx`
- Create `apps/web/src/features/admin/content-view.tsx`
- Create `apps/web/src/features/admin/rag-view.tsx`
- Create `apps/web/src/features/admin/chat-lab-view.tsx`

**Out of scope**:
- Any visual redesign beyond preserving the current UI.
- Any shadcn component installation.
- Any backend/API changes.
- Any behavior change to content publishing, RAG search, or chat lab flows.

## Git workflow

- Branch suggestion: `codex/002-split-admin-app-surfaces`
- Commit message suggestion: `refactor: split admin web surfaces`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Extract shared types and constants

Create `apps/web/src/features/admin/types.ts` and move these types from `App.tsx`: `Page`, `ChannelPreview`, `ContentItem`, `RagDocument`, `RagChunk`, `Source`, `ChatSession`, `ChatMessage`, `ChatAnswer`, `AdminMe`.

Create `apps/web/src/features/admin/constants.ts` and move `contentTypeOptions`, `channelOptions`, `sampleContent`, `samplePrompts`, and `navItems`.

Keep lucide icon imports in `constants.ts` only if needed by `navItems`. The icon library must remain `lucide-react`, matching `apps/web/components.json:12`.

Update `App.tsx` imports.

**Verify**: `pnpm --filter web typecheck` -> exit 0.

### Step 2: Extract API and route helpers

Create `apps/web/src/lib/api.ts` containing `api`, `tryParseJson`, `getApiErrorMessage`, and `getErrorMessage`.

Create `apps/web/src/lib/routes.ts` containing `pageFromPath`.

Keep `apiBase` inside `api.ts`:

```tsx
const apiBase = import.meta.env.VITE_API_BASE_URL ?? "/api/v1"
```

Export only the functions needed by screen modules.

**Verify**: `pnpm --filter web typecheck` -> exit 0.

### Step 3: Extract shared admin display components

Create `apps/web/src/features/admin/components.tsx` and move `AnswerPanel`, `HeroCard`, `PipelineCard`, `ChecklistCard`, `Stat`, `SourceCard`, `EmptyState`, `AlertCallout`, and `StatusBadge`.

Keep shadcn component imports from `@workspace/ui/components/*`. Do not rewrite these as custom markup.

**Verify**: `pnpm --filter web typecheck` -> exit 0.

### Step 4: Extract each screen

Move `Dashboard` to `dashboard-view.tsx`, `ContentView` to `content-view.tsx`, `RagView` to `rag-view.tsx`, and `ChatLabView` to `chat-lab-view.tsx`.

Preserve exported component names or rename exports consistently:

```tsx
export function DashboardView(...)
export function ContentView(...)
export function RagView(...)
export function ChatLabView()
```

Keep `App.tsx` as the shell, navigation, and route selection only.

**Verify**: `pnpm --filter web typecheck` -> exit 0.

### Step 5: Verify no behavior changed

Run the full web verification gate.

**Verify**:
- `pnpm --filter web lint` -> exit 0.
- `pnpm --filter web typecheck` -> exit 0.
- `pnpm --filter web build` -> exit 0.

## Test plan

No behavior tests are required in this plan because it is a file split. The verification is TypeScript, lint, and build. If the executor has browser automation available, do a smoke check of `/admin`, `/admin/content`, `/admin/rag`, and `/admin/chat-lab` after build, but do not make it a blocking requirement unless the local dev server is already running.

## Done criteria

- [ ] `App.tsx` is only the app shell, nav, profile button, and route selection.
- [ ] Each admin surface has its own file under `apps/web/src/features/admin/`.
- [ ] Shared API helpers live under `apps/web/src/lib/`.
- [ ] Shared admin display components live in `features/admin/components.tsx`.
- [ ] `pnpm --filter web lint` exits 0.
- [ ] `pnpm --filter web typecheck` exits 0.
- [ ] `pnpm --filter web build` exits 0.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back if:
- Extracting a screen changes the public API request/response shape.
- TypeScript errors require changing backend types or API routes.
- You need to touch files outside the in-scope list.
- A copied component begins diverging visually from its original code.

## Maintenance notes

This plan intentionally does not redesign the product. It prepares the codebase for plan 003 by giving the content approval desk its own module.
