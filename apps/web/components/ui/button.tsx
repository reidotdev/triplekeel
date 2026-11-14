"use client";

import {
  Button as AriaButton,
  type ButtonProps as AriaButtonProps,
} from "react-aria-components";

export function Button({ className = "", ...props }: AriaButtonProps) {
  return (
    <AriaButton
      {...props}
      className={`inline-flex min-h-10 items-center justify-center rounded-card bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    />
  );
}
