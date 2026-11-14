"use client";

import {
  Button as AriaButton,
  Select as AriaSelect,
  type SelectProps as AriaSelectProps,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  SelectValue,
} from "react-aria-components";

type SelectOption = { id: string; label: string };

type SelectProps = Omit<AriaSelectProps, "children"> & {
  label: string;
  options: SelectOption[];
};

export function Select({
  label,
  options,
  className = "",
  ...props
}: SelectProps) {
  return (
    <AriaSelect {...props} className={`grid gap-2 ${className}`}>
      <Label className="text-sm font-medium">{label}</Label>
      <AriaButton className="flex min-h-10 items-center justify-between rounded-card border border-border bg-background px-3 text-left text-sm">
        <SelectValue />
        <span aria-hidden="true">⌄</span>
      </AriaButton>
      <Popover className="min-w-[var(--trigger-width)] rounded-card border border-border bg-background p-1 shadow-lg">
        <ListBox className="outline-none">
          {options.map((option) => (
            <ListBoxItem
              key={option.id}
              id={option.id}
              textValue={option.label}
              className="cursor-default rounded px-3 py-2 text-sm outline-none data-[focused]:bg-surface"
            >
              {option.label}
            </ListBoxItem>
          ))}
        </ListBox>
      </Popover>
    </AriaSelect>
  );
}
