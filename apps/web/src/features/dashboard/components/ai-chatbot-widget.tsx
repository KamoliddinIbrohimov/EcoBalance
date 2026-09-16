'use client';

import { Bot, ExternalLink, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { ChatThread } from '@/features/chatbot/components/chat-thread';
import { useConversation } from '@/features/chatbot/hooks/use-chatbot';
import { cn } from '@/shared/lib/cn';
import { useAuthStore } from '@/shared/stores/auth-store';

/**
 * Floating AI chatbot widget — fixed to the bottom-right corner of the viewport.
 * Collapsed: small round button with a chat icon. Expanded: chat panel that
 * lets the user talk to the AI directly. Shares state with the /chatbot page
 * via a per-widget conversation held in local state until submission.
 *
 * Sits above content via z-40; below the mobile drawer overlay (z-50).
 */
export function AiChatbotWidget() {
  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const accessToken = useAuthStore((s) => s.accessToken);

  const { data: conversation } = useConversation(open ? conversationId : null);
  const messages = conversation?.messages ?? [];

  const isAuthenticated = !!accessToken;

  return (
    <div className="pointer-events-none fixed bottom-3 right-3 z-40 flex flex-col items-end gap-3 md:bottom-6 md:right-6">
      {open ? (
        <div
          className={cn(
            'pointer-events-auto flex w-[calc(100vw-1.5rem)] max-w-[380px] flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-elevated',
            'h-[calc(100vh-6rem)] max-h-[calc(100vh-6rem)] sm:h-[520px]',
            'animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-3',
          )}
        >
          <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-primary px-4 py-3 text-primary-foreground">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-foreground/20">
                <Bot className="h-4 w-4" />
              </div>
              <div className="leading-tight">
                <div className="text-sm font-semibold">AI Chatbot</div>
                <div className="text-[11px] opacity-90">Onlayn · Doim yordamda</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Link
                href="/chatbot"
                onClick={() => setOpen(false)}
                aria-label="To‘liq chatga o‘tish"
                title="To‘liq chatga o‘tish"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-primary-foreground/90 transition-colors hover:bg-primary-foreground/15"
              >
                <ExternalLink className="h-4 w-4" />
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Yopish"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-primary-foreground/90 transition-colors hover:bg-primary-foreground/15"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {isAuthenticated ? (
            <ChatThread
              conversationId={conversationId}
              messages={messages}
              onConversationCreated={setConversationId}
              messagesClassName="flex-1"
              className="flex-1"
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft text-primary">
                <Bot className="h-5 w-5" />
              </div>
              <p className="text-sm text-muted-foreground">
                Chatdan foydalanish uchun iltimos, avval tizimga kiring.
              </p>
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="text-sm font-semibold text-primary hover:underline"
              >
                Kirish sahifasi
              </Link>
            </div>
          )}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'AI Chatbot ni yopish' : 'AI Chatbot ni ochish'}
        aria-expanded={open}
        className={cn(
          'pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-elevated transition-all sm:h-14 sm:w-14',
          'hover:bg-primary/90 hover:shadow-lg',
          open && 'rotate-90',
        )}
      >
        {open ? <X className="h-5 w-5 sm:h-6 sm:w-6" /> : <Bot className="h-5 w-5 sm:h-6 sm:w-6" />}
        {!open ? (
          <span className="pointer-events-none absolute -top-1 right-0 flex h-3 w-3 rounded-full bg-success ring-2 ring-card" />
        ) : null}
      </button>
    </div>
  );
}
