# Drishti — Customer FAQ

Answers describe what Drishti does today. Where something is not built, the
answer says so rather than deflecting.

---

### What is Drishti?

Drishti is a healthcare PHI risk intelligence platform. It keeps a live
picture of where patient data lives, how it moves, who can reach it and which
vendors are exposed — and it keeps a record of what was found and what was
done about it.

### Who is it for?

Security leadership, privacy and compliance teams, security operations,
vendor management and internal audit. In practice the same screens serve all
of them, which is part of the point: today those teams hold different pieces
of the same picture.

### What problem does it solve?

Most healthcare organisations can list the systems they run. Very few can say
where PHI actually sits, how it moves between those systems, who still has
access they should not, and which vendor agreements have lapsed.

That information exists, scattered across spreadsheets, ticket queues, vendor
folders and people's memories. Reassembling it by hand takes weeks, and it is
stale by the time it is finished. Drishti keeps it in one place and keeps it
current.

### How does Drishti identify risk?

Each system and each vendor is scored on four factors:

```
score = likelihood × impact × exposure × control gap
```

Likelihood and impact are your assessment. **Exposure** and **control gap**
are derived by the platform from facts already recorded — whether the system
is encrypted, whether multi-factor is enforced, how much PHI it holds, which
controls are applied to it, whether a vendor's agreement is valid.

Two things follow. The score cannot drift away from the estate it describes,
because it is computed from that estate. And it is reproducible: the same
facts produce the same score, every time, for anyone who asks.

The score recomputes on its own whenever something that feeds it changes, and
both the change and the recompute are recorded in the audit trail.

### What data does it analyse?

Only what you record: your systems, the categories of PHI they hold, the flows
between them, your vendors, your identities and access grants, your controls
and policies.

**Drishti does not read patient records.** It works with metadata about the
estate — a system's name, what category of data it holds, how much, whether it
is encrypted. It never ingests the PHI itself.

### How does vendor risk work?

Each vendor is recorded with its business associate agreement status —
signed, pending, expired or missing — the systems it can reach, the volume of
PHI those systems hold, and when it was last assessed.

Vendors are scored by the **same engine** as your own systems and share the
same history, so vendor risk and internal risk sit on one comparable scale
rather than in two separate conversations.

A vendor processing PHI without a valid agreement is surfaced as a gap in its
own right — before any question of whether data has been lost.

### How does access risk work?

Every grant is checked against several conditions and flagged for each one it
meets: unused past the staleness threshold, never used at all, a level higher
than the role needs, missing multi-factor, or held by an identity that is no
longer active.

The grants that matter most are usually the ones nobody remembers — a
contractor who left with administrator rights intact, a service account
created for a migration that finished two years ago. Those are exactly what
the flags surface.

You can reduce a grant's level, revoke it, or mark it reviewed. Marking it
reviewed records that a human looked; it deliberately does not change who can
reach what, because those are different acts and an auditor will want them
recorded differently.

### How are findings tracked?

A finding — Drishti calls it a remediation — carries a title, what is wrong, a
recommendation, a severity, an owner, a due date, and the asset, vendor,
threat or control it points at. It moves through a lifecycle the platform
enforces: open, in progress, resolved, risk accepted, reopened.

Findings can be raised manually or from a risk, threat, access or vendor
finding, and the source is recorded.

### How does remediation work — does Drishti fix anything?

No, and that is deliberate.

Closing a finding records who decided what and when. It does **not** change
the asset, control or threat it points at. Closing a finding is a claim about
people, not a fix — if the estate needs to change, the estate has to be
changed, and Drishti will show you at the next recompute whether it actually
was.

The lifecycle also keeps **resolved** and **risk accepted** apart in every
count. "We fixed it" and "we decided to live with it" are different
statements, and collapsing them is exactly the kind of difference an auditor
exists to find.

### How is activity audited?

Every write records an event: what action, by whom, against which record, with
what result, and from which address.

The trail is **read-only**. There is no way to add, edit or delete an entry —
not through the interface, not through the API, and not for administrators.
The only writer is the platform's own audit service. Administrators can read
it; nobody can alter it.

Metadata is sanitised before it is stored: credentials and patient
identifiers are stripped, so the trail records *what changed* without becoming
a second place PHI lives.

### How does authentication work?

Sessions use two credentials. A short-lived access token, valid for one hour,
held only in memory in the browser tab and never written to storage. And a
long-lived refresh credential in a cookie that JavaScript cannot read.

That split means a page reload can restore your session without any
credential ever sitting somewhere a script could reach it.

Refresh tokens rotate on every use, and presenting an already-rotated token is
treated as theft: every session for that account is revoked.

Login is rate limited, counting failures rather than successes, so someone
guessing exhausts their budget quickly while a legitimate user signing in
repeatedly is never locked out.

### How is customer data isolated?

Every record carries an organisation, and every query is scoped to the
organisation named in your **signed session token** — never to one named by
the request.

A request for another organisation's record returns **not found**, not
*forbidden*. A "forbidden" would confirm the record exists, which is itself a
disclosure. Records you create are always placed in your own organisation; an
organisation supplied in a request body is ignored.

### What roles are available?

Three. **Viewer** reads. **Analyst** reads and assesses — recomputing risk,
triaging threats, reviewing access, working findings. **Admin** additionally
configures the estate, and is alone in reaching the audit trail and the import
tools.

The interface hides what a role cannot use, but the platform refuses
regardless — a typed URL gets the same answer as a hidden button.

### How does data get into Drishti?

By CSV import, for seven record types: assets, PHI types, data flows, vendors,
access grants, threats and risks. Each type has a downloadable template.

Every file is validated before anything is written. You see exactly what will
be created, and nothing is committed until you confirm. A file with problems
reports each one by row and field, and imports nothing.

There are no live connectors to EHRs, cloud providers or identity systems
today.

### Can we export what is in Drishti?

The PHI flow map exports as an image. The audit trail is filterable and
paginated on screen. A structured risk assessment summary is available from
the API.

There is no one-click PDF report today. If that matters to your process, say
so — it is a known gap rather than a hidden one.

### Does Drishti make us HIPAA compliant?

No. No product can.

Drishti gives you visibility into where PHI lives and who can reach it, and an
unalterable record of what you found and what you did. Those are things a
HIPAA security risk analysis asks for, and having them makes the work
considerably easier to do and to evidence.

Whether your organisation is compliant remains your determination, with your
counsel and your auditors.

### Does Drishti use AI?

No. Nothing in Drishti infers, predicts or generates. Every figure on screen
is either counted from records you supplied or derived arithmetically from
them, and the derivation is visible — you can see the four factors behind any
score.

### What happens if the platform cannot reach the server?

The interface says so rather than showing an empty screen that implies there
is nothing to see. A list that cannot load explains that the backend is
unreachable; it does not render as "no records".

Similarly, a temporary problem while restoring your session is reported as
"checking your session", not as an expiry — you are only signed out when the
server has actually said the session is no longer valid.

### How is it deployed?

As two containers — the web application and the API — over a PostgreSQL
database. It can run in your environment.

### What does Drishti deliberately not do?

- It does not read or store patient records.
- It does not perform changes to your systems.
- It does not certify compliance with any framework.
- It does not let anyone, including administrators, edit the audit trail.
- It does not use AI to infer anything about your estate.
