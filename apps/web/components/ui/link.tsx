"use client";

import {
  Link as AriaLink,
  type LinkProps as AriaLinkProps,
} from "react-aria-components";

export function Link({ className = "", ...props }: AriaLinkProps) {
  return (
    <AriaLink
      {...props}
      className={`text-primary underline underline-offset-4 ${className}`}
    />
  );
}
