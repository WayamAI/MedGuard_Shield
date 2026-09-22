/**
 * A breadcrumb, not a credential.
 *
 * Records only that a session existed in this tab, so the login page can say
 * "your session ended" instead of showing a bare form after a reload. It holds
 * no token and grants no access, which is why it can live in sessionStorage
 * while the token deliberately cannot. Cleared on an explicit logout, since
 * choosing to leave is not a lost session.
 */
const KEY = "drishti-had-session";

export function hadSession(): boolean {
  try {
    return window.sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setHadSession(on: boolean) {
  try {
    if (on) window.sessionStorage.setItem(KEY, "1");
    else window.sessionStorage.removeItem(KEY);
  } catch {
    /* storage unavailable (private mode); the notice simply will not show */
  }
}
