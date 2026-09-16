import { createConversationSchema } from '@eco/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateConversationDto extends createZodDto(createConversationSchema) {}
