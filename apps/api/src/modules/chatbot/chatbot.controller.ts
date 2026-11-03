import { Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, UseFilters } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  type ConversationQuery,
  type CreateConversationInput,
  type SendMessageInput,
  conversationQuerySchema,
  createConversationSchema,
  sendMessageSchema,
} from '@eco/shared';

import { ZBody, ZQuery } from '../../common/http/zod.pipe';
import { type Actor, CurrentActor } from '../auth/actor';
import { AiUnavailableFilter } from './ai-unavailable';
import { ChatService } from './chat.service';
import { ConversationsService } from './conversations.service';

/** AI token sarfini cheklash — har foydalanuvchi IP'si uchun daqiqasiga 20 xabar. */
const MESSAGE_THROTTLE = { default: { limit: 20, ttl: 60_000 } };

@Controller('chatbot')
@UseFilters(AiUnavailableFilter)
export class ChatbotController {
  constructor(
    private readonly conversations: ConversationsService,
    private readonly chat: ChatService,
  ) {}

  @Get('conversations')
  list(@ZQuery(conversationQuerySchema) q: ConversationQuery, @CurrentActor() actor: Actor) {
    return this.conversations.list(actor.id, q);
  }

  @Get('conversations/:id')
  detail(@Param('id', ParseUUIDPipe) id: string, @CurrentActor() actor: Actor) {
    return this.conversations.detail(actor.id, id);
  }

  @Post('conversations')
  create(@ZBody(createConversationSchema.default({})) body: CreateConversationInput, @CurrentActor() actor: Actor) {
    return this.conversations.create(actor.id, body.title);
  }

  @Delete('conversations/:id')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentActor() actor: Actor) {
    await this.conversations.remove(actor.id, id);
  }

  @Post('conversations/:id/messages')
  @Throttle(MESSAGE_THROTTLE)
  send(
    @Param('id', ParseUUIDPipe) id: string,
    @ZBody(sendMessageSchema) body: SendMessageInput,
    @CurrentActor() actor: Actor,
  ) {
    return this.chat.send(actor.id, id, body.content);
  }

  /** Yangi suhbat ochib xabar yuborish (sarlavha birinchi xabardan). */
  @Post('messages')
  @Throttle(MESSAGE_THROTTLE)
  sendNew(@ZBody(sendMessageSchema) body: SendMessageInput, @CurrentActor() actor: Actor) {
    return this.chat.send(actor.id, null, body.content);
  }
}
