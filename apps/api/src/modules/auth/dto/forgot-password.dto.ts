import { forgotPasswordSchema } from '@eco/shared';
import { createZodDto } from 'nestjs-zod';

export class ForgotPasswordDto extends createZodDto(forgotPasswordSchema) {}
