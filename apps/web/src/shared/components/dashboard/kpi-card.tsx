import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/shared/lib/cn';
import { StatusDot } from '@/shared/components/ui/status-dot';

interface KpiCardProps {
  icon: LucideIcon;
  iconColor?: 'primary' | 'blue' | 'purple' | 'warning' | 'danger' | 'muted';
  label: string;
  value: ReactNode;
  unit?: string;
  status?: {
    variant: 'good' | 'medium' | 'bad';
    label: string;
  };
  className?: string;
}

const iconColorMap = {
  primary: 'bg-primary-soft text-primary',
  blue: 'bg-info-soft text-info',
  purple: 'bg-[hsl(269,100%,95%)] text-[hsl(262,83%,58%)]',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-destructive/10 text-destructive',
  muted: 'bg-secondary text-muted-foreground',
} as const;

export function KpiCard({
  icon: Icon,
  iconColor = 'primary',
  label,
  value,
  unit,
  status,
  className,
}: KpiCardProps) {
  return (
    <div className={cn('eco-card eco-card-hover flex flex-col gap-3', className)}>
      <div className="flex items-start gap-3">
        <div className={cn('eco-icon-circle shrink-0', iconColorMap[iconColor])}>
          <Icon className="h-5 w-5" strokeWidth={2.25} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-bold leading-none tracking-tight text-foreground">
              {value}
            </span>
            {unit ? (
              <span className="text-sm text-muted-foreground">{unit}</span>
            ) : null}
          </div>
        </div>
      </div>
      {status ? (
        <StatusDot variant={status.variant} label={status.label} />
      ) : null}
    </div>
  );
}
