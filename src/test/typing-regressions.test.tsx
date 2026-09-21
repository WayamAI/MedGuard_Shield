import { describe, it, expect } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { AppStoreProvider, useStore } from "@/store/AppStore";
import Policy from "@/pages/Policy";

/**
 * Removing the `any`s from the sample-data pages meant rewriting two real
 * expressions, not just their annotations: the suspend toggle stopped being a
 * ternary-as-statement, and Policy's deep-link tab stopped reading `state`
 * off an `any`. Both are easy to get subtly wrong and neither was covered, so
 * these pin the behaviour rather than the types — `tsc` already covers those.
 */

const wrap = (node: ReactNode) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter><AppStoreProvider>{node}</AppStoreProvider></MemoryRouter>
  </QueryClientProvider>
);

const storeWrapper = ({ children }: { children: ReactNode }) => (
  <AppStoreProvider>{children}</AppStoreProvider>
);

describe("suspend toggle", () => {
  it("adds an id on first toggle and removes it on the second", () => {
    const { result } = renderHook(() => useStore(), { wrapper: storeWrapper });

    expect(result.current.suspendedUsers.has(7)).toBe(false);
    act(() => result.current.toggleSuspend(7));
    expect(result.current.suspendedUsers.has(7)).toBe(true);
    act(() => result.current.toggleSuspend(7));
    expect(result.current.suspendedUsers.has(7)).toBe(false);
  });

  it("tracks several ids independently", () => {
    const { result } = renderHook(() => useStore(), { wrapper: storeWrapper });

    act(() => result.current.toggleSuspend(1));
    act(() => result.current.toggleSuspend(2));
    act(() => result.current.toggleSuspend(1));

    expect(result.current.suspendedUsers.has(1)).toBe(false);
    expect(result.current.suspendedUsers.has(2)).toBe(true);
  });
});

describe("Policy deep link", () => {
  it("opens on the approvals tab when routed there", () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={[{ pathname: "/policy", state: { tab: "approvals" } }]}>
          <AppStoreProvider><Policy /></AppStoreProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    // An approval only renders on the approvals tab.
    expect(screen.getByText(/Updated PHI retention period/)).toBeInTheDocument();
  });

  it("defaults to the policies tab with no routing state", () => {
    render(wrap(<Policy />));
    expect(screen.getByText("PHI Data Retention Policy")).toBeInTheDocument();
    expect(screen.queryByText(/Updated PHI retention period/)).not.toBeInTheDocument();
  });
});
