'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';

export interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

interface PaginationBarProps {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
  itemLabel?: string;
}

export function PaginationBar({ meta, onPageChange, itemLabel = 'ta natija' }: PaginationBarProps) {
  const { page, totalPages, total } = meta;
  if (total === 0) return null;

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-border/60 px-4 py-3 sm:flex-row">
      <p className="text-sm text-muted-foreground">
        Jami <span className="font-medium text-foreground">{total}</span> {itemLabel} —{' '}
        {page}-sahifa / {totalPages}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
          Oldingi
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Keyingi
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
