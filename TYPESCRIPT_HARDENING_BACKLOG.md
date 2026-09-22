# TypeScript hardening backlog

`strictNullChecks` is **off**, and turning it on is deliberately out of scope
for the integration work. This records what that costs, what it would take,
and how to sequence it.

## Current configuration

`tsconfig.app.json`:

```jsonc
"strict": false,          // so strictNullChecks defaults to false
"noImplicitAny": false,
"noUnusedLocals": false,
"noUnusedParameters": false,
```

`tsconfig.json` (root) additionally sets `"strictNullChecks": false` and
`"files": []`.

## What this actually costs

Verified empirically, not assumed. A probe compiled under each setting:

```ts
type V = { risk: { score: number } | null };
const v: V = { risk: null };
v.risk.score;
```

| Setting | Result |
|---|---|
| Repo's effective config | **compiles silently** |
| `--strictNullChecks` | `error TS18047: 'v.risk' is possibly 'null'` |

**Consequence:** every `| null` in `src/lib/apiTypes.ts` is documentation the
compiler will not enforce. The types are correct and describe the API
accurately; nothing checks that read sites honour them.

This is not hypothetical. It has already shipped a production crash:
`ApiVendor.risk` was declared non-nullable while the API returned `null` for
any unscored vendor, and the first CSV-imported vendor took the whole Vendor
Risk page down with `Cannot read properties of null (reading 'score')`. The
fix added `| null` to the type — which the compiler ignores — plus runtime
guards and four tests, which are what actually prevent recurrence.

## Known nullable fields

Every one of these is `| null` in the wire types and unenforced today.

| Type | Field | Null when |
|---|---|---|
| `ApiAsset` / `ApiVendor` | `risk` | never scored — **every CSV-imported record** |
| `ApiAsset` / `ApiVendor` | `lastAssessedAt`, `archivedAt` | never assessed / not archived |
| `ApiAccessGrant` | `lastUsedAt`, `lastReviewedAt`, `revokedAt`, `daysSinceUse` | never used / reviewed / revoked |
| `ApiAccessGrant` | `identityEmail` | service accounts |
| `ApiThreat` | `resolvedAt` | still open |
| `ApiRemediation` | `owner`, `subject`, `dueAt`, `resolvedAt` | unassigned / unlinked / open |
| `ApiAuditEntry` | `actor` | **system-originated entries** |
| `ApiAuditEntry` | `entityType`, `entityId`, `metadata`, `ip` | not entity-scoped |
| `ApiControl` | `owner`, `frameworkRef`, `lastReviewedAt`, `archivedAt` | not recorded |
| `ApiPolicy` | `owner`, `evidenceRef`, `reviewDueAt`, `archivedAt` | not recorded |
| `ApiIdentity` | `email`, `department`, `role`, `archivedAt` | service accounts / not recorded |

`ApiAuditEntry.actor` is the one most likely to bite next: system entries are
common, the field is read in two places on the Audit page, and both currently
guard by hand.

## Estimated impact

Not measured by running the compiler in strict mode — doing that reliably
means fixing the errors it surfaces, which is the task itself. The estimate
below is from the field inventory above.

| Area | Expected errors | Notes |
|---|---|---|
| `src/lib/apiTypes.ts` | 0 | already correct |
| `src/hooks/**` | low | mostly pass-through generics |
| `src/pages/**` | **highest** | every `?.` that is currently optional becomes mandatory; every `!` gets audited |
| `src/components/DataTable.tsx` | medium | `sortValue` returns `string \| number \| null` by design |
| `src/test/**` | medium | fixtures omit nullable fields |
| Vendored `src/components/ui/**` | **unknown, possibly large** | 49 shadcn files, 3 reachable |

## Recommended migration strategy

Staged, so no single change is unreviewable.

1. **Exclude the vendored shadcn directory first.** 46 of its 49 files are
   unreachable. Delete the unreachable ones or exclude `src/components/ui/**`
   from the strict pass; do not spend the budget on code nobody imports.
2. **Turn on `strictNullChecks` alone**, not full `strict`. `noImplicitAny`
   and `strictFunctionTypes` are separate problems with separate error
   counts; bundling them makes the diff impossible to review.
3. **Fix `src/lib` and `src/hooks` first.** They are the narrowest layer and
   the one everything else depends on, so fixes there remove errors downstream.
4. **Then pages, one per commit.** Each is independently reviewable and
   independently revertible.
5. **Tests last.** Fixtures will need nullable fields filled in; that is
   mechanical and best done once the shape has stopped moving.
6. **Then `noImplicitAny`** as a separate exercise.

Budget it as its own piece of work with its own review, not as a rider on a
feature branch.

## Related: the typecheck command is a no-op

`npx tsc --noEmit` with no `-p` checks **zero files**, because the root
`tsconfig.json` sets `"files": []`. It always exits 0.

```
$ npx tsc --noEmit --listFilesOnly | wc -l
0
$ npx tsc --noEmit -p tsconfig.app.json --listFilesOnly | grep -v node_modules | wc -l
118
```

CI uses the correct `-p` form. Anyone running the bare command locally gets a
false green. Worth adding a `typecheck` script to `package.json` that points at
the right project — a one-line change that removes a trap.
