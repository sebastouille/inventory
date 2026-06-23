import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ACCESS_TOKEN_KEY, apiFetch, clearStoredToken, setStoredToken } from "@/lib/api";
import { useStoredToken } from "@/lib/session";

function TokenProbe() {
  const token = useStoredToken();

  return <span>{token ?? "none"}</span>;
}

describe("web session API", () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("synchronizes token updates in the same tab", async () => {
    window.localStorage.clear();

    render(<TokenProbe />);
    expect(screen.getByText("none")).toBeInTheDocument();

    act(() => {
      setStoredToken("demo-token");
    });

    await waitFor(() => {
      expect(screen.getByText("demo-token")).toBeInTheDocument();
    });

    act(() => {
      clearStoredToken();
    });

    await waitFor(() => {
      expect(screen.getByText("none")).toBeInTheDocument();
    });
  });

  it("clears the stored token when the API returns 401", async () => {
    window.localStorage.clear();
    setStoredToken("stale-token");

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "Invalid token", error: "Unauthorized", statusCode: 401 }), {
          status: 401,
          headers: { "Content-Type": "application/json" }
        })
      )
    );

    await expect(apiFetch("/auth/me")).rejects.toMatchObject({
      message: "Invalid token",
      status: 401
    });

    expect(window.localStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
  });
});
