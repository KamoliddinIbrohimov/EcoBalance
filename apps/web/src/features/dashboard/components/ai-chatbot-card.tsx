import { Bot, MessageSquare } from 'lucide-react';
import Link from 'next/link';

import { Card } from '@/shared/components/ui/card';

export function AiChatbotCard() {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-3 border-b border-border/60 bg-secondary/40 px-5 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Bot className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold text-foreground">AI Chatbot</span>
      </div>
      <div className="space-y-4 p-5">
        <div className="rounded-2xl rounded-tl-sm bg-secondary/60 p-3 text-sm text-foreground">
          Salom! Sizga qanday yordam bera olaman?
        </div>
        <Link
          href="/chatbot"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          Chatni boshlash
          <MessageSquare className="h-4 w-4" />
        </Link>
      </div>
    </Card>
  );
}
