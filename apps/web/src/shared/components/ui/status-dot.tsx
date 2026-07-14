import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/shared/lib/cn';

const dotVariants = cva('inline-block h-2 w-2 rounded-full', {
  variants: {
    variant: {
      good: 'bg-success',
      medium: 'bg-warning',
      bad: 'bg-destructive',
      neutral: 'bg-muted-foreground',
    },
  },
  defaultVariants: { variant: 'good' },
});

export interface StatusDotProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof dotVariants> {
  label?: string;
}

export function StatusDot({ variant, label, className, ...props }: StatusDotProps) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs text-muted-foreground', className)} {...props}>
      <span className={dotVariants({ variant })} aria-hidden />
      {label ? <span>{label}</span> : null}
    </span>
  );
}
