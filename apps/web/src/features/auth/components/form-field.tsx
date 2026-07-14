import type { InputHTMLAttributes, ReactNode } from 'react';
import { forwardRef } from 'react';

import { cn } from '@/shared/lib/cn';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: ReactNode;
}

export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(function FormField(
  { label, error, hint, id, className, ...inputProps },
  ref,
) {
  const inputId = id ?? inputProps.name;
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={inputId}>{label}</Label>
      <Input
        id={inputId}
        ref={ref}
        aria-invalid={!!error}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        className={cn(error && 'border-destructive focus-visible:ring-destructive')}
        {...inputProps}
      />
      {error ? (
        <p id={`${inputId}-error`} className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
