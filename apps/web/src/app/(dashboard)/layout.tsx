import type { ReactNode } from 'react';

import { AiChatbotWidget } from '@/features/dashboard/components/ai-chatbot-widget';
import { SidebarNav } from '@/shared/components/layout/sidebar-nav';
import { Topbar } from '@/shared/components/layout/topbar';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <SidebarNav />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-x-hidden p-6 md:p-8">{children}</main>
        <footer className="border-t border-border/60 bg-card py-3 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Eco-Balance Platformasi. Barcha huquqlar himoyalangan.
        </footer>
      </div>

      {/* Floating chat launcher — pinned to the viewport, never scrolls */}
      <AiChatbotWidget />
    </div>
  );
}
