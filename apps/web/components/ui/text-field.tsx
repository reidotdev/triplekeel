"use client";

import {
  TextField as AriaTextField,
  type TextFieldProps as AriaTextFieldProps,
  Input,
  Label,
} from "react-aria-components";

type TextFieldProps = AriaTextFieldProps & {
  label: string;
  placeholder?: string;
};

export function TextField({
  label,
  placeholder,
  className = "",
  ...props
}: TextFieldProps) {
  return (
    <AriaTextField {...props} className={`grid gap-2 ${className}`}>
      <Label className="text-sm font-medium">{label}</Label>
      <Input
        className="min-h-10 rounded-card border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted"
        placeholder={placeholder}
      />
    </AriaTextField>
  );
}
