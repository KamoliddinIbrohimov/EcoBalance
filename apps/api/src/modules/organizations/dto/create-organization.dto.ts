import { createOrganizationSchema } from '@eco/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateOrganizationDto extends createZodDto(createOrganizationSchema) {}
