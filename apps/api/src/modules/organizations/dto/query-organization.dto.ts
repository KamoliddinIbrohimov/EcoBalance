import { organizationQuerySchema } from '@eco/shared';
import { createZodDto } from 'nestjs-zod';

export class QueryOrganizationDto extends createZodDto(organizationQuerySchema) {}
