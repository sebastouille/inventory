import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GlobalSearchResponse } from "@inventory/shared";

const apiFetchMock = vi.fn();
const isUnauthorizedApiErrorMock = vi.fn();

vi.mock("@/lib/api", () => ({
  apiFetch: apiFetchMock,
  isUnauthorizedApiError: isUnauthorizedApiErrorMock
}));

describe("useGlobalSearch", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("does not call the API below 3 characters", async () => {
    vi.useFakeTimers();
    const { useGlobalSearch } = await import("@/hooks/use-global-search");
    const { result } = renderHook(() => useGlobalSearch());

    act(() => {
      result.current.setValue("ab");
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(result.current.results).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it("debounces the API call and exposes the fetched results", async () => {
    vi.useFakeTimers();
    const response: GlobalSearchResponse = {
      query: "alp",
      total: 1,
      groups: [
        {
          domain: "assets",
          label: "Equipements",
          items: [
            {
              id: "asset-1",
              domain: "assets",
              title: "Alpha poste",
              code: "EQ-001",
              subtitle: "Poste - Site A",
              href: "/assets/asset-1"
            }
          ]
        }
      ]
    };
    apiFetchMock.mockResolvedValue(response);
    isUnauthorizedApiErrorMock.mockReturnValue(false);

    const { useGlobalSearch } = await import("@/hooks/use-global-search");
    const { result } = renderHook(() => useGlobalSearch());

    act(() => {
      result.current.setValue("alp");
    });

    expect(apiFetchMock).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
      await Promise.resolve();
    });

    expect(apiFetchMock).toHaveBeenCalledWith("/search/global?q=alp");
    expect(result.current.results).toEqual(response);
    expect(result.current.isLoading).toBe(false);
  });
});
