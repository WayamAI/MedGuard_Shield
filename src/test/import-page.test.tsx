import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import ImportData from "@/pages/ImportData";
import ProtectedRoute from "@/components/ProtectedRoute";
import { AuthProvider } from "@/hooks/use-auth";
import type { ImportReport } from "@/lib/apiTypes";

/* ---------------------------------------------------------------------------
   The whole point of this page is that a write happens only when a person
   asks for it, so these tests care most about which URL was called and when.
   -------------------------------------------------------------------------- */

type Call = { url: string; method: string };
let calls: Call[] = [];
let validateBody: ImportReport = { valid: true, totalRows: 2, errors: [], preview: [{ name: "A" }, { name: "B" }] };
let importStatus = 201;

const CONTRACT = [{
  entity: "assets", label: "Assets", model: "Asset",
  naturalKey: ["name"], naturalKeyLabel: "asset name",
  columns: [{ column: "name", type: "string", required: true }],
}];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  calls = [];
  validateBody = { valid: true, totalRows: 2, errors: [], preview: [{ name: "A" }, { name: "B" }] };
  importStatus = 201;
  vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({ url, method: init.method ?? "GET" });
    if (url.endsWith("/api/import")) return json({ data: CONTRACT });
    if (url.endsWith("/validate")) return json({ data: validateBody });
    if (importStatus === 201) return json({ data: { ...validateBody, imported: validateBody.totalRows } }, 201);
    return json({
      error: { code: "IMPORT_VALIDATION_FAILED", message: "rejected", report: validateBody },
    }, 400);
  }));
});

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

const wrap = (node: ReactNode) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
    <MemoryRouter>{node}</MemoryRouter>
  </QueryClientProvider>
);

const file = (name = "assets.csv", bytes = 32) =>
  new File([new Uint8Array(bytes)], name, { type: "text/csv" });

const pick = async (f: File) => {
  const input = screen.getByLabelText("CSV file") as HTMLInputElement;
  fireEvent.change(input, { target: { files: [f] } });
  await waitFor(() => expect(calls.some(c => c.url.endsWith("/validate"))).toBe(true));
};

const importCalls = () =>
  calls.filter(c => c.method === "POST" && !c.url.endsWith("/validate"));

/* ========================================================================== */

describe("Import page: the two-step guarantee", () => {
  it("validates on selection without importing", async () => {
    render(wrap(<ImportData />));
    await pick(file());

    expect(calls.some(c => c.url === "http://api.test/api/import/assets/validate")).toBe(true);
    // The line that matters: selecting a file must never write.
    expect(importCalls()).toHaveLength(0);
  });

  it("still has not imported once a valid preview is on screen", async () => {
    render(wrap(<ImportData />));
    await pick(file());

    await waitFor(() => expect(screen.getByText(/2 rows ready to import/)).toBeInTheDocument());
    expect(importCalls()).toHaveLength(0);
  });

  it("imports only when the button is pressed", async () => {
    render(wrap(<ImportData />));
    await pick(file());

    const confirm = await screen.findByRole("button", { name: "Confirm Import" });
    expect(importCalls()).toHaveLength(0);

    fireEvent.click(confirm);
    await waitFor(() => expect(importCalls()).toHaveLength(1));
    expect(importCalls()[0].url).toBe("http://api.test/api/import/assets");
  });

  it("says plainly that nothing has been written yet", async () => {
    render(wrap(<ImportData />));
    await pick(file());
    expect(await screen.findByText(/Nothing has been written yet/)).toBeInTheDocument();
  });
});

describe("Import page: an invalid file", () => {
  beforeEach(() => {
    validateBody = {
      valid: false, totalRows: 2,
      errors: [
        { row: 2, field: "name", message: "name is required" },
        { row: 3, field: "type", message: 'type must be one of: EHR. Got "NOPE"' },
      ],
      preview: [],
    };
  });

  it("shows every problem with its file line", async () => {
    render(wrap(<ImportData />));
    await pick(file());

    expect(await screen.findByText("name is required")).toBeInTheDocument();
    expect(screen.getByText(/type must be one of/)).toBeInTheDocument();
    expect(screen.getByText("File line")).toBeInTheDocument();
  });

  it("offers no way to import it", async () => {
    render(wrap(<ImportData />));
    await pick(file());

    await waitFor(() => expect(screen.getByText(/2 problems found/)).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Confirm Import" })).not.toBeInTheDocument();
    expect(importCalls()).toHaveLength(0);
  });

  it("says nothing was imported", async () => {
    render(wrap(<ImportData />));
    await pick(file());
    expect(await screen.findByText(/Nothing was imported/)).toBeInTheDocument();
  });
});

describe("Import page: client-side file checks", () => {
  it("rejects a file that is not a CSV without calling the server", async () => {
    render(wrap(<ImportData />));
    const input = screen.getByLabelText("CSV file") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["x"], "estate.xlsx")] } });

    expect(await screen.findByRole("alert")).toHaveTextContent(/Only .csv files are accepted/);
    expect(calls.filter(c => c.method === "POST")).toHaveLength(0);
  });

  it("rejects a file over 2MB without calling the server", async () => {
    render(wrap(<ImportData />));
    const input = screen.getByLabelText("CSV file") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file("huge.csv", 3 * 1024 * 1024)] } });

    expect(await screen.findByRole("alert")).toHaveTextContent(/limit is 2MB/);
    expect(calls.filter(c => c.method === "POST")).toHaveLength(0);
  });

  it("is a first line of defence, not the only one", async () => {
    // The server enforces the same ceiling and answers 413; the page must
    // survive that rather than assuming its own check was sufficient.
    render(wrap(<ImportData />));
    const input = screen.getByLabelText("CSV file") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file("ok.csv", 10)] } });
    await waitFor(() => expect(calls.some(c => c.url.endsWith("/validate"))).toBe(true));
    expect(screen.queryByText(/limit is 2MB/)).not.toBeInTheDocument();
  });
});

describe("Import page: after a successful import", () => {
  it("reports what was written", async () => {
    render(wrap(<ImportData />));
    await pick(file());
    fireEvent.click(await screen.findByRole("button", { name: "Confirm Import" }));

    expect(await screen.findByText(/Imported 2 rows into Assets/)).toBeInTheDocument();
  });

  it("tells the user the other views are already up to date", async () => {
    render(wrap(<ImportData />));
    await pick(file());
    fireEvent.click(await screen.findByRole("button", { name: "Confirm Import" }));

    expect(await screen.findByText(/have been refreshed/)).toBeInTheDocument();
  });

  it("does not leave the confirm button available to press twice", async () => {
    render(wrap(<ImportData />));
    await pick(file());
    fireEvent.click(await screen.findByRole("button", { name: "Confirm Import" }));

    await waitFor(() => expect(screen.getByText(/Imported 2/)).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Confirm Import" })).not.toBeInTheDocument();
    expect(importCalls()).toHaveLength(1);
  });
});

describe("Import page: a rejected import", () => {
  it("shows the same error table and reports nothing written", async () => {
    render(wrap(<ImportData />));
    await pick(file());

    // The server changes its mind between the dry run and the commit.
    importStatus = 400;
    validateBody = {
      valid: false, totalRows: 2,
      errors: [{ row: 2, field: "name", message: "name already exists" }],
      preview: [],
    };
    fireEvent.click(await screen.findByRole("button", { name: "Confirm Import" }));

    expect(await screen.findByText("name already exists")).toBeInTheDocument();
    expect(screen.getByText(/Nothing was imported/)).toBeInTheDocument();
  });
});

describe("Import page: admin gate", () => {
  const routed = (role: string) => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/auth/login")) {
        return json({ data: { token: "t", expiresIn: 1, user: { id: 1, email: "a@b.org", role } } });
      }
      return json({ data: CONTRACT });
    }));
    return render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={["/import"]}>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<div>Dashboard</div>} />
              <Route path="/login" element={<div>Sign in</div>} />
              <Route
                path="/import"
                element={
                  <ProtectedRoute requireRole={["ADMIN"]}>
                    <div>Import Data page</div>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  };

  it("sends a signed-out visitor to the login page", async () => {
    routed("ADMIN");
    expect(await screen.findByText("Sign in")).toBeInTheDocument();
  });
});
