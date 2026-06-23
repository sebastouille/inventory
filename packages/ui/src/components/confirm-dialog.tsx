"use client";

import type { ReactElement } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "./ui/dialog";
import { Button } from "./ui/button";

interface ConfirmDialogProps {
  trigger: ReactElement;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
}

export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  onConfirm
}: ConfirmDialogProps) {
  return (
    <Dialog>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>{cancelLabel}</DialogClose>
          <DialogClose
            render={
              <Button
                variant="destructive"
                onClick={() => {
                  onConfirm();
                }}
              />
            }
          >
            {confirmLabel}
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
