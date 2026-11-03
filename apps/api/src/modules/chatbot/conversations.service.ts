import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { AiConversationDetailDto, AiConversationSummaryDto, AiMessageDto, ConversationQuery } from '@eco/shared';

import { pageArgs, toPage } from '../../common/http/pagination';
import { PrismaService } from '../../infra/prisma.service';

export const SUMMARY_SELECT = {
  id: true,
  title: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { messages: true } },
} satisfies Prisma.AiConversationSelect;

export const MESSAGE_SELECT = {
  id: true,
  conversationId: true,
  role: true,
  content: true,
  createdAt: true,
} satisfies Prisma.AiMessageSelect;

type SummaryRow = Prisma.AiConversationGetPayload<{ select: typeof SUMMARY_SELECT }>;
type MessageRow = Prisma.AiMessageGetPayload<{ select: typeof MESSAGE_SELECT }>;

export function toSummaryDto(row: SummaryRow): AiConversationSummaryDto {
  return {
    id: row.id,
    title: row.title,
    messageCount: row._count.messages,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toMessageDto(row: MessageRow): AiMessageDto {
  return { ...row, createdAt: row.createdAt.toISOString() };
}

/** Suhbatlar faqat egasiga ko'rinadi; begonasi — 404. */
@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, q: ConversationQuery) {
    const { page, perPage, skip, take } = pageArgs(q);
    const where: Prisma.AiConversationWhereInput = {
      userId,
      title: q.search ? { contains: q.search, mode: 'insensitive' } : undefined,
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.aiConversation.count({ where }),
      this.prisma.aiConversation.findMany({ where, select: SUMMARY_SELECT, orderBy: { updatedAt: 'desc' }, skip, take }),
    ]);
    return toPage(rows.map(toSummaryDto), total, page, perPage);
  }

  async create(userId: string, title?: string) {
    const row = await this.prisma.aiConversation.create({
      data: { userId, title: title?.trim() || 'Yangi suhbat' },
      select: SUMMARY_SELECT,
    });
    return toSummaryDto(row);
  }

  async detail(userId: string, id: string): Promise<AiConversationDetailDto> {
    const row = await this.prisma.aiConversation.findFirst({
      where: { id, userId },
      select: {
        ...SUMMARY_SELECT,
        messages: { select: MESSAGE_SELECT, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
      },
    });
    if (!row) throw new NotFoundException('Suhbat topilmadi');
    return { ...toSummaryDto(row), messages: row.messages.map(toMessageDto) };
  }

  async remove(userId: string, id: string) {
    const { count } = await this.prisma.aiConversation.deleteMany({ where: { id, userId } });
    if (count === 0) throw new NotFoundException('Suhbat topilmadi');
  }

  async assertOwned(userId: string, id: string) {
    const row = await this.prisma.aiConversation.findFirst({ where: { id, userId }, select: { id: true } });
    if (!row) throw new NotFoundException('Suhbat topilmadi');
  }

  /** AI'ga yuboriladigan so'nggi xabarlar (eskidan yangiga). */
  async recentTurns(conversationId: string, limit: number) {
    const rows = await this.prisma.aiMessage.findMany({
      where: { conversationId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
      select: { role: true, content: true },
    });
    return rows.reverse();
  }
}
