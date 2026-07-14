import type { SVGProps } from 'react';

import { cn } from '@/shared/lib/cn';

/**
 * Eco-Balance brand mark.
 *
 * Recreated from the reference logo: a central stem with four teardrop leaves
 * — one big upper-left, one small upper-center, one big right, one big lower-left.
 * Uses a light→dark green gradient and thin white veins inside each leaf so it
 * reads well at all sizes.
 */
export function EcoLeafMark({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 128 128"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      aria-hidden="true"
      className={cn('h-6 w-6', className)}
      {...props}
    >
      <defs>
        <linearGradient id="eco-leaf-grad" x1="20%" y1="10%" x2="90%" y2="95%">
          <stop offset="0%"   stopColor="#7BD34C" />
          <stop offset="45%"  stopColor="#4CAF3D" />
          <stop offset="100%" stopColor="#1F7A2A" />
        </linearGradient>
        <linearGradient id="eco-stem-grad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor="#4CAF3D" />
          <stop offset="100%" stopColor="#1F7A2A" />
        </linearGradient>
      </defs>

      {/* stem */}
      <path
        d="M64 118
           C 66 100, 66 86, 66 74
           C 66 60, 62 50, 60 42"
        stroke="url(#eco-stem-grad)"
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
      />

      {/* upper-left BIG leaf */}
      <path
        d="M60 42
           C 46 30, 32 32, 24 44
           C 20 56, 26 68, 40 74
           C 52 76, 60 66, 62 54
           C 62 50, 62 46, 60 42 Z"
        fill="url(#eco-leaf-grad)"
      />
      {/* vein */}
      <path
        d="M60 42 C 50 50, 40 62, 34 70"
        stroke="#ffffff"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        opacity="0.9"
      />

      {/* upper-center small leaf */}
      <path
        d="M66 38
           C 60 30, 60 20, 68 14
           C 76 20, 76 30, 70 38
           C 68 40, 66 40, 66 38 Z"
        fill="url(#eco-leaf-grad)"
      />
      <path
        d="M68 14 C 68 22, 68 30, 68 38"
        stroke="#ffffff"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
        opacity="0.9"
      />

      {/* right BIG leaf */}
      <path
        d="M70 48
           C 84 40, 100 44, 108 58
           C 108 72, 96 82, 82 82
           C 74 80, 68 72, 68 60
           C 68 54, 68 50, 70 48 Z"
        fill="url(#eco-leaf-grad)"
      />
      <path
        d="M70 48 C 82 56, 92 68, 100 76"
        stroke="#ffffff"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        opacity="0.9"
      />

      {/* lower-left BIG leaf */}
      <path
        d="M64 74
           C 46 68, 30 76, 24 92
           C 30 106, 46 108, 60 100
           C 66 94, 68 84, 66 78
           C 66 76, 65 74, 64 74 Z"
        fill="url(#eco-leaf-grad)"
      />
      <path
        d="M64 74 C 52 82, 42 92, 34 100"
        stroke="#ffffff"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        opacity="0.9"
      />
    </svg>
  );
}
