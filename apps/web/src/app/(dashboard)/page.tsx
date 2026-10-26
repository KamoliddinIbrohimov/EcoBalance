import { HomeDirectionCards } from '@/features/dashboard/components/home-direction-cards';
import { HomeGreetingCard } from '@/features/dashboard/components/home-greeting-card';
import { HomeModulesGrid } from '@/features/dashboard/components/home-modules-grid';

export default function HomePage() {
  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6">
      <HomeGreetingCard />
      <HomeDirectionCards />
      <HomeModulesGrid />
    </div>
  );
}
