import { z } from 'zod';
import { paginationQuerySchema } from './pagination';

export const ECO_REPORT_CATEGORY = {
  WASTE: 'WASTE',
  WATER: 'WATER',
  GREEN_AREA: 'GREEN_AREA',
  AIR_NOISE: 'AIR_NOISE',
  ENERGY: 'ENERGY',
  OTHER: 'OTHER',
} as const;
export type EcoReportCategory =
  (typeof ECO_REPORT_CATEGORY)[keyof typeof ECO_REPORT_CATEGORY];

export const ECO_REPORT_CATEGORY_LABELS_UZ: Record<EcoReportCategory, string> = {
  WASTE: 'Chiqindi',
  WATER: 'Suv',
  GREEN_AREA: 'Yashil hudud',
  AIR_NOISE: 'Havo va shovqin',
  ENERGY: 'Energiya',
  OTHER: 'Boshqa',
};

export const ECO_REPORT_RISK = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
} as const;
export type EcoReportRisk = (typeof ECO_REPORT_RISK)[keyof typeof ECO_REPORT_RISK];

export const ECO_REPORT_RISK_LABELS_UZ: Record<EcoReportRisk, string> = {
  LOW: 'Past',
  MEDIUM: 'O‘rta',
  HIGH: 'Yuqori',
};

export const ECO_REPORT_STATUS = {
  REPORTED: 'REPORTED',
  IN_REVIEW: 'IN_REVIEW',
  IN_PROGRESS: 'IN_PROGRESS',
  RESOLVED: 'RESOLVED',
} as const;
export type EcoReportStatus =
  (typeof ECO_REPORT_STATUS)[keyof typeof ECO_REPORT_STATUS];

export const ECO_REPORT_STATUS_LABELS_UZ: Record<EcoReportStatus, string> = {
  REPORTED: 'Aniqlandi',
  IN_REVIEW: 'Ko‘rib chiqilmoqda',
  IN_PROGRESS: 'Chora ko‘rilmoqda',
  RESOLVED: 'Hal qilindi',
};

export const ecoReportSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid().nullable(),
  reportedBy: z.string().uuid(),
  reporterName: z.string().nullable(),
  category: z.nativeEnum(ECO_REPORT_CATEGORY),
  riskLevel: z.nativeEnum(ECO_REPORT_RISK),
  status: z.nativeEnum(ECO_REPORT_STATUS),
  descriptionUz: z.string(),
  suggestionUz: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  locationLabel: z.string().nullable(),
  photoBeforeKey: z.string().nullable(),
  photoAfterKey: z.string().nullable(),
  resolvedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type EcoReportDto = z.infer<typeof ecoReportSchema>;

export const createEcoReportSchema = z.object({
  category: z.nativeEnum(ECO_REPORT_CATEGORY),
  riskLevel: z.nativeEnum(ECO_REPORT_RISK).default(ECO_REPORT_RISK.MEDIUM),
  descriptionUz: z.string().min(5, 'Kamida 5 belgi').max(2000),
  suggestionUz: z.string().max(2000).nullable().optional(),
  latitude: z.coerce.number().min(-90).max(90).nullable().optional(),
  longitude: z.coerce.number().min(-180).max(180).nullable().optional(),
  locationLabel: z.string().max(255).nullable().optional(),
  organizationId: z.string().uuid().nullable().optional(),
});
export type CreateEcoReportInput = z.infer<typeof createEcoReportSchema>;

export const updateEcoReportStatusSchema = z.object({
  status: z.nativeEnum(ECO_REPORT_STATUS),
});
export type UpdateEcoReportStatusInput = z.infer<typeof updateEcoReportStatusSchema>;

export const ecoReportQuerySchema = paginationQuerySchema.extend({
  category: z.nativeEnum(ECO_REPORT_CATEGORY).optional(),
  status: z.nativeEnum(ECO_REPORT_STATUS).optional(),
  organizationId: z.string().uuid().optional(),
});
export type EcoReportQuery = z.infer<typeof ecoReportQuerySchema>;
