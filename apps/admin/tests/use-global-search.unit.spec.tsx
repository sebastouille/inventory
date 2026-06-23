import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GlobalSearchResponse } from "@inventory/shared";

describe("admin useGlobalSearch", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    vi.resetModules();
    delete process.env.NEXT_PUBLIC_WEB_APP_URL;
  });

  it("rewrites relative result URLs to the web app absolute URL", async () => {
    vi.useFakeTimers();
    process.env.NEXT_PUBLIC_WEB_APP_URL = "http://localhost:3010/";

    const apiFetchMock = vi.fn<
      (path: string) => Promise<GlobalSearchResponse>
    >();
    const isUnauthorizedApiErrorMock = vi.fn().mockReturnValue(false);

    apiFetchMock.mockResolvedValue({
      query: "alp",
      total: 1,
      groups: [
        {
          domain: "campaigns",
          label: "Campagnes",
          items: [
            {
              id: "campaign-1",
              domain: "campaigns",
              title: "Alpha campagne",
              code: null,
              subtitle: "OPEN",
              href: "/campaigns?campaignId=campaign-1"
            }
          ]
        }
      ]
    });

    vi.doMock("@/lib/api", () => ({
      apiFetch: apiFetchMock,
      isUnauthorizedApiError: isUnauthorizedApiErrorMock
    }));

    const { useGlobalSearch } = await import("@/hooks/use-global-search");
    const { result } = renderHook(() => useGlobalSearch());

    act(() => {
      result.current.setValue("alp");
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
      await Promise.resolve();
    });

    expect(apiFetchMock).toHaveBeenCalledWith("/search/global?q=alp");
    expect(result.current.results?.groups[0]?.items[0]?.href).toBe(
      "http://localhost:3010/campaigns?campaignId=campaign-1"
    );
  });
});
