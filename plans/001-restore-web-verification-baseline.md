# Plan 001: Restore the web verification baseline

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 0804202..HEAD -- apps/web/src/App.tsx apps/web/package.json package.json`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `0804202`, 2026-06-22

## Why this matters

The web package currently typechecks but does not lint cleanly. That means later UI refactors cannot rely on the repo's normal quality gate, and small unused-code regressions can hide among larger design changes. This plan restores a clean baseline before heavier product UI work starts.

## Current state

- `apps/web/package.json` defines `lint`, `typecheck`, and `build` scripts:

```json
// apps/web/package.json:6-12
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "lint": "eslint",
  "format": "prettier --write \"**/*.{ts,tsx}\"",
  "typecheck": "tsc --noEmit",
  "preview": "vite preview"
}
```

- `apps/web/src/App.tsx` imports an unused component:

```tsx
// apps/web/src/App.tsx:7
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
```

- `apps/web/src/App.tsx` defines an unused helper:

```tsx
// apps/web/src/App.tsx:916-918
function labelForContentType(value: string) {
  return contentTypeOptions.find((option) => option.value === value)?.label ?? value
}
```

- Recon verified `pnpm --filter web typecheck` exits 0, while `pnpm --filter web lint` fails with these two unused symbol errors.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck web | `pnpm --filter web typecheck` | exit 0, no errors |
| Lint web | `pnpm --filter web lint` | exit 0, no errors |
| Build web | `pnpm --filter web build` | exit 0 |

## Scope

**In scope**:
- `apps/web/src/App.tsx`

**Out of scope**:
- Any UI redesign.
- Any package install.
- Any change to API calls, app routes, or component behavior.

## Git workflow

- Branch suggestion: `codex/001-web-verification-baseline`
- Commit message style: conventional commit, matching existing history such as `feat: add Phase 1A admin RAG chat lab`.
- Do not push or open a PR unless the operator instructs it.

## Steps

### Step 1: Remove unused symbols

Remove `FieldDescription` from the `@workspace/ui/components/field` import in `apps/web/src/App.tsx`.

Remove the unused `labelForContentType` function from `apps/web/src/App.tsx`.

**Verify**: `pnpm --filter web lint` -> exit 0 with no ESLint errors.

### Step 2: Run the web verification gate

Run the commands below after the lint cleanup.

**Verify**:
- `pnpm --filter web typecheck` -> exit 0.
- `pnpm --filter web build` -> exit 0.

## Test plan

No new tests are needed. This is a mechanical lint cleanup. The regression check is the existing web lint/typecheck/build gate.

## Done criteria

- [ ] `pnpm --filter web lint` exits 0.
- [ ] `pnpm --filter web typecheck` exits 0.
- [ ] `pnpm --filter web build` exits 0.
- [ ] Only `apps/web/src/App.tsx` is modified.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back if:
- The cited import or helper no longer exists.
- Lint still fails after removing those two unused symbols.
- Fixing lint appears to require touching files outside `apps/web/src/App.tsx`.

## Maintenance notes

Keep this plan separate from the larger UI refactors. A green baseline makes the later shadcn and product UX plans safer to review.
