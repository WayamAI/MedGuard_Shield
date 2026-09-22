# Drishti — frontend API contract requests

Endpoints the redesigned frontend needs and the backend does not yet provide.

**Scope rule:** every contract here is required by UI that was designed, cut,
or deliberately left out of the navigation during the Drishti frontend pass.
Nothing is specified speculatively. Where a capability was cut rather than
faked, this document is what brings it back.

Conventions, matching the existing API:

- Success: `200`/`201` with `{ "data": ... }`. The client unwraps `data` in
  `src/lib/apiClient.ts`, so every response must use the envelope.
- Failure: `{ "error": { "code": "...", "message": "..." } }`.
- Auth: bearer token on `Authorization`. Everything under `/api` is behind
  `requireAuth` today; keep that.
- Roles: `ADMIN`, `ANALYST`, `VIEWER`. `canWrite` = ADMIN or ANALYST.
- Timestamps: ISO 8601 strings, UTC.
- Nullability is load-bearing. `risk: null` already exists and has already
  caused one production crash; keep declaring absence explicitly rather than
  omitting fields.

Priority reflects how much of the cut UI it restores, not implementation cost.

---

## P0 — restores removed customer-facing screens

### 1. `GET /api/audit` — activity log

**Why:** `/audit` was removed. It rendered 20 fabricated log rows from a
fixture. The dashboard's "Recent Activity" feed was cut for the same reason.
This is the single highest-value contract here: an audit trail is table stakes
for a healthcare compliance product, and it is currently absent rather than
wrong.

Auth: required. VIEWER may read; consider restricting to ADMIN if entries
expose identity detail.

Query parameters:

| Param | Type | Default | Notes |
|---|---|---|---|
| `limit` | int | 50 | Max 200 |
| `cursor` | string | — | Opaque; from `nextCursor` |
| `actorId` | int | — | Filter by user |
| `action` | string | — | Repeatable |
| `resourceType` | string | — | `ASSET` \| `VENDOR` \| `RISK` \| `THREAT` \| `ACCESS_GRANT` \| `IMPORT` \| `AUTH` |
| `from`, `to` | ISO date | — | Inclusive range |

```jsonc
// 200
{
  "data": {
    "entries": [
      {
        "id": 8412,
        "occurredAt": "2026-09-22T09:31:44.000Z",
        "actor": { "id": 3, "email": "admin@meridian.org", "role": "ADMIN" },
        "action": "ASSET_UPDATED",
        "resourceType": "ASSET",
        "resourceId": 6,
        "resourceLabel": "Billing Engine DB",
        "result": "SUCCESS",
        "ip": "10.0.1.45",
        "changes": [
          { "field": "encrypted", "from": false, "to": true }
        ]
      }
    ],
    "nextCursor": "eyJpZCI6ODM5MH0"
  }
}
```

`action` values the UI expects to render: `LOGIN`, `LOGIN_FAILED`, `LOGOUT`,
`ASSET_CREATED`, `ASSET_UPDATED`, `VENDOR_CREATED`, `VENDOR_UPDATED`,
`RISK_RECOMPUTED`, `THREAT_STATUS_CHANGED`, `ACCESS_GRANT_REVOKED`,
`IMPORT_EXECUTED`. Unknown actions must render, not break — send them and the
UI will show the raw value.

`actor` is nullable for system-originated entries.

**UI consumer:** a restored `/audit` route, plus the dashboard's Recent
Activity panel.

> **Note for the backend:** writing the entries matters more than serving
> them. Every existing mutation — `POST /api/assets`, `PATCH /api/vendors/:id`,
> both recompute routes, the import commit, login — should emit an entry.

---

### 2. `PATCH /api/threats/:id` — threat status transitions

**Why:** Threats is read-only. An analyst can see an open critical threat and
has no way to mark it investigating or resolved. Workflow E in the brief ends
at "change status when backend supports it" — it does not.

Auth: `canWrite`.

```jsonc
// Request
{ "status": "INVESTIGATING", "note": "Paging the on-call DBA." }
```

- `status`: `OPEN` | `INVESTIGATING` | `RESOLVED` | `FALSE_POSITIVE`
- `note`: optional, ≤ 1000 chars, recorded in the audit trail
- Setting `RESOLVED` or `FALSE_POSITIVE` must set `resolvedAt` server-side;
  moving back to `OPEN`/`INVESTIGATING` must clear it.

Response: the updated threat, in the exact shape `GET /api/threats` returns
its array elements, so the client can drop it straight into the cache.

Errors: `400` invalid transition, `404` unknown id.

**UI consumer:** status control in the Threats detail drawer.

---

### 3. Remediation

**Why:** PHI Flow's "Remediate Now" was removed. It claimed *"Violation
resolved, encryption applied"* while writing nothing. Section 16 of the brief
specifies a full remediation object; none of it exists server-side.

#### `GET /api/remediations`

```jsonc
{
  "data": {
    "summary": { "open": 12, "inProgress": 3, "overdue": 2, "resolved": 41 },
    "items": [
      {
        "id": 77,
        "finding": "Unencrypted PHI flow between Epic EHR Core and Billing Engine DB",
        "severity": "CRITICAL",
        "resourceType": "DATA_FLOW",
        "resourceId": 14,
        "resourceLabel": "Epic EHR Core → Billing Engine DB",
        "reason": "87,100 records/day traverse this path without encryption.",
        "currentState": "Unencrypted",
        "recommendedAction": "Enable TLS 1.3 on the billing replication channel.",
        "owner": { "id": 5, "email": "m.thompson@meridian.org" },
        "status": "OPEN",
        "createdAt": "2026-09-01T10:00:00.000Z",
        "dueDate": "2026-10-01T00:00:00.000Z",
        "resolvedAt": null,
        "evidence": []
      }
    ]
  }
}
```

`status`: `OPEN` | `ASSIGNED` | `IN_PROGRESS` | `RESOLVED` | `REOPENED`.
`owner`, `dueDate`, `resolvedAt` all nullable.

#### `PATCH /api/remediations/:id`

Auth: `canWrite`. Body: any of `{ status, ownerId, dueDate, note }`.
Returns the updated item.

#### `POST /api/remediations/:id/evidence`

`multipart/form-data`, field `file`. Same size and type discipline as the CSV
import. Returns the item with `evidence[]` populated
(`{ id, filename, uploadedAt, uploadedBy, sizeBytes }`).

**Whether findings are generated server-side or created by hand is the
backend's call** — the UI only needs them to be real. Deriving them from
existing signals (unencrypted flows, BAA gaps, stale grants, unscored assets)
would let the Action Centre link straight through to a workable item.

**UI consumer:** a `/remediation` route, plus a "Remediate" action on PHI Flow
violations and the Action Centre.

---

## P1 — restores cut screens and completes designed workflows

### 4. Controls and policies

**Why:** `/policy` was removed — 8 policies and 20 controls, all fixture data.

`GET /api/controls`:

```jsonc
{
  "data": [
    {
      "id": 1,
      "code": "C-001",
      "name": "Encryption at rest",
      "frameworks": ["HIPAA", "SOC2"],
      "status": "PASSING",
      "owner": "IT Security",
      "lastTestedAt": "2026-09-22T06:00:00.000Z",
      "nextDueAt": "2026-12-22T00:00:00.000Z",
      "linkedAssetIds": [3, 6]
    }
  ]
}
```

`status`: `PASSING` | `FAILING` | `IN_REVIEW` | `NOT_TESTED`.

`GET /api/policies`:

```jsonc
{
  "data": [
    {
      "id": 1,
      "name": "PHI Data Retention Policy",
      "category": "Data Privacy",
      "status": "ACTIVE",
      "enforcementPct": 100,
      "exceptionCount": 0,
      "owner": "Legal Team",
      "lastReviewedAt": "2026-08-23T00:00:00.000Z",
      "nextReviewAt": "2026-12-01T00:00:00.000Z"
    }
  ]
}
```

`status`: `ACTIVE` | `DRAFT` | `REVIEW_NEEDED` | `ARCHIVED`.

Writes (`POST`/`PATCH`) on both, `canWrite`, to support create/edit.

**Do not implement compliance framework scores** (the old "HIPAA 96%") unless
they are genuinely computed from control results. That number was invented and
is the kind of figure an executive repeats in a board meeting.

---

### 5. `GET /api/identities` and access revocation

**Why:** `/access` lists grants but cannot act on one. Workflow D ends at "take
remediation action when backend support exists".

- `GET /api/identities` — the people and service accounts, independent of any
  one grant: `{ id, displayName, email, kind, department, role, active, mfaEnabled, grantCount, lastSeenAt }`
- `GET /api/identities/:id` — plus `grants[]`
- `DELETE /api/access/:grantId` — revoke. `canWrite`. `204`.
- `PATCH /api/access/:grantId` — `{ level }` to downgrade rather than revoke.

Revocation is the single most useful write on that screen: the headline
finding is a deactivated contractor still holding ADMIN, and the product
currently cannot do anything about it.

---

### 6. `GET /api/phi-types`

**Why:** PHI types are importable but not readable. They appear only nested
inside asset and flow records, so there is no way to see the PHI taxonomy
itself, or which assets carry a given category.

```jsonc
{
  "data": [
    { "id": 1, "name": "Clinical", "sensitivity": "HIGH",
      "assetCount": 5, "totalRecordsPerDay": 284000 }
  ]
}
```

Plus `POST`/`PATCH` for `canWrite`.

---

### 7. `GET /api/search`

**Why:** global search is currently client-side across five list endpoints
(`src/hooks/useGlobalSearch.ts`). That is real — it searches real records —
but it will not scale past a few thousand per entity, and it cannot match on
fields the list endpoints do not return.

```
GET /api/search?q=billing&limit=20&types=asset,vendor,risk,threat,identity
```

```jsonc
{
  "data": {
    "results": [
      {
        "type": "asset",
        "id": 6,
        "title": "Billing Engine DB",
        "context": "DATABASE · 87,100 PHI records",
        "band": "EXTREME",
        "status": null
      }
    ],
    "truncated": false
  }
}
```

The hook is deliberately shaped to be swapped for this without touching the
Layout component.

---

## P2 — completes the brief's remaining sections

### 8. Notifications / events

**Why:** the bell shows an honest empty state. It previously showed seven
fabricated notifications with an invented unread count.

- `GET /api/notifications?unreadOnly=true` → `{ items: [...], unreadCount: n }`
- `POST /api/notifications/:id/read`
- `POST /api/notifications/read-all`

Item: `{ id, severity, title, body, createdAt, readAt, link: { type, id } }`.

Events worth emitting: new threat detected, risk band worsened, BAA expired,
import failed, access grant flagged.

### 9. Users and organisation

For an `/admin/users` route: `GET /api/users`, `POST /api/users`,
`PATCH /api/users/:id` (role, active). ADMIN only. There is currently no
signup or invite flow at all — the three demo accounts are seeded.

### 10. Reports

`POST /api/reports` `{ type, from, to, sections[], format }` → `202` with a
job id; `GET /api/reports/:id` to poll; `GET /api/reports/:id/download`.
The old UI toasted a filename it never produced.

### 11. `DELETE` for assets and vendors

`DELETE /api/assets/:id`, `DELETE /api/vendors/:id`. ADMIN only. Should
`409` when dependent records exist, with the blocking count in the message,
rather than cascading silently.

---

## Backend changes to existing behaviour

### A. CSV template filename still says MedGuard

`GET /api/import/:entity/template` sets
`Content-Disposition: attachment; filename="medguard-assets-template.csv"`.

The client fallback is now `drishti-${entity}-template.csv`
(`src/hooks/useImport.ts`), but the server header wins, so downloads still
carry the old product name. Change the server string to `drishti-*`.

Note `src/test/import-hooks.test.tsx` asserts the client honours the *server's*
filename, so it will keep passing either way — but it currently hardcodes
`medguard-` examples and should be updated alongside.

### B. The auth cookie is named `medguard_token`

Internal identifier, not customer-visible. **Renaming it is a compatibility
break for anything holding a live session** — safe to leave. Documented here
so nobody renames it casually during a branding sweep.

### C. Consider a scoring-engine version in risk responses

Both recompute endpoints return a new score with no indication of which engine
version produced it. If the weights ever change, no client can tell a rescore
from a re-weighting. A `scoringVersion` on risk objects would make that
visible.

---

## Already available and now consumed

For the backend's awareness — these existed and the frontend had never called
them. The Drishti pass wires all of them:

| Endpoint | Now used by |
|---|---|
| `GET /api/assets/:id` | Asset detail drawer |
| `POST /api/assets` | New asset modal |
| `PATCH /api/assets/:id` | Edit asset modal |
| `GET /api/vendors/:id` | Vendor detail drawer |
| `POST /api/vendors` | New vendor modal |
| `PATCH /api/vendors/:id` | Edit vendor modal |
| `POST /api/vendors/:id/recompute` | Vendor drawer |
| `POST /api/risks/:assetId/recompute` | Asset drawer, Risk drawer |

Still unused: `GET /api/auth/me` (no session-validation path exists on the
client) and `GET /health`.
