---

status: accepted
date: 2026-11-15
decision-makers: Andrei
---

# UI foundation: React Aria Components and Tailwind

## Context

REI-259 needs a small accessible base for later web UI tickets. It should stay easy to restyle and should not become a shared design system before the extension needs one.

## Decision

- Use React Aria Components for accessible interactive behavior.
- Use Tailwind CSS for layout and component styling.
- Keep design values as CSS variables in `apps/web/app/globals.css`, with light and dark defaults.
- Keep reusable wrappers in `apps/web/components/ui/`.
- Use these wrappers in later web tickets instead of styling one-off controls. Add a wrapper only when the UI foundation does not already cover the need.
- Keep this package app-local. Do not create `packages/ui` for the extension in REI-259.
- Keep `/dev/ui` available only in development to preview the wrappers.

## Consequences

- React Aria supplies keyboard and screen-reader behavior while the wrappers keep app styling consistent.
- CSS variables let the app and Clerk hosted components share the same neutral theme.
- Later work can move tokens into a shared package if the extension popup needs the same visual language.

## References

- REI-259: Web skeleton live at `triplekeel.rei.dev`.
- Components: `apps/web/components/ui/`.
- Tokens: `apps/web/app/globals.css`.
