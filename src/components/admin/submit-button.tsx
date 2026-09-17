"use client";

import type { VariantProps } from "class-variance-authority";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

type SubmitButtonProps = VariantProps<typeof Button> &
  Omit<React.ComponentProps<"button">, "children"> & {
    children?: React.ReactNode;
    /** Content shown while the enclosing form is pending. */
    pendingLabel?: React.ReactNode;
  };

/** Submit button that reflects the enclosing form's pending state. */
export function SubmitButton({
  children,
  pendingLabel,
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} {...props}>
      {pending ? (pendingLabel ?? "Saving…") : children}
    </Button>
  );
}
