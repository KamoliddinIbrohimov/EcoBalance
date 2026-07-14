import type { ReactNode } from 'react';

import { Logo } from '@/shared/components/layout/logo';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand side */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-primary/95 via-primary to-primary/85 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="rounded-2xl bg-white/95 p-4 backdrop-blur">
          <Logo />
        </div>

        <div className="max-w-md text-primary-foreground">
          <p className="text-2xl font-semibold leading-snug">
            &ldquo;Tabiatni asrash — kelajakni asrash demakdir&rdquo;
          </p>
          <p className="mt-6 text-sm text-primary-foreground/80">
            Ekologik monitoring, ta&apos;lim va tahlil — hammasi bitta platformada.
          </p>
        </div>

        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
      </div>

      {/* Form side */}
      <div className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
