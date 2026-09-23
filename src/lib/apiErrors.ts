import { ApiError } from "@/lib/apiClient";

/**
 * Narrow a caught value to an ApiError.
 *
 * Mutation callbacks catch `unknown`, and describeApiError wants the typed
 * error or null. Doing the check once here stops every call site inventing
 * its own — and stops a non-ApiError throw rendering as "[object Object]".
 */
export function toApiError(error: unknown): ApiError | null {
  return error instanceof ApiError ? error : null;
}

/** Plain-language cause. A viewer cannot act on "TypeError: failed to fetch". */
export function describeApiError(error: ApiError | null): { title: string; message: string } {
  if (!error) return { title: "Could not load this data", message: "An unknown error occurred." };
  if (error.isNetworkError) {
    return {
      title: "Can't reach the backend",
      message: "The API is not responding. It may be starting up, or the connection dropped.",
    };
  }
  if (error.isAuthError) {
    return {
      title: "Session expired",
      message: "Your session is no longer valid. Sign in again to continue.",
    };
  }
  if (error.status >= 500) {
    return {
      title: "The backend returned an error",
      message: `The server responded with ${error.status}. This is a problem on the API side.`,
    };
  }
  return { title: "Could not load this data", message: error.message };
}
