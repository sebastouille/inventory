"use client";

import type { GlobalSearchResponse } from "@inventory/shared";
import { useEffect, useState } from "react";
import { apiFetch, isUnauthorizedApiError } from "@/lib/api";

const MIN_CHARS = 3;
const DEBOUNCE_MS = 250;

function normalizeWebAppBaseUrl(value: string | undefined) {
  return (value ?? "http://localhost:3010").trim().replace(/\/+$/, "");
}

const WEB_APP_BASE_URL = normalizeWebAppBaseUrl(process.env.NEXT_PUBLIC_WEB_APP_URL);

export function useGlobalSearch() {
  const [value, setValue] = useState("");
  const [results, setResults] = useState<GlobalSearchResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const query = value.trim();
    if (query.length < MIN_CHARS) {
      setResults(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    const timeout = window.setTimeout(() => {
      void apiFetch<GlobalSearchResponse>(`/search/global?q=${encodeURIComponent(query)}`)
        .then((response) => {
          if (cancelled) {
            return;
          }
          setResults({
            ...response,
            groups: response.groups.map((group) => ({
              ...group,
              items: group.items.map((item) => ({
                ...item,
                href: `${WEB_APP_BASE_URL}${item.href}`
              }))
            }))
          });
          setError(null);
        })
        .catch((loadError) => {
          if (cancelled) {
            return;
          }
          if (isUnauthorizedApiError(loadError)) {
            setResults(null);
            setError(null);
            return;
          }
          setResults(null);
          setError(loadError instanceof Error ? loadError.message : "Recherche globale indisponible");
        })
        .finally(() => {
          if (!cancelled) {
            setIsLoading(false);
          }
        });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [value]);

  const clear = () => {
    setValue("");
    setResults(null);
    setIsLoading(false);
    setError(null);
  };

  return {
    value,
    setValue,
    results,
    isLoading,
    error,
    minChars: MIN_CHARS,
    clear
  };
}
