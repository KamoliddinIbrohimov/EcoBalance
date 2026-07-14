import { Droplets, Leaf, Recycle, TreePine, Users, Wind } from 'lucide-react';

import { KpiCard } from '@/shared/components/dashboard/kpi-card';
import { KPIS } from '../data/mock';

const META = {
  ecoIndex:        { label: 'Ekologik indeks',         icon: Leaf,     tone: 'primary' as const },
  airQuality:      { label: 'Havo sifati (PM2.5)',     icon: Wind,     tone: 'muted' as const },
  waterQuality:    { label: 'Suv sifati',              icon: Droplets, tone: 'blue' as const },
  wasteRecycling:  { label: 'Chiqindi qayta ishlash',  icon: Recycle,  tone: 'primary' as const },
  greenAreas:      { label: 'Yashil hududlar',         icon: TreePine, tone: 'primary' as const },
  citizenActivity: { label: 'Aholi ekologik faolligi', icon: Users,    tone: 'primary' as const },
};

const STATUS_LABEL = {
  good:   'Yaxshi',
  medium: "O'rta",
  bad:    'Yomon',
};

export function KpiGrid() {
  return (
    <section
      aria-label="Ekologik indekslar"
      className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6"
    >
      {KPIS.map((k) => {
        const meta = META[k.key];
        return (
          <KpiCard
            key={k.key}
            icon={meta.icon}
            iconColor={meta.tone}
            label={meta.label}
            value={k.value}
            unit={k.unit}
            status={{ variant: k.status, label: STATUS_LABEL[k.status] }}
          />
        );
      })}
    </section>
  );
}
