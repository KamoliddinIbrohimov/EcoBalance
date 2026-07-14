import Image from 'next/image';

import { cn } from '@/shared/lib/cn';

interface LogoProps {
  className?: string;
  showTagline?: boolean;
}

/**
 * Brand logo. Loads `/logo.png` from `apps/web/public/`.
 * Drop your logo file (PNG, SVG or WEBP) at that path — no code changes needed.
 * The image is rendered inside a light-green rounded tile so it stays legible
 * on light/dark sidebars.
 */
export function Logo({ className, showTagline = true }: LogoProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary-soft">
        <Image
          src="/logo.png"
          alt="Eco-Balance logo"
          width={56}
          height={56}
          className="h-12 w-12 object-contain"
          priority
        />
      </div>
      <div className="min-w-0">
        <div className="text-xl font-bold leading-tight tracking-tight text-primary">
          ECO-BALANCE
        </div>
        {showTagline ? (
          <div className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
            Ekologik monitoring va<br />uzluksiz ta&apos;lim platformasi
          </div>
        ) : null}
      </div>
    </div>
  );
}
