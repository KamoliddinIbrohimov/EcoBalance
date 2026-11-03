/**
 * Dashboard sahifalari o'tishida darhol ko'rinadigan skelet. Usiz sidebar'da
 * bosilganda server javobi kelguncha ekran "qotib" turardi.
 */
export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Yuklanmoqda">
      <div className="space-y-2">
        <div className="h-7 w-56 rounded-lg bg-muted" />
        <div className="h-4 w-80 max-w-full rounded bg-muted/70" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="h-28 rounded-2xl border border-border/60 bg-card" />
        ))}
      </div>
      <div className="h-64 rounded-2xl border border-border/60 bg-card" />
    </div>
  );
}
