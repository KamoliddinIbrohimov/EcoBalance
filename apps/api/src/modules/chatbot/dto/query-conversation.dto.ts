import { conversationQuerySchema } from '@eco/shared';
import { createZodDto } from 'nestjs-zod';

export class QueryConversationDto extends createZodDto(conversationQuerySchema) {}
