import { resetPasswordSchema } from '@eco/shared';
import { createZodDto } from 'nestjs-zod';

export class ResetPasswordDto extends createZodDto(resetPasswordSchema) {}
