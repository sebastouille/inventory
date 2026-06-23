"use client";

import type { GlobalSearchDomain, GlobalSearchGroup, GlobalSearchItem, GlobalSearchResponse } from "@inventory/shared";
import {
  ClipboardListIcon,
  FolderInputIcon,
  LandmarkIcon,
  LaptopMinimalIcon,
  MapPinnedIcon,
  SearchIcon
} from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/utils";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";

export interface GlobalSearchBoxProps {
  value: string;
  onValueChange: (value: string) => void;
  results: GlobalSearchResponse | null;
  isLoading: boolean;
  error: string | null;
  minChars?: number;
  placeholder?: string;
  onSelect: (item: GlobalSearchItem) => void;
}

interface DropdownPosition {
  top: number;
  left: number;
  width: number;
}

const DOMAIN_ICONS: Record<GlobalSearchDomain, typeof LaptopMinimalIcon> = {
  assets: LaptopMinimalIcon,
  campaigns: ClipboardListIcon,
  locations: MapPinnedIcon,
  immobilizations: LandmarkIcon,
  "imports.jobs": FolderInputIcon,
  "imports.profiles": FolderInputIcon
} as const;

export function GlobalSearchBox({
  value,
  onValueChange,
  results,
  isLoading,
  error,
  minChars = 3,
  placeholder = "Recherche globale",
  onSelect
}: GlobalSearchBoxProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition | null>(null);
  const normalizedValue = value.trim();

  const flatItems = useMemo(
    () =>
      (results?.groups ?? []).flatMap((group: GlobalSearchGroup) =>
        group.items.map((item) => ({
          groupLabel: group.label,
          item
        }))
      ),
    [results?.groups]
  );
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [flatItems.length, normalizedValue]);

  useEffect(() => {
    if (normalizedValue.length < minChars) {
      setOpen(false);
      return;
    }
    if (isLoading || error || flatItems.length > 0 || results) {
      setOpen(true);
    }
  }, [error, flatItems.length, isLoading, minChars, normalizedValue.length, results]);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !dropdownRef.current?.contains(target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

  const activeItem = flatItems[activeIndex]?.item ?? null;
  const shouldShowDropdown = open && normalizedValue.length >= minChars;

  const updateDropdownPosition = () => {
    const root = rootRef.current;
    if (!root) {
      return;
    }

    const rect = root.getBoundingClientRect();
    setDropdownPosition({
      top: rect.bottom + 10,
      left: rect.left,
      width: rect.width
    });
  };

  useLayoutEffect(() => {
    if (!shouldShowDropdown) {
      return;
    }

    updateDropdownPosition();
  }, [shouldShowDropdown, normalizedValue, flatItems.length]);

  useEffect(() => {
    if (!shouldShowDropdown) {
      return;
    }

    const handleViewportChange = () => {
      updateDropdownPosition();
    };

    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [shouldShowDropdown]);

  const handleSelect = (item: GlobalSearchItem) => {
    setOpen(false);
    onSelect(item);
  };

  const dropdown =
    shouldShowDropdown && portalReady && dropdownPosition
      ? createPortal(
          <div
            id="global-search-results"
            ref={dropdownRef}
            className="fixed max-h-[70vh] overflow-auto rounded-2xl border border-border bg-background p-2 shadow-[0_30px_70px_-35px_rgba(11,31,58,0.75)]"
            style={{
              top: dropdownPosition.top,
              left: dropdownPosition.left,
              width: dropdownPosition.width,
              zIndex: 2147483647
            }}
          >
            {isLoading ? <p className="px-3 py-3 text-sm text-muted-foreground">Recherche en cours...</p> : null}
            {!isLoading && error ? <p className="px-3 py-3 text-sm text-destructive">{error}</p> : null}
            {!isLoading && !error && flatItems.length === 0 ? (
              <p className="px-3 py-3 text-sm text-muted-foreground">Aucun resultat.</p>
            ) : null}
            {!isLoading && !error ? (
              <div className="space-y-3">
                {(results?.groups ?? []).map((group: GlobalSearchGroup) => (
                  <div key={group.domain} className="space-y-1">
                    <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      {group.label}
                    </p>
                    <div className="space-y-1">
                      {group.items.map((item: GlobalSearchItem) => {
                        const Icon = DOMAIN_ICONS[item.domain];
                        const itemIndex = flatItems.findIndex(
                          (entry: { groupLabel: string; item: GlobalSearchItem }) =>
                            entry.item.id === item.id && entry.item.domain === item.domain
                        );
                        const active = itemIndex === activeIndex;

                        return (
                          <button
                            key={`${item.domain}:${item.id}`}
                            type="button"
                            className={cn(
                              "flex w-full items-start gap-3 rounded-xl px-3 py-2 text-left transition-colors",
                              active ? "bg-sidebar-primary text-sidebar-primary-foreground" : "hover:bg-muted/60"
                            )}
                            onMouseDown={(event) => event.preventDefault()}
                            onMouseEnter={() => setActiveIndex(itemIndex)}
                            onClick={() => handleSelect(item)}
                          >
                            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center">
                              <Icon className="size-4" />
                            </span>
                            <span className="min-w-0 flex-1 space-y-1">
                              <span className="flex min-w-0 items-center gap-2">
                                <span className="truncate text-sm font-medium">{item.title}</span>
                                {item.code ? (
                                  <Badge variant={active ? "secondary" : "outline"} className="shrink-0">
                                    {item.code}
                                  </Badge>
                                ) : null}
                              </span>
                              {item.subtitle ? (
                                <span
                                  className={cn(
                                    "block text-xs",
                                    active ? "text-sidebar-primary-foreground/80" : "text-muted-foreground"
                                  )}
                                >
                                  {item.subtitle}
                                </span>
                              ) : null}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>,
          document.body
        )
      : null;

  return (
    <div ref={rootRef} className="relative z-[90] w-full md:max-w-[30vw]">
      <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        value={value}
        onFocus={() => {
          if (normalizedValue.length >= minChars) {
            setOpen(true);
          }
        }}
        onChange={(event) => {
          onValueChange(event.target.value);
          if (event.target.value.trim().length >= minChars) {
            setOpen(true);
          }
        }}
        onKeyDown={(event) => {
          if (!shouldShowDropdown) {
            return;
          }
          if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
            return;
          }
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((current) => (flatItems.length === 0 ? 0 : (current + 1) % flatItems.length));
            return;
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((current) => (flatItems.length === 0 ? 0 : (current - 1 + flatItems.length) % flatItems.length));
            return;
          }
          if (event.key === "Enter" && activeItem) {
            event.preventDefault();
            handleSelect(activeItem);
          }
        }}
        placeholder={placeholder}
        className="h-10 rounded-lg bg-background pl-9"
        role="combobox"
        aria-expanded={shouldShowDropdown}
        aria-controls="global-search-results"
        aria-autocomplete="list"
      />
      {dropdown}
    </div>
  );
}
