export class SessionReplacedError extends Error {
  constructor(message = "This session is no longer active.") {
    super(message);
    this.name = "SessionReplacedError";
  }
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (typeof window !== "undefined" && sessionStorage.getItem("session_invalidated") === "true") {
    // Return a never-resolving promise to stop the request waterfall
    return new Promise(() => {});
  }

  const response = await fetch(input, init);

  if (response.status === 401) {
    const clone = response.clone();
    try {
      const data = await clone.json();
      if (data?.code === "SESSION_REPLACED") {
        if (typeof window !== "undefined") {
          sessionStorage.setItem("session_invalidated", "true");
          window.dispatchEvent(new CustomEvent("session-replaced"));
        }
        throw new SessionReplacedError(data.message || "Session replaced");
      }
    } catch (e) {
      if (e instanceof SessionReplacedError) throw e;
    }
  }

  return response;
}
