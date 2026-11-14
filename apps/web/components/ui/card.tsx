import type { HTMLAttributes } from "react";

type CardProps = HTMLAttributes<HTMLElement>;

export function Card({ className = "", ...props }: CardProps) {
  return (
    <article
      {...props}
      className={`rounded-card border border-border bg-background p-5 ${className}`}
    />
  );
}
