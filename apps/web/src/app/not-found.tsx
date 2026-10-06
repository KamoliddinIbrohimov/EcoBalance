import Link from 'next/link';

/**
 * Root-level 404. Must stay a plain Server Component with no next-intl /
 * client dependencies — otherwise Next.js 15's static /404 prerender fails
 * with "<Html> should not be imported outside pages/_document".
 */
export default function RootNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card p-8 text-center shadow-card">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-warning-soft text-warning">
          <span className="text-2xl font-bold">404</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Sahifa topilmadi
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Siz qidirgan sahifa mavjud emas yoki ko&apos;chirilgan.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          Bosh sahifaga qaytish
        </Link>
      </div>
    </div>
  );
}
