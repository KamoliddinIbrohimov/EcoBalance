import { Injectable } from '@nestjs/common';
import type { AiMessageRole } from '@prisma/client';
import type { SendMessageResponse } from '@eco/shared';

import { PrismaService } from '../../infra/prisma.service';
import { AiService } from './ai.service';
import { buildSystemPrompt, cannedReply, deriveTitle } from './assistant-replies';
import { ConversationsService, MESSAGE_SELECT, SUMMARY_SELECT, toMessageDto, toSummaryDto } from './conversations.service';
import { KnowledgeService } from './knowledge.service';
import type { AiTurn } from './providers/ai-provider';

/** AI'ga yuboriladigan tarix chegarasi (token sarfi suhbat uzunligiga bog'liq bo'lmasin). */
const HISTORY_LIMIT = 20;

/** Ketma-ket bir xil rolli xabarlarni birlashtiradi va boshidagi assistant xabarlarini tashlaydi. */
function toTurns(rows: Array<{ role: AiMessageRole; content: string }>): AiTurn[] {
  const turns: AiTurn[] = [];
  for (const r of rows) {
    const role = r.role === 'USER' ? 'user' : 'assistant';
    const prev = turns[turns.length - 1];
    if (!prev && role === 'assistant') continue;
    if (prev?.role === role) prev.content += `\n\n${r.content}`;
    else turns.push({ role, content: r.content });
  }
  return turns;
}

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly conversations: ConversationsService,
    private readonly knowledge: KnowledgeService,
    private readonly ai: AiService,
  ) {}

  /**
   * Avval AI javobi olinadi, keyin savol va javob bitta tranzaksiyada
   * yoziladi: AI xatosida yetim suhbat yoki javobsiz savol qolmaydi.
   */
  async send(userId: string, conversationId: string | null, content: string): Promise<SendMessageResponse> {
    const askedAt = new Date();
    if (conversationId) await this.conversations.assertOwned(userId, conversationId);

    let reply = { text: cannedReply(content) ?? '', tokens: 0 };
    if (!reply.text) {
      const cfg = await this.ai.ready();
      const [chunks, prior] = await Promise.all([
        this.knowledge.search(content),
        conversationId ? this.conversations.recentTurns(conversationId, HISTORY_LIMIT) : [],
      ]);
      const history = toTurns([...prior, { role: 'USER', content }]);
      reply = await this.ai.complete(cfg, buildSystemPrompt(cfg.systemPrompt, chunks), history);
    }

    // Bir xil vaqt belgisi tartibni buzmasin: javob har doim savoldan keyin.
    const answeredAt = new Date(Math.max(Date.now(), askedAt.getTime() + 1));
    return this.prisma.$transaction(async (tx) => {
      const id =
        conversationId ??
        (await tx.aiConversation.create({ data: { userId, title: deriveTitle(content) }, select: { id: true } })).id;
      const userMessage = await tx.aiMessage.create({
        data: { conversationId: id, role: 'USER', content, createdAt: askedAt },
        select: MESSAGE_SELECT,
      });
      const assistantMessage = await tx.aiMessage.create({
        data: { conversationId: id, role: 'ASSISTANT', content: reply.text, tokens: reply.tokens, createdAt: answeredAt },
        select: MESSAGE_SELECT,
      });
      // Suhbat ro'yxatda tepaga chiqsin; AI kutilayotganda o'chirilgan bo'lsa P2025 → 404.
      const conversation = await tx.aiConversation.update({
        where: { id },
        data: { updatedAt: answeredAt },
        select: SUMMARY_SELECT,
      });
      return {
        conversation: toSummaryDto(conversation),
        userMessage: toMessageDto(userMessage),
        assistantMessage: toMessageDto(assistantMessage),
      };
    });
  }
}
