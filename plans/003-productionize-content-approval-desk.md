# Plan 003: Productionize the content approval desk with shadcn app primitives

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 0804202..HEAD -- apps/web/src packages/ui/src/components apps/web/components.json packages/ui/package.json pnpm-lock.yaml`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: `plans/001-restore-web-verification-baseline.md`, `plans/002-split-admin-app-surfaces.md`
- **Category**: direction
- **Planned at**: commit `0804202`, 2026-06-22
- **DONE** (2026-06-23): `ContentView` in `features/admin/content-view.tsx` uses Table + Skeleton loading, Sonner toasts for success flows, and keeps Drawer editors/details with `direction="right"`. `<Toaster />` added in `main.tsx`.

## Why this matters

The current content page is much simpler than before, but it still presents production content inventory as repeated cards. A new admin user needs scanning, sorting, status clarity, quick edit access, and feedback after actions. shadcn already provides the right primitives for this: `Table`, `Sheet` or `Drawer`, `Skeleton`, `Sonner`, and `Tooltip`.

## Current state

- The project is shadcn `base-luma`, Base UI, Tailwind v4, lucide:

```json
// apps/web/components.json:3-18
"style": "base-luma",
"rsc": false,
"tsx": true,
"iconLibrary": "lucide",
"aliases": {
  "utils": "@workspace/ui/lib/utils",
  "ui": "@workspace/ui/components"
}
```

- The content approval desk currently renders cards for every item:

```tsx
// apps/web/src/App.tsx:398-424
<CardContent className="min-h-0 overflow-y-auto">
  <div className="grid gap-3 xl:grid-cols-2">
    ...
    {filteredItems.map((item) => (
      <Card key={item.id} size="sm" className="shadow-none">
        <CardHeader>
          <CardTitle className="line-clamp-2">{item.title}</CardTitle>
          <CardDescription className="line-clamp-2">{item.body}</CardDescription>
          <CardAction>
            <StatusBadge status={item.status} />
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => edit(item)}>Edit</Button>
          ...
        </CardFooter>
      </Card>
    ))}
  </div>
</CardContent>
```

- The action feedback is persistent inline alert state:

```tsx
// apps/web/src/App.tsx:271-272 and 395-396
const [message, setMessage] = useState("")
const [error, setError] = useState("")
...
{message && <AlertCallout title="Done" description={message} />}
{error && <AlertCallout title="Request failed" description={error} variant="destructive" />}
```

- shadcn dry run from recon showed these production primitives are not installed yet and can be added through the CLI:

```text
pnpm dlx shadcn@latest add sidebar table sheet tooltip sonner skeleton --dry-run -c apps/web
Files: table.tsx, tooltip.tsx, sonner.tsx, skeleton.tsx, sheet.tsx, sidebar.tsx, src/hooks/use-mobile.ts
Dependencies: sonner, next-themes
```

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Inspect shadcn project | `pnpm dlx shadcn@latest info --json -c apps/web` | JSON shows `style: "base-luma"`, `base: "base"` |
| Preview components | `pnpm dlx shadcn@latest add table sheet tooltip sonner skeleton --dry-run -c apps/web` | dry-run only, no source changes |
| Add components | `pnpm dlx shadcn@latest add table sheet tooltip sonner skeleton -c apps/web` | exit 0; files added under `packages/ui/src/components` |
| Typecheck web | `pnpm --filter web typecheck` | exit 0 |
| Lint web | `pnpm --filter web lint` | exit 0 |
| Build web | `pnpm --filter web build` | exit 0 |

## Suggested executor toolkit

- Use the local `shadcn` skill if available.
- Before using a new component, run `pnpm dlx shadcn@latest docs table sheet tooltip sonner skeleton` and review the returned docs URLs.
- Use project aliases from `apps/web/components.json`; do not import from `@/components/ui`.

## Scope

**In scope**:
- `apps/web/src/features/admin/content-view.tsx` if plan 002 is complete.
- If plan 002 is not complete but the operator explicitly tells you to continue anyway, use `apps/web/src/App.tsx` only for the content view portion.
- `apps/web/src/App.tsx` only for adding `<Toaster />` if the app shell still owns it.
- New shadcn files added by CLI under `packages/ui/src/components`.
- `apps/web/src/hooks/use-mobile.ts` if the CLI creates it.
- `packages/ui/package.json` and `pnpm-lock.yaml` if new component deps are added.

**Out of scope**:
- Backend/API changes.
- RAG and chat lab redesigns.
- Changing the data model.
- Adding third-party registry blocks without an explicit registry.

## Git workflow

- Branch suggestion: `codex/003-production-content-desk`
- Commit message suggestion: `feat: productionize content approval desk`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Add only the needed shadcn primitives

Run:

```bash
pnpm dlx shadcn@latest add table sheet tooltip sonner skeleton -c apps/web
```

Do not install `sidebar` in this plan; reserve it for a separate app-shell plan if needed. The content desk needs `Table`, `Sheet` or `Drawer`, `Tooltip`, `Sonner`, and `Skeleton`.

After adding, read every new file under `packages/ui/src/components` and verify imports use `@workspace/ui`.

**Verify**: `pnpm --filter web typecheck` -> exit 0.

### Step 2: Replace content cards with a table

In the content view module, replace the repeated content-item card grid with a `Table`.

Target table columns:
- Title: title plus a muted one-line excerpt.
- Type: label from `contentTypeOptions`.
- Status: existing `StatusBadge`.
- Updated/slug: show slug if no timestamp exists.
- Actions: Edit, Publish, Test.

Keep the existing filter controls:

```tsx
// current filter controls
<Input placeholder="Search content" value={query} onChange={(event) => setQuery(event.target.value)} />
<ToggleGroup value={[statusFilter]} ...>
```

Use `Tooltip` only for icon-only or compact actions. If action buttons keep text labels, tooltip is optional.

**Verify**: `pnpm --filter web typecheck` -> exit 0.

### Step 3: Use skeletons for initial loading

Add an explicit loading state to the content view:

```tsx
const [loading, setLoading] = useState(true)
```

Set `loading` false in the initial fetch `finally`.

While loading, show a small table skeleton using `Skeleton`, not custom pulse divs. Keep the content desk card height stable.

**Verify**: `pnpm --filter web typecheck` -> exit 0.

### Step 4: Move success feedback to Sonner

Add `<Toaster />` at the app shell level if absent.

Replace `setMessage(...)` success flows in content save and publish with:

```tsx
toast.success("Draft saved")
toast.success("Published")
```

Keep destructive request failures visible either as inline `Alert` or `toast.error`, but do not show both for the same failure.

Remove content-view `message` state if it is no longer needed.

**Verify**: `pnpm --filter web lint` -> exit 0.

### Step 5: Re-evaluate overlay choice for the editor

The previous user explicitly asked for a drawer. Keep the right-side `Drawer` unless the operator approves switching to `Sheet`.

If keeping `Drawer`, preserve:
- `DrawerTitle`
- `DrawerDescription`
- right-side direction
- content overlay behavior

Do not reintroduce the form as always-visible first-glance content.

**Verify**: manual review of `/admin/content` in browser if available; otherwise `pnpm --filter web build` -> exit 0.

## Test plan

No automated UI test harness exists yet. Use the existing verification commands plus a browser smoke check when possible:

1. Open `/admin/content`.
2. Confirm the first glance shows content approval desk and table, not the edit form.
3. Search filters table rows.
4. Toggle All/Drafts/Published.
5. Click New draft and confirm the editor opens.
6. Save disabled until title and approved answer are present.
7. Publish/Test actions still call existing handlers.

## Done criteria

- [ ] `Table` is used for content inventory.
- [ ] Initial load uses `Skeleton`.
- [ ] Save/publish success uses `Sonner` toast.
- [ ] New/edit form remains hidden on first glance and opens in the approved overlay.
- [ ] No custom raw color utilities are introduced.
- [ ] `pnpm --filter web lint` exits 0.
- [ ] `pnpm --filter web typecheck` exits 0.
- [ ] `pnpm --filter web build` exits 0.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back if:
- shadcn CLI wants to overwrite locally modified components and the diff is not clearly safe.
- New components import from `@/components/ui` instead of `@workspace/ui/components`.
- The table refactor requires backend pagination, sorting, or new API fields.
- The operator rejects switching from `Drawer` to `Sheet`.

## Maintenance notes

This plan should make the content desk feel more like a production admin app. It intentionally does not solve app-wide navigation; that can be a later `Sidebar` plan.
