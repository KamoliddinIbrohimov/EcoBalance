import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ChatbotService } from './chatbot.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { QueryConversationDto } from './dto/query-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';

@ApiTags('Chatbot')
@ApiBearerAuth('access-token')
@Controller({ path: 'chatbot', version: '1' })
export class ChatbotController {
  constructor(private readonly chatbot: ChatbotService) {}

  @Get('conversations')
  @ApiOperation({ summary: 'Foydalanuvchining barcha suhbatlari (yangilanish bo‘yicha tartiblangan)' })
  async list(
    @CurrentUser('id') userId: string,
    @Query() query: QueryConversationDto,
  ) {
    return this.chatbot.listConversations(userId, query);
  }

  @Post('conversations')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Yangi bo‘sh suhbat yaratish' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateConversationDto,
  ) {
    return this.chatbot.createConversation(userId, dto.title);
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Suhbatni to‘liq xabarlar bilan olish' })
  async detail(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.chatbot.getConversation(userId, id);
  }

  @Delete('conversations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Suhbatni o‘chirish (faqat egasi)' })
  async remove(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.chatbot.removeConversation(userId, id);
  }

  /**
   * Send a message. If `:id` is provided, appends to that conversation;
   * otherwise a new conversation is created (title derived from the first
   * message). Uses the `chatbot` throttler bucket so AI-token spend can be
   * rate-limited independently of the default bucket.
   */
  @Post('conversations/:id/messages')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ chatbot: { limit: Number(process.env.RATE_LIMIT_CHATBOT ?? 20), ttl: 60_000 } })
  @ApiOperation({ summary: 'Suhbatga yangi xabar yuborish (AI javob bilan)' })
  async sendToConversation(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatbot.sendMessage(userId, id, dto.content);
  }

  @Post('messages')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ chatbot: { limit: Number(process.env.RATE_LIMIT_CHATBOT ?? 20), ttl: 60_000 } })
  @ApiOperation({
    summary: 'Yangi suhbat ochib xabar yuborish (birinchi xabardan sarlavha olinadi)',
  })
  async sendNew(
    @CurrentUser('id') userId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatbot.sendMessage(userId, null, dto.content);
  }
}
