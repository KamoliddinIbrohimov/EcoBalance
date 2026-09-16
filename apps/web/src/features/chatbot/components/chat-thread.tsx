'use client';

import type { AiMessageDto } from '@eco/shared';
import { CHATBOT_MESSAGE_MAX } from '@eco/shared';
import { Bot, Loader2, Send } from 'lucide-react';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';

import { cn } from '@/shared/lib/cn';

import { useSendMessage } from '../hooks/use-chatbot';

interface ChatThreadProps {
  conversationId: string | null;
  messages: AiMessageDto[];
  onConversationCreated?: (id: string) => void;
  emptyState?: React.ReactNode;
  className?: string;
  /** Height utility for the messages area — pass e.g. "h-96" or "flex-1". */
  messagesClassName?: string;
  /** Show the AI attribution line above the input. */
  hint?: string;
  disabled?: boolean;
}

export function ChatThread({
  conversationId,
  messages,
  onConversationCreated,
  emptyState,
  className,
  messagesClassName = 'flex-1',
  hint,
  disabled = false,
}: ChatThreadProps) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const send = useSendMessage();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const busy = send.isPending;

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, busy]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [draft]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy || disabled) return;
    const content = draft.trim();
    if (!content) return;
    if (content.length > CHATBOT_MESSAGE_MAX) {
      setError(`Xabar ${CHATBOT_MESSAGE_MAX} belgidan oshmasligi kerak`);
      return;
    }

    setError(null);
    setDraft('');
    try {
      const res = await send.mutateAsync({ conversationId, input: { content } });
      if (!conversationId && onConversationCreated) {
        onConversationCreated(res.conversation.id);
      }
    } catch (err) {
      const message =
        (err as { problem?: { detail?: string; title?: string } })?.problem?.detail ??
        (err as { problem?: { detail?: string; title?: string } })?.problem?.title ??
        'Xabarni yuborib bo‘lmadi';
      setError(message);
      setDraft(content);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSubmit(event as unknown as FormEvent);
    }
  }

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <div
        ref={scrollRef}
        className={cn(
          'min-h-0 space-y-3 overflow-y-auto px-4 py-4',
          messagesClassName,
        )}
      >
        {messages.length === 0 && !busy ? (
          emptyState ?? (
            <div className="flex h-full items-center justify-center px-6 text-center">
              <div className="max-w-sm space-y-2">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft text-primary">
                  <Bot className="h-5 w-5" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Salom! Sizga qanday yordam bera olaman? Savolingizni pastdagi maydonga yozing.
                </p>
              </div>
            </div>
          )
        ) : null}

        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {busy ? (
          <div className="flex items-start gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Bot className="h-4 w-4" />
            </div>
            <div className="rounded-2xl rounded-tl-sm bg-secondary/70 px-3 py-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Yozmoqda…
              </span>
            </div>
          </div>
        ) : null}
      </div>

      <form
        onSubmit={handleSubmit}
        className="border-t border-border/60 bg-card px-3 py-3"
      >
        {error ? (
          <div
            role="alert"
            className="mb-2 rounded-lg bg-destructive/10 px-3 py-1.5 text-xs text-destructive"
          >
            {error}
          </div>
        ) : null}
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Xabar yozing…"
            rows={1}
            disabled={busy || disabled}
            maxLength={CHATBOT_MESSAGE_MAX + 1}
            className="max-h-40 min-h-[40px] flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={busy || disabled || draft.trim().length === 0}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-50"
            aria-label="Yuborish"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
        {hint ? (
          <p className="mt-2 text-[11px] text-muted-foreground">{hint}</p>
        ) : null}
      </form>
    </div>
  );
}

function MessageBubble({ message }: { message: AiMessageDto }) {
  const isUser = message.role === 'USER';
  const shown = useTypewriter(message.content, !isUser);
  return (
    <div
      className={cn(
        'flex items-start gap-2.5',
        isUser ? 'flex-row-reverse text-right' : 'flex-row',
      )}
    >
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-primary-soft text-primary',
        )}
      >
        {isUser ? <span className="text-xs font-semibold">Siz</span> : <Bot className="h-4 w-4" />}
      </div>
      <div
        className={cn(
          'whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm',
          isUser
            ? 'rounded-tr-sm bg-primary/10 text-foreground'
            : 'rounded-tl-sm bg-secondary/70 text-foreground',
          'max-w-[85%]',
        )}
      >
        {shown}
        {!isUser && shown.length < message.content.length ? (
          <span className="ml-0.5 inline-block h-3.5 w-[2px] animate-pulse bg-primary align-middle" />
        ) : null}
      </div>
    </div>
  );
}

/**
 * Yozayotgan effekt — bot javob berganda matn belgi-belgi paydo bo'ladi.
 * Foydalanuvchi xabari uchun animatsiya ishlatilmaydi (darrov ko'rsatiladi).
 * "Yozib bo'lingan" xabar keyingi safar matn qayta yuklansa yana animatsiya
 * bo'lmasligi uchun: agar xabar ilk marta mount qilinganida to'liq bo'lsa,
 * animatsiyani o'tkazib yuboramiz (ya'ni "yangi" ekan-yo'qligini isMounted
 * bilan aniqlaymiz).
 */
function useTypewriter(fullText: string, enabled: boolean) {
  const [shown, setShown] = useState(() => (enabled ? '' : fullText));
  useEffect(() => {
    if (!enabled) {
      setShown(fullText);
      return;
    }
    // Har 15 ms da 2 ta belgi qo'shamiz — silliq va tez.
    setShown('');
    let i = 0;
    const step = 2;
    const timer = window.setInterval(() => {
      i = Math.min(i + step, fullText.length);
      setShown(fullText.slice(0, i));
      if (i >= fullText.length) {
        window.clearInterval(timer);
      }
    }, 15);
    return () => window.clearInterval(timer);
  }, [fullText, enabled]);
  return shown;
}
