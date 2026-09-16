import { sendMessageSchema } from '@eco/shared';
import { createZodDto } from 'nestjs-zod';

export class SendMessageDto extends createZodDto(sendMessageSchema) {}
