"use client";

import type * as React from "react";
import { Dialog as SheetPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "./button";

function Sheet(props: SheetPrimitive.Root.Props) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger(props: SheetPrimitive.Trigger.Props) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose(props: SheetPrimitive.Close.Props) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal(props: SheetPrimitive.Portal.Props) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay({ className, ...props }: SheetPrimitive.Backdrop.Props) {
  return (
    <SheetPrimitive.Backdrop
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-[#06111f]/35 backdrop-blur-sm transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0",
        className
      )}
      {...props}
    />
  );
}

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  ...props
}: SheetPrimitive.Popup.Props & {
  side?: "top" | "right" | "bottom" | "left";
  showCloseButton?: boolean;
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Popup
        data-slot="sheet-content"
        data-side={side}
        className={cn(
          "fixed z-50 flex flex-col gap-4 border border-border/60 bg-popover text-sm text-popover-foreground shadow-2xl transition duration-200 ease-in-out data-ending-style:opacity-0 data-starting-style:opacity-0 data-[side=bottom]:inset-x-2 data-[side=bottom]:bottom-2 data-[side=bottom]:max-h-[85vh] data-[side=bottom]:rounded-2xl data-[side=bottom]:data-ending-style:translate-y-12 data-[side=bottom]:data-starting-style:translate-y-12 data-[side=left]:inset-y-2 data-[side=left]:left-2 data-[side=left]:w-[min(26rem,92vw)] data-[side=left]:rounded-2xl data-[side=left]:data-ending-style:-translate-x-12 data-[side=left]:data-starting-style:-translate-x-12 data-[side=right]:inset-y-2 data-[side=right]:right-2 data-[side=right]:w-[min(28rem,94vw)] data-[side=right]:rounded-2xl data-[side=right]:data-ending-style:translate-x-12 data-[side=right]:data-starting-style:translate-x-12 data-[side=top]:inset-x-2 data-[side=top]:top-2 data-[side=top]:rounded-2xl data-[side=top]:data-ending-style:-translate-y-12 data-[side=top]:data-starting-style:-translate-y-12",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton ? (
          <SheetPrimitive.Close
            data-slot="sheet-close"
            render={<Button size="icon-sm" variant="ghost" className="absolute top-3 right-3" />}
          >
            <XIcon />
            <span className="sr-only">Fermer</span>
          </SheetPrimitive.Close>
        ) : null}
      </SheetPrimitive.Popup>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sheet-header" className={cn("grid gap-1 p-5", className)} {...props} />;
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 border-t border-border/60 p-5", className)}
      {...props}
    />
  );
}

function SheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("font-heading text-lg font-semibold", className)}
      {...props}
    />
  );
}

function SheetDescription({ className, ...props }: SheetPrimitive.Description.Props) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetPortal,
  SheetTitle,
  SheetTrigger
};
