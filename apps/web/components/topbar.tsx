"use client";

import { Button } from "@/components/ui/button";
import { clearStoredToken } from "@/lib/api";

interface TopbarProps {
  title: string;
  description: string;
}

export function Topbar({ title, description }: TopbarProps) {
  return (
    <header className="border-b border-border/60 bg-card/80 px-6 py-4 backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            clearStoredToken();
            window.location.reload();
          }}
        >
          Logout
        </Button>
      </div>
    </header>
  );
}
