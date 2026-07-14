import { FlaskConical } from 'lucide-react';

/**
 * Small badge that reminds viewers all dashboard numbers are mock.
 * Removed when real endpoints ship in Phase 3.
 */
export function TestModeBanner() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-warning/30 bg-warning-soft px-4 py-3 shadow-card">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning">
        <FlaskConical className="h-4 w-4" strokeWidth={2.25} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-foreground">TEST REJIM</div>
        <p className="text-xs text-muted-foreground">
          Dashboard&apos;dagi barcha raqamlar — namunaviy ma&apos;lumotlar. Real ma&apos;lumotlar Phase 3&apos;da IoT
          va monitoring modullarining ishga tushishi bilan ulanadi.
        </p>
      </div>
    </div>
  );
}
