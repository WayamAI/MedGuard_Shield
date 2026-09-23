import { Card, Badge, Btn } from "@/components/ui-bits";
import { AppIcon } from "@/components/AppIcon";
import { PageHeader, Field, FieldGroup, MetricCard } from "@/components/ui-patterns";
import { useOrganization } from "@/hooks/useGovernance";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/hooks/use-auth";
import { getApiBaseUrl } from "@/lib/apiClient";

/**
 * Settings.
 *
 * Deliberately short. Everything here is either read from the API or is a
 * genuine local preference that persists — there are no switches that only
 * move React state and look like configuration.
 *
 * The organisation is read-only because the API exposes no write path for it,
 * and session details are shown because "which org am I in, as what role,
 * against which API" is the question this page actually gets opened for.
 */
export default function Settings() {
  const org = useOrganization();
  const { user, memberships } = useAuth();
  const { theme, toggleTheme } = useTheme();

  let apiBase = "not configured";
  try { apiBase = getApiBaseUrl(); } catch { /* left as the default text */ }

  const counts = org.data?.counts ?? {};

  return (
    <div className="space-y-4">
      <PageHeader
        title="Settings"
        description="Your session, your organisation, and the preferences this browser remembers."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Assets" value={counts.assets} icon="database" />
        <MetricCard label="Vendors" value={counts.vendors} icon="facility" />
        <MetricCard label="Identities" value={counts.identities} icon="identity" />
        <MetricCard label="Members" value={counts.members} icon="access" />
      </div>

      <Card className="p-4">
        <h3 className="mb-2 font-display text-heading-md text-primary">Organisation</h3>
        <FieldGroup>
          <Field label="Name" value={org.data?.name ?? "…"} />
          <Field label="Identifier" value={<span className="font-mono text-body-sm">{org.data?.slug ?? "…"}</span>} />
          <Field label="Your role" value={org.data ? <Badge tone="info">{org.data.yourRole}</Badge> : "…"} />
          <Field
            label="Created"
            value={org.data ? new Date(org.data.createdAt).toLocaleDateString() : "…"}
          />
        </FieldGroup>
        <p className="mt-3 text-caption text-tertiary">
          Organisation details are read-only here. The API exposes no write
          path for them, so Drishti does not offer one.
        </p>
      </Card>

      <Card className="p-4">
        <h3 className="mb-2 font-display text-heading-md text-primary">Session</h3>
        <FieldGroup>
          <Field label="Signed in as" value={user?.email ?? "—"} />
          <Field label="Role" value={user?.role ?? "—"} />
          <Field
            label="Memberships"
            value={memberships.length
              ? memberships.map(m => m.organizationName).join(", ")
              : "—"}
          />
          <Field label="API" value={<span className="font-mono text-body-sm">{apiBase}</span>} />
        </FieldGroup>
        <p className="mt-3 text-caption text-tertiary">
          The access token lives in memory for one hour and is never written to
          browser storage. A reload restores the session from an httpOnly
          refresh cookie that scripts cannot read.
        </p>
      </Card>

      <Card className="p-4">
        <h3 className="mb-2 font-display text-heading-md text-primary">Preferences</h3>
        <div className="flex items-center justify-between gap-4 border-b border-muted py-2.5 last:border-0">
          <div className="min-w-0">
            <div className="text-body-md text-primary">Appearance</div>
            <div className="text-caption text-tertiary">
              Remembered in this browser only.
            </div>
          </div>
          <Btn variant="outline" onClick={toggleTheme}>
            <AppIcon name={theme === "dark" ? "themeDark" : "themeLight"} size="sm" />
            {theme === "dark" ? "Dark" : "Light"}
          </Btn>
        </div>
      </Card>
    </div>
  );
}
