export const ORGANIZATION_TYPE = {
  CITY: 'CITY',
  DISTRICT: 'DISTRICT',
  MAHALLA: 'MAHALLA',
  SCHOOL: 'SCHOOL',
  KINDERGARTEN: 'KINDERGARTEN',
  UNIVERSITY: 'UNIVERSITY',
} as const;

export type OrganizationType = (typeof ORGANIZATION_TYPE)[keyof typeof ORGANIZATION_TYPE];

export const ORGANIZATION_TYPE_LABELS_UZ: Record<OrganizationType, string> = {
  CITY: 'Shahar',
  DISTRICT: 'Tuman',
  MAHALLA: 'Mahalla',
  SCHOOL: 'Maktab',
  KINDERGARTEN: 'Bog‘cha',
  UNIVERSITY: 'Oliy ta’lim muassasasi',
};
