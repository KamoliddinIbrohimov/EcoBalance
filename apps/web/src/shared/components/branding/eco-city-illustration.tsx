import type { SVGProps } from 'react';

import { cn } from '@/shared/lib/cn';

/**
 * Detailed "green city" illustration used in the dashboard welcome hero.
 * Layered composition: three wind turbines behind a green skyscraper skyline,
 * a soft rolling foreground with trees and shrubs, and two birds in the sky.
 *
 * Rendered as inline SVG (no HTTP request, scales with the container).
 */
export function EcoCityIllustration({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 800 320"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      className={cn('h-32 w-full md:h-40', className)}
      {...props}
    >
      <defs>
        <linearGradient id="ec-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#F0FDF4" />
        </linearGradient>
        <linearGradient id="ec-hill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#A7F3D0" />
          <stop offset="100%" stopColor="#4ADE80" />
        </linearGradient>
        <linearGradient id="ec-building-a" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#86EFAC" />
          <stop offset="100%" stopColor="#22C55E" />
        </linearGradient>
        <linearGradient id="ec-building-b" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#BBF7D0" />
          <stop offset="100%" stopColor="#4ADE80" />
        </linearGradient>
        <linearGradient id="ec-building-c" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4ADE80" />
          <stop offset="100%" stopColor="#166534" />
        </linearGradient>
        <linearGradient id="ec-tree" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4ADE80" />
          <stop offset="100%" stopColor="#166534" />
        </linearGradient>
      </defs>

      {/* soft sky */}
      <rect x="0" y="0" width="800" height="320" fill="url(#ec-sky)" />

      {/* birds */}
      <g fill="none" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round">
        <path d="M110 60 q6 -6 12 0 q6 -6 12 0" />
        <path d="M150 40 q4 -4 8 0 q4 -4 8 0" />
        <path d="M660 60 q6 -6 12 0 q6 -6 12 0" />
      </g>

      {/* far background turbines */}
      <TurbineFar cx={230} cy={140} height={70} />
      <TurbineFar cx={720} cy={130} height={85} />

      {/* skyline (back row, lighter) */}
      <g fill="url(#ec-building-b)" opacity="0.75">
        <rect x="150" y="200" width="34" height="60" rx="2" />
        <rect x="188" y="180" width="30" height="80" rx="2" />
        <rect x="222" y="210" width="24" height="50" rx="2" />
        <rect x="470" y="190" width="30" height="70" rx="2" />
        <rect x="504" y="170" width="28" height="90" rx="2" />
        <rect x="536" y="200" width="24" height="60" rx="2" />
        <rect x="620" y="200" width="34" height="60" rx="2" />
        <rect x="658" y="180" width="28" height="80" rx="2" />
      </g>

      {/* skyline (mid row) */}
      <g fill="url(#ec-building-a)">
        <rect x="256" y="150" width="42" height="115" rx="3" />
        <BuildingWindows x={256} y={165} w={42} rows={7} cols={3} color="#DCFCE7" />

        <rect x="304" y="130" width="40" height="135" rx="3" />
        <BuildingWindows x={304} y={145} w={40} rows={8} cols={3} color="#DCFCE7" />

        <rect x="350" y="110" width="46" height="155" rx="3" />
        <BuildingWindows x={350} y={125} w={46} rows={10} cols={3} color="#F0FDF4" />

        <rect x="402" y="90"  width="30" height="175" rx="3" />
        {/* antenna */}
        <path d="M417 82 v-16" stroke="#166534" strokeWidth="2" />
        <BuildingWindows x={402} y={105} w={30} rows={12} cols={2} color="#DCFCE7" />

        <rect x="440" y="140" width="34" height="125" rx="3" />
        <BuildingWindows x={440} y={155} w={34} rows={8} cols={2} color="#DCFCE7" />
      </g>

      {/* skyline (front row, darker for depth) */}
      <g fill="url(#ec-building-c)">
        <rect x="566" y="160" width="42" height="105" rx="3" />
        <BuildingWindows x={566} y={175} w={42} rows={7} cols={3} color="#BBF7D0" opacity={0.55} />

        <rect x="612" y="140" width="34" height="125" rx="3" />
        <BuildingWindows x={612} y={155} w={34} rows={8} cols={2} color="#BBF7D0" opacity={0.55} />

        <rect x="694" y="150" width="46" height="115" rx="3" />
        <path d="M717 142 v-14" stroke="#14532D" strokeWidth="2" />
        <BuildingWindows x={694} y={165} w={46} rows={7} cols={3} color="#BBF7D0" opacity={0.55} />
      </g>

      {/* rolling hill */}
      <path
        d="M-10 260
           C 120 236, 240 250, 400 244
           C 560 238, 680 254, 810 236
           L 810 320 L -10 320 Z"
        fill="url(#ec-hill)"
      />

      {/* trees on the hill (front-most, dark and clean) */}
      <g>
        <Tree x={80}  y={264} scale={1}   />
        <Tree x={150} y={272} scale={0.7} />
        <Tree x={200} y={264} scale={1.1} />
        <Tree x={260} y={268} scale={0.9} />
        <Tree x={320} y={262} scale={1.2} />
        <Tree x={380} y={266} scale={0.8} />
        <Tree x={445} y={260} scale={1.15}/>
        <Tree x={520} y={266} scale={0.9} />
        <Tree x={588} y={262} scale={1.05}/>
        <Tree x={648} y={268} scale={0.75}/>
        <Tree x={700} y={262} scale={1}   />
        <Tree x={760} y={268} scale={0.85}/>
      </g>

      {/* small foreground shrubs */}
      <g fill="#22C55E">
        <ellipse cx="120" cy="292" rx="14" ry="6" />
        <ellipse cx="235" cy="296" rx="10" ry="5" />
        <ellipse cx="410" cy="292" rx="16" ry="6" />
        <ellipse cx="565" cy="294" rx="12" ry="5" />
        <ellipse cx="720" cy="295" rx="14" ry="6" />
      </g>
    </svg>
  );
}

/* --- small helpers ---------------------------------------------------- */

function TurbineFar({ cx, cy, height }: { cx: number; cy: number; height: number }) {
  const bladeLen = height * 0.35;
  return (
    <g stroke="#22C55E" strokeWidth="1.8" strokeLinecap="round" fill="none">
      <line x1={cx} y1={cy} x2={cx} y2={cy + height} />
      <circle cx={cx} cy={cy} r="2.5" fill="#22C55E" />
      {/* three blades */}
      <line x1={cx} y1={cy} x2={cx} y2={cy - bladeLen} />
      <line x1={cx} y1={cy} x2={cx + bladeLen * 0.87} y2={cy + bladeLen * 0.5} />
      <line x1={cx} y1={cy} x2={cx - bladeLen * 0.87} y2={cy + bladeLen * 0.5} />
    </g>
  );
}

function Tree({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  const w = 26 * scale;
  const h = 34 * scale;
  return (
    <g transform={`translate(${x - w / 2}, ${y - h})`}>
      {/* canopy */}
      <path
        d={`M${w / 2} 0
            C ${w * 0.9} ${h * 0.15}, ${w * 1} ${h * 0.55}, ${w * 0.75} ${h * 0.75}
            C ${w * 0.6} ${h * 0.85}, ${w * 0.4} ${h * 0.85}, ${w * 0.25} ${h * 0.75}
            C 0 ${h * 0.55}, ${w * 0.1} ${h * 0.15}, ${w / 2} 0 Z`}
        fill="url(#ec-tree)"
      />
      {/* trunk */}
      <rect x={w / 2 - 1.4} y={h * 0.7} width="2.8" height={h * 0.3} fill="#166534" />
      {/* subtle vein */}
      <path
        d={`M${w / 2} ${h * 0.1} L${w / 2} ${h * 0.75}`}
        stroke="#166534"
        strokeWidth="1"
        opacity="0.4"
      />
    </g>
  );
}

function BuildingWindows({
  x,
  y,
  w,
  rows,
  cols,
  color,
  opacity = 0.75,
}: {
  x: number;
  y: number;
  w: number;
  rows: number;
  cols: number;
  color: string;
  opacity?: number;
}) {
  const winW = (w - (cols + 1) * 3) / cols;
  const winH = 6;
  const gapY = 4;
  const items: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const wx = x + 3 + c * (winW + 3);
      const wy = y + r * (winH + gapY);
      items.push(
        <rect key={`${r}-${c}`} x={wx} y={wy} width={winW} height={winH} fill={color} opacity={opacity} rx={0.8} />,
      );
    }
  }
  return <g>{items}</g>;
}
