# Plan 004: Reconcile Select and Drawer behavior with shadcn Base UI patterns

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 0804202..HEAD -- apps/web/src packages/ui/src/components/select.tsx packages/ui/src/components/drawer.tsx`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on mismatch, treat it as a STOP condition.

## Status

- **Execution status**: DONE (2026-06-23; `select.tsx` restored to shadcn registry; drawers use vaul `direction` on root)
- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: `plans/001-restore-web-verification-baseline.md`
- **Category**: migration
- **Planned at**: commit `0804202`, 2026-06-22

## Why this matters

The content editor Select currently works, but the fix introduced controlled open state, manual pointer handling, and global wrapper changes that drift from shadcn's generated Base UI `select.tsx`. That makes future shadcn updates risky. This plan isolates the actual overlay conflict and either returns the wrapper to registry shape or documents a minimal local adapter.

## Current state

- shadcn project context from recon:
  - framework: Vite
  - style: `base-luma`
  - base: `base`
  - icon library: `lucide`
  - UI alias: `@workspace/ui/components`
  - UI path: `packages/ui/src/components`

- The app controls Select open state manually:

```tsx
// apps/web/src/App.tsx:438-460
<Select
  items={contentTypeOptions}
  modal={false}
  open={contentTypeSelectOpen}
  value={form.contentType}
  onOpenChange={setContentTypeSelectOpen}
  onValueChange={(value) => {
    setForm((current) => ({ ...current, contentType: String(value ?? current.contentType) }))
    setContentTypeSelectOpen(false)
  }}
>
  <SelectTrigger
    className="w-full"
    onKeyDown={(event) => {
      if (["ArrowDown", "Enter", " "].includes(event.key)) {
        event.preventDefault()
        setContentTypeSelectOpen((open) => !open)
      }
    }}
    onPointerDown={(event) => {
      event.preventDefault()
      setContentTypeSelectOpen((open) => !open)
    }}
  >
```

- The Select wrapper has non-registry pointer/z-index changes:

```tsx
// packages/ui/src/components/select.tsx:79-91
className="pointer-events-auto isolate z-70"
...
"dark pointer-events-auto isolate z-70 ..."
...
<SelectPrimitive.List className="pointer-events-auto">{children}</SelectPrimitive.List>
```

- `pnpm dlx shadcn@latest add select --diff packages/ui/src/components/select.tsx -c apps/web` showed only those pointer/z-index changes and item pointer changes differ from upstream.

- Drawer itself is registry-identical according to `pnpm dlx shadcn@latest add drawer --dry-run -c apps/web`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| shadcn info | `pnpm dlx shadcn@latest info --json -c apps/web` | JSON shows `base: "base"` |
| Select diff | `pnpm dlx shadcn@latest add select --diff packages/ui/src/components/select.tsx -c apps/web` | diff is understood before editing |
| Drawer diff | `pnpm dlx shadcn@latest add drawer --dry-run -c apps/web` | drawer is identical or diff is understood |
| Typecheck web | `pnpm --filter web typecheck` | exit 0 |
| Lint web | `pnpm --filter web lint` | exit 0 |
| Build web | `pnpm --filter web build` | exit 0 |

## Suggested executor toolkit

- Use the local `shadcn` skill if available.
- Read `/.agents/skills/shadcn/rules/base-vs-radix.md`, especially the Base UI Select section.
- Run `pnpm dlx shadcn@latest docs select drawer` before changing wrappers.

## Scope

**In scope**:
- `packages/ui/src/components/select.tsx`
- `packages/ui/src/components/drawer.tsx` only if a registry-compatible prop or overlay fix is required.
- The content editor Select usage in `apps/web/src/features/admin/content-view.tsx` after plan 002, or `apps/web/src/App.tsx` if plan 002 has not been executed.

**Out of scope**:
- Changing from `Drawer` to another overlay without operator approval.
- Adding non-shadcn select libraries.
- Rewriting content editor form behavior.
- Broad theme/preset changes.

## Git workflow

- Branch suggestion: `codex/004-select-drawer-shadcn-drift`
- Commit message suggestion: `fix: reconcile content select overlay behavior`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Establish the failing and passing cases

Before editing, document current behavior in a short note in your PR/commit summary:
- Select opens inside the right drawer.
- Selecting `Area guide` changes visible label and value.
- No console errors in normal browser use.

If browser automation is available, verify current behavior before edits. If not, proceed with code-level verification and run browser smoke at the end.

**Verify**: `pnpm --filter web typecheck` -> exit 0.

### Step 2: Try removing app-level trigger overrides first

In the content editor Select usage, remove the manual `open`, `onOpenChange`, `onKeyDown`, and `onPointerDown` handling.

Keep Base UI-required `items={contentTypeOptions}` and controlled `value`.

Target shape:

```tsx
<Select
  items={contentTypeOptions}
  modal={false}
  value={form.contentType}
  onValueChange={(value) => {
    setForm((current) => ({ ...current, contentType: String(value ?? current.contentType) }))
  }}
>
  <SelectTrigger className="w-full">
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectGroup>
      ...
    </SelectGroup>
  </SelectContent>
</Select>
```

Do not remove `modal={false}` unless browser testing proves it is unnecessary.

**Verify**:
- `pnpm --filter web typecheck` -> exit 0.
- Browser smoke if available: opening Select and clicking `Area guide` works.

### Step 3: Minimize wrapper drift

Run:

```bash
pnpm dlx shadcn@latest add select --diff packages/ui/src/components/select.tsx -c apps/web
```

If Step 2 works with the registry wrapper, revert `packages/ui/src/components/select.tsx` to match shadcn output using the CLI diff as the guide. Do not use `--overwrite` unless the operator explicitly approves; apply the small patch manually.

If Step 2 only works with pointer events, keep the smallest possible wrapper change:
- Prefer `className` override at the usage site if feasible.
- If wrapper-level change is required, add a short comment explaining the Drawer/Select portal interaction.
- Avoid manual `z-70` unless testing proves `z-50` fails.

**Verify**:
- `pnpm --filter web lint` -> exit 0.
- `pnpm --filter web typecheck` -> exit 0.

### Step 4: Confirm Drawer remains registry-compatible

Run:

```bash
pnpm dlx shadcn@latest add drawer --dry-run -c apps/web
```

If it reports `skip (identical)`, do not edit `drawer.tsx`.

If it reports drift, review the diff and only keep changes required for the approved right-side drawer behavior.

**Verify**: `pnpm --filter web build` -> exit 0.

## Test plan

Browser smoke test when available:
1. Open `/admin/content`.
2. Click `New draft`.
3. Open `Information type`.
4. Click `Area guide`.
5. Confirm visible trigger text is `Area guide`.
6. Confirm no console errors.
7. Click Cancel and confirm drawer closes.

If no browser automation is available, state that the browser smoke was not run and rely on lint/typecheck/build.

## Done criteria

- [ ] Select usage keeps Base UI `items={contentTypeOptions}`.
- [ ] Manual trigger event overrides are removed unless documented as necessary.
- [ ] `packages/ui/src/components/select.tsx` is either back to registry shape or has a minimal documented divergence.
- [ ] `drawer.tsx` remains registry-identical unless a necessary divergence is documented.
- [ ] `pnpm --filter web lint` exits 0.
- [ ] `pnpm --filter web typecheck` exits 0.
- [ ] `pnpm --filter web build` exits 0.
- [ ] Browser smoke result is recorded in the executor summary.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back if:
- Removing manual trigger handlers breaks Select interaction and you cannot reproduce a smaller fix.
- Fixing Select requires editing unrelated shadcn primitives.
- The operator requests a switch from Drawer to Sheet; that belongs in plan 003 or a separate design decision.
- shadcn CLI wants broad overwrites beyond `select.tsx` and `drawer.tsx`.

## Maintenance notes

The long-term goal is to keep `packages/ui/src/components` close to shadcn registry output. Divergence is acceptable only when there is a tested project-specific interaction that cannot be solved at the usage layer.
