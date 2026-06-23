"use client";

import type { GlobalSearchItem, GlobalSearchResponse } from "@inventory/shared";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleHelpIcon, LogOutIcon, Maximize2Icon, MenuIcon, Minimize2Icon } from "lucide-react";
import { cn } from "../lib/utils";
import { HeaderIconButton } from "./header-icon-button";
import { ThemeToggle } from "./theme-toggle";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from "./ui/dropdown-menu";
import { Separator } from "./ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "./ui/dialog";
import { GlobalSearchBox } from "./global-search-box";

export interface AppNavItem {
  href: string;
  label: string;
  icon: ReactNode;
  badge?: number | null;
}

export interface AppNavGroup {
  label: string;
  items: AppNavItem[];
}

export interface AppShellHelpDialog {
  title: string;
  description?: string;
  content: ReactNode;
  triggerLabel?: string;
}

export interface AppShellHeaderStatus {
  content: ReactNode;
}

export interface AppShellGlobalSearch {
  value: string;
  onValueChange: (value: string) => void;
  results: GlobalSearchResponse | null;
  isLoading: boolean;
  error: string | null;
  minChars?: number;
  placeholder?: string;
  onSelect: (item: GlobalSearchItem) => void;
}

interface AppShellProps {
  brandEyebrow?: string;
  brandName?: string;
  navGroups: AppNavGroup[];
  globalSearch?: AppShellGlobalSearch | null;
  helpDialog?: AppShellHelpDialog | null;
  headerStatus?: AppShellHeaderStatus | null;
  onLogout: () => void;
  children: ReactNode;
}

function NavigationContent({
  navGroups,
  pathname,
  compact = false
}: Pick<AppShellProps, "navGroups"> & { pathname: string; compact?: boolean }) {
  return (
    <div className="flex h-full flex-col gap-6">
      <nav className="space-y-5">
        {navGroups.map((group) => (
          <div key={group.label} className="space-y-2">
            <p className={cn("px-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground", compact ? "px-2" : undefined)}>
              {group.label}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const active =
                  item.href === "/" ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                      active
                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                        : "text-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <span className="flex size-5 items-center justify-center">{item.icon}</span>
                    <span className="flex-1">{item.label}</span>
                    {typeof item.badge === "number" ? (
                      <Badge variant={active ? "secondary" : "outline"}>{item.badge}</Badge>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );
}

export function AppShell({
  brandEyebrow,
  brandName,
  navGroups,
  globalSearch,
  helpDialog,
  headerStatus,
  onLogout,
  children
}: AppShellProps) {
  const pathname = usePathname();
  const [desktopNavOpen, setDesktopNavOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpExpanded, setHelpExpanded] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const openMenu = () => {
    cancelClose();
    setDesktopNavOpen(true);
  };

  const scheduleClose = () => {
    cancelClose();
    closeTimerRef.current = setTimeout(() => {
      setDesktopNavOpen(false);
      closeTimerRef.current = null;
    }, 180);
  };

  useEffect(() => {
    return () => {
      cancelClose();
    };
  }, []);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_22%),radial-gradient(circle_at_bottom_right,_rgba(20,184,166,0.14),_transparent_18%),linear-gradient(180deg,rgba(234,242,251,0.55)_0%,rgba(248,250,252,1)_28%,rgba(239,248,255,0.88)_100%)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.16),_transparent_20%),radial-gradient(circle_at_bottom_right,_rgba(20,184,166,0.14),_transparent_22%),linear-gradient(180deg,#04111d_0%,#06111f_34%,#08182a_100%)]">
      <div className="mx-auto flex min-h-screen max-w-[1720px] flex-col">
        <div className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-[180] border-b border-border/60 bg-background/78 px-4 py-3 backdrop-blur md:px-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div
                  onMouseEnter={openMenu}
                  onMouseLeave={scheduleClose}
                >
                  <DropdownMenu open={desktopNavOpen} onOpenChange={setDesktopNavOpen}>
                    <DropdownMenuTrigger
                      render={
                        <HeaderIconButton
                          icon={<MenuIcon className="size-5" />}
                          label="Afficher la navigation"
                          onClick={() => {
                            cancelClose();
                            setDesktopNavOpen((current) => !current);
                          }}
                        />
                      }
                    >
                      <span className="sr-only">Afficher la navigation</span>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      sideOffset={10}
                      className="w-[320px] p-4"
                      onMouseEnter={openMenu}
                      onMouseLeave={scheduleClose}
                    >
                      {(brandEyebrow || brandName) ? (
                        <>
                          <div className="space-y-1 px-2 pb-3">
                            {brandEyebrow ? (
                              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
                                {brandEyebrow}
                              </p>
                            ) : null}
                            {brandName ? <p className="text-sm text-muted-foreground">{brandName}</p> : null}
                          </div>
                          <Separator />
                        </>
                      ) : null}
                      <div className="pt-3">
                        <NavigationContent navGroups={navGroups} pathname={pathname} compact />
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {globalSearch ? (
                  <GlobalSearchBox
                    value={globalSearch.value}
                    onValueChange={globalSearch.onValueChange}
                    results={globalSearch.results}
                    isLoading={globalSearch.isLoading}
                    error={globalSearch.error}
                    minChars={globalSearch.minChars}
                    placeholder={globalSearch.placeholder}
                    onSelect={globalSearch.onSelect}
                  />
                ) : null}
              </div>
              <div className="flex shrink-0 items-center justify-end gap-2">
                {headerStatus ? headerStatus.content : null}
                <ThemeToggle />
                {helpDialog ? (
                  <Dialog
                    open={helpOpen}
                    onOpenChange={(open) => {
                      setHelpOpen(open);
                      if (!open) {
                        setHelpExpanded(false);
                      }
                    }}
                  >
                    <DialogTrigger
                      render={
                        <HeaderIconButton
                          icon={<CircleHelpIcon className="size-5" />}
                          label={helpDialog.triggerLabel ?? "Afficher l aide de la page"}
                          onClick={() => setHelpOpen(true)}
                        />
                      }
                    >
                      <span className="sr-only">{helpDialog.triggerLabel ?? "Afficher l aide de la page"}</span>
                    </DialogTrigger>
                    <DialogContent
                      className="max-w-none gap-0 overflow-hidden p-0"
                      style={{
                        width: helpExpanded ? "min(1400px, calc(100vw - 1rem))" : "min(1120px, calc(100vw - 2rem))",
                        height: helpExpanded ? "min(92vh, 960px)" : "min(84vh, 860px)",
                        resize: "both",
                        minWidth: "min(720px, calc(100vw - 1rem))",
                        minHeight: "min(520px, calc(100vh - 1rem))",
                        maxWidth: "calc(100vw - 1rem)",
                        maxHeight: "92vh"
                      }}
                    >
                      <div className="shrink-0 border-b border-border/60 px-5 py-4">
                        <DialogHeader className="pr-10">
                          <DialogTitle>{helpDialog.title}</DialogTitle>
                          {helpDialog.description ? (
                            <DialogDescription>{helpDialog.description}</DialogDescription>
                          ) : null}
                        </DialogHeader>
                      </div>
                      <div className="min-h-0 flex-1 overflow-auto px-5 py-5">
                        {helpDialog.content}
                      </div>
                      <DialogFooter className="shrink-0 border-t border-border/60 px-5 py-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setHelpExpanded((current) => !current)}
                        >
                          {helpExpanded ? <Minimize2Icon className="size-4" /> : <Maximize2Icon className="size-4" />}
                          {helpExpanded ? "Taille standard" : "Agrandir"}
                        </Button>
                        <Button type="button" variant="outline" onClick={() => setHelpOpen(false)}>
                          Fermer
                        </Button>
                      </DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        className="absolute right-3 bottom-3 z-10 shadow-sm"
                        onClick={() => setHelpExpanded((current) => !current)}
                      >
                        {helpExpanded ? <Minimize2Icon className="size-4" /> : <Maximize2Icon className="size-4" />}
                        <span className="sr-only">
                          {helpExpanded ? "Revenir a la taille standard" : "Agrandir la fenetre d aide"}
                        </span>
                      </Button>
                    </DialogContent>
                  </Dialog>
                ) : null}
                <HeaderIconButton
                  icon={<LogOutIcon className="size-5" />}
                  label="Deconnexion"
                  onClick={onLogout}
                />
              </div>
            </div>
          </header>
          <main className="flex-1 px-4 py-5 md:px-20 md:py-20">{children}</main>
        </div>
      </div>
    </div>
  );
}
