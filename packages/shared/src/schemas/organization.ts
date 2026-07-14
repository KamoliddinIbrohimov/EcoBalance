import { z } from 'zod';
import { ORGANIZATION_TYPE } from '../constants/organizations';

export const organizationSchema = z.object({
  id: z.string().uuid(),
  parentId: z.string().uuid().nullable(),
  type: z.nativeEnum(ORGANIZATION_TYPE),
  nameUz: z.string(),
  code: z.string(),
  address: z.record(z.unknown()).nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type OrganizationDto = z.infer<typeof organizationSchema>;
