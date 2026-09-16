import { updateOrganizationSchema } from '@eco/shared';
import { createZodDto } from 'nestjs-zod';

export class UpdateOrganizationDto extends createZodDto(updateOrganizationSchema) {}
