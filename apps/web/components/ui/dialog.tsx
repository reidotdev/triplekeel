"use client";

import type { ReactNode } from "react";
import {
  Button as AriaButton,
  Dialog as AriaDialog,
  DialogTrigger,
  Heading,
  Modal,
  ModalOverlay,
} from "react-aria-components";

type DialogProps = {
  title: string;
  trigger: string;
  children: ReactNode;
};

export function Dialog({ title, trigger, children }: DialogProps) {
  return (
    <DialogTrigger>
      <AriaButton className="min-h-10 rounded-card border border-border px-4 py-2 text-sm font-medium">
        {trigger}
      </AriaButton>
      <ModalOverlay className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
        <Modal className="w-full max-w-md rounded-card border border-border bg-background p-6 shadow-xl">
          <AriaDialog className="grid gap-4 outline-none">
            <Heading slot="title" className="text-lg font-semibold">
              {title}
            </Heading>
            {children}
          </AriaDialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
