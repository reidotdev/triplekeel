"use client";

import {
  RadioGroup as AriaRadioGroup,
  type RadioGroupProps as AriaRadioGroupProps,
  Label,
  Radio,
  Text,
} from "react-aria-components";

type RadioOption = { id: string; label: string };

type RadioGroupProps = Omit<AriaRadioGroupProps, "children"> & {
  label: string;
  options: RadioOption[];
  errorMessage?: string;
};

export function RadioGroup({
  label,
  options,
  errorMessage,
  className = "",
  ...props
}: RadioGroupProps) {
  return (
    <AriaRadioGroup
      {...props}
      isInvalid={props.isInvalid ?? Boolean(errorMessage)}
      className={`grid gap-2 ${className}`}
    >
      <Label className="text-sm font-medium">{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Radio
            key={option.id}
            value={option.id}
            className="inline-flex min-h-10 cursor-default items-center rounded-card border border-border bg-background px-4 py-2 text-sm data-[focus-visible]:outline-2 data-[focus-visible]:outline-offset-2 data-[focus-visible]:outline-focus data-[hovered]:bg-surface data-[selected]:border-primary data-[selected]:bg-primary data-[selected]:text-primary-foreground data-[disabled]:opacity-50"
          >
            {option.label}
          </Radio>
        ))}
      </div>
      {errorMessage ? (
        <Text slot="errorMessage" className="text-sm font-medium">
          {errorMessage}
        </Text>
      ) : null}
    </AriaRadioGroup>
  );
}
