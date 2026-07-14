'use client';

import { Bot, MessageSquare, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { cn } from '@/shared/lib/cn';

/**
 * Floating AI chatbot widget — fixed to the bottom-right corner of the viewport.
 * Collapsed: small round button with a chat icon. Expanded: preview card with a
 * greeting bubble and "Chatni boshlash" CTA that navigates to the full chatbot page.
 *
 * Sits above content via z-40; below the mobile drawer overlay (z-50) so opening
 * the sidebar drawer visually pushes the chatbot behind.
 */
export function AiChatbotWidget() {
  const [open, setOpen] = useState(false);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-40 flex flex-col items-end gap-3 md:bottom-6 md:right-6">
      {open ? (
        <div
          className={cn(
            'pointer-events-auto w-[calc(100vw-2rem)] max-w-[340px] overflow-hidden rounded-2xl border border-border/60 bg-card shadow-elevated',
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
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Yopish"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-primary-foreground/90 transition-colors hover:bg-primary-foreground/15"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-4 p-5">
            <div className="flex items-start gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                <Bot className="h-4 w-4" />
              </div>
              <div className="rounded-2xl rounded-tl-sm bg-secondary/70 px-3 py-2 text-sm text-foreground">
                Salom! Sizga qanday yordam bera olaman?
              </div>
            </div>

            <Link
              href="/chatbot"
              onClick={() => setOpen(false)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              Chatni boshlash
              <MessageSquare className="h-4 w-4" />
            </Link>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'AI Chatbot ni yopish' : 'AI Chatbot ni ochish'}
        aria-expanded={open}
        className={cn(
          'pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-elevated transition-all',
          'hover:bg-primary/90 hover:shadow-lg',
          open && 'rotate-90',
        )}
      >
        {open ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
        {!open ? (
          <span className="pointer-events-none absolute -top-1 right-0 flex h-3 w-3 rounded-full bg-success ring-2 ring-card" />
        ) : null}
      </button>
    </div>
  );
}
