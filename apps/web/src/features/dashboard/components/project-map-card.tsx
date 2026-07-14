'use client';

import { Building2, GraduationCap, Home, Loader2, MapPin } from 'lucide-react';
import dynamic from 'next/dynamic';

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';

const ProjectMapInner = dynamic(() => import('./project-map-inner'), {
  ssr: false,
  loading: () => (
    <div className="flex h-72 items-center justify-center rounded-xl bg-secondary/40 text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Xarita yuklanmoqda…
    </div>
  ),
});

/**
 * Real interactive map: OpenStreetMap tiles + mahalla polygons + school/kg/univ markers.
 * Loaded client-side only (Leaflet needs `window`).
 */
export function ProjectMapCard() {
  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Loyiha hududi xaritasi</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 pt-0">
        <div className="relative h-full min-h-[240px] overflow-hidden rounded-xl border border-border/60">
          <div className="absolute inset-0">
            <ProjectMapInner />
          </div>
          <MapLegend />
        </div>
      </CardContent>
    </Card>
  );
}

function MapLegend() {
  return (
    <div className="pointer-events-none absolute right-3 top-3 rounded-xl bg-white/95 p-3 text-xs shadow-card backdrop-blur">
      <ul className="space-y-1.5">
        <li className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white">
            <Building2 className="h-3 w-3" />
          </span>
          <span className="font-medium text-foreground">15 ta maktab</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-warning text-white">
            <Home className="h-3 w-3" />
          </span>
          <span className="font-medium text-foreground">1 ta bog&apos;cha</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[hsl(262_83%_58%)] text-white">
            <GraduationCap className="h-3 w-3" />
          </span>
          <span className="font-medium text-foreground">ChDPU</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white">
            <MapPin className="h-3 w-3" />
          </span>
          <span className="text-foreground">Kimyogar mahallasi</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-white">
            <MapPin className="h-3 w-3" />
          </span>
          <span className="text-foreground">Abay mahallasi</span>
        </li>
      </ul>
    </div>
  );
}
