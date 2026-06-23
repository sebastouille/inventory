"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/organizations", label: "Organizations" },
  { href: "/users", label: "Users" },
  { href: "/roles", label: "Roles" },
  { href: "/settings", label: "Settings" }
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="space-y-1">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={cn(
            "block rounded-md px-3 py-2 text-sm transition-colors",
            pathname === link.href
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
