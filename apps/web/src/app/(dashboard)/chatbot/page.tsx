'use client';

import type { AiConversationSummaryDto } from '@eco/shared';
import { Bot, Loader2, MessageSquarePlus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { ChatThread } from '@/features/chatbot/components/chat-thread';
import {
  useConversation,
  useConversations,
  useCreateConversation,
  useRemoveConversation,
} from '@/features/chatbot/hooks/use-chatbot';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { ConfirmDialog } from '@/shared/components/ui/confirm-dialog';
import { cn } from '@/shared/lib/cn';

const DATE_FMT = new Intl.DateTimeFormat('uz-UZ', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export default function ChatbotPage() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AiConversationSummaryDto | null>(null);
  const [mobileListOpen, setMobileListOpen] = useState(false);

  const { data: list, isLoading: listLoading } = useConversations({ perPage: 50 });
  const conversations = useMemo(() => list?.data ?? [], [list]);
  const { data: active } = useConversation(activeId);
  const createConversation = useCreateConversation();
  const removeConversation = useRemoveConversation();

  useEffect(() => {
    if (!activeId && conversations.length > 0) {
      setActiveId(conversations[0]?.id ?? null);
    }
    if (activeId && !conversations.find((c) => c.id === activeId)) {
      setActiveId(conversations[0]?.id ?? null);
    }
  }, [activeId, conversations]);

  async function handleNewChat() {
    setActiveId(null);
    setMobileListOpen(false);
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    await removeConversation.mutateAsync(pendingDelete.id);
    if (activeId === pendingDelete.id) setActiveId(null);
    setPendingDelete(null);
  }

  return (
    <div className="flex h-[calc(100vh-10rem)] min-h-[520px] flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">AI Chatbot</h1>
        <p className="text-sm text-muted-foreground">
          Ekologiya, kurslar va platforma bo‘yicha savollaringizga AI yordamchi javob beradi.
          Suhbatlaringiz saqlanadi.
        </p>
      </header>

      <div className="flex flex-1 flex-col gap-4 md:flex-row">
        <div className="md:hidden">
          <Button variant="outline" onClick={() => setMobileListOpen((v) => !v)}>
            {mobileListOpen ? 'Yopish' : `Suhbatlar (${conversations.length})`}
          </Button>
        </div>

        {/* Left panel — conversations list */}
        <Card
          className={cn(
            'flex flex-col overflow-hidden p-0',
            'md:w-72 md:shrink-0',
            mobileListOpen ? 'flex' : 'hidden md:flex',
          )}
        >
          <div className="border-b border-border/60 p-3">
            <Button
              type="button"
              onClick={handleNewChat}
              disabled={createConversation.isPending}
              className="w-full justify-center"
            >
              <MessageSquarePlus className="h-4 w-4" />
              Yangi suhbat
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {listLoading ? (
              <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-muted-foreground">
                Hozircha suhbatlar yo‘q. Yangi suhbat boshlang.
              </div>
            ) : (
              <ul className="space-y-1 p-2">
                {conversations.map((c) => (
                  <li key={c.id}>
                    <div
                      className={cn(
                        'group flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors',
                        activeId === c.id
                          ? 'bg-primary/10 text-foreground'
                          : 'hover:bg-secondary',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setActiveId(c.id);
                          setMobileListOpen(false);
                        }}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="truncate font-medium">{c.title}</div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">
                          {DATE_FMT.format(new Date(c.updatedAt))} · {c.messageCount} xabar
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(c)}
                        aria-label="O‘chirish"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-colors hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        {/* Right panel — active thread */}
        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
          <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Bot className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-foreground">
                {active?.title ?? 'Yangi suhbat'}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {active
                  ? `${active.messageCount} xabar · yangilangan ${DATE_FMT.format(new Date(active.updatedAt))}`
                  : 'Xabar yozib, yangi suhbatni boshlang'}
              </div>
            </div>
          </div>

          <ChatThread
            conversationId={activeId}
            messages={active?.messages ?? []}
            onConversationCreated={(id) => setActiveId(id)}
            className="min-h-0 flex-1"
            messagesClassName="flex-1"
            hint="Enter yuboradi · Shift+Enter — yangi qator"
          />
        </Card>
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={`«${pendingDelete?.title ?? ''}» suhbatini o‘chirasizmi?`}
        description="Bu suhbatdagi barcha xabarlar butunlay o‘chiriladi. Bu amalni orqaga qaytarib bo‘lmaydi."
        confirmLabel="Ha, o‘chirish"
        loading={removeConversation.isPending}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
