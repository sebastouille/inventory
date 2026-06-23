"use client";

import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { forwardRef } from "react";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";

export interface HeaderIconButtonProps extends Omit<ComponentPropsWithoutRef<typeof Button>, "children" | "size"> {
  icon: ReactNode;
  label: string;
}

export const HeaderIconButton = forwardRef<HTMLButtonElement, HeaderIconButtonProps>(
  function HeaderIconButton({ icon, label, className, variant = "outline", ...props }, ref) {
    return (
      <Button
        ref={ref}
        variant={variant}
        size="icon"
        aria-label={label}
        className={cn("rounded-full p-2", className)}
        {...props}
      >
        {icon}
      </Button>
    );
  }
);
