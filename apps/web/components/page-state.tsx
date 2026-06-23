"use client";

import { Card, CardContent } from "@/components/ui/card";

interface PageStateProps {
  message: string;
}

export function PageState({ message }: PageStateProps) {
  return (
    <Card className="border-dashed border-border/60 bg-card/40">
      <CardContent className="py-10 text-center text-sm text-muted-foreground">{message}</CardContent>
    </Card>
  );
}
