"use client";

import {
  ComboBox as AriaComboBox,
  type ComboBoxProps as AriaComboBoxProps,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Text,
} from "react-aria-components";

type ComboBoxOption = { id: string; label: string };

type ComboBoxProps = Omit<
  AriaComboBoxProps<ComboBoxOption>,
  "children" | "items" | "defaultItems"
> & {
  label: string;
  options: ComboBoxOption[];
  placeholder?: string;
  errorMessage?: string;
};

/** A text field with suggestions. Set `allowsCustomValue` for free text. */
export function ComboBox({
  label,
  options,
  placeholder,
  errorMessage,
  className = "",
  ...props
}: ComboBoxProps) {
  return (
    <AriaComboBox
      menuTrigger="focus"
      {...props}
      defaultItems={options}
      isInvalid={props.isInvalid ?? Boolean(errorMessage)}
      className={`grid gap-2 ${className}`}
    >
      <Label className="text-sm font-medium">{label}</Label>
      <Input
        className="min-h-10 rounded-card border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted"
        placeholder={placeholder}
      />
      {errorMessage ? (
        <Text slot="errorMessage" className="text-sm font-medium">
          {errorMessage}
        </Text>
      ) : null}
      <Popover className="w-[var(--trigger-width)] rounded-card border border-border bg-background p-1 shadow-lg">
        <ListBox<ComboBoxOption> className="outline-none">
          {(option) => (
            <ListBoxItem
              id={option.id}
              textValue={option.label}
              className="cursor-default rounded px-3 py-2 text-sm outline-none data-[focused]:bg-surface"
            >
              {option.label}
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </AriaComboBox>
  );
}
