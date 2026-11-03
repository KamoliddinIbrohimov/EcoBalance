import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';

import { BadRequestException } from '@nestjs/common';

export const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** Multer: o'zbekcha fayl nomlari buzilmasin (standart latin1). */
export const UPLOAD_OPTIONS = { limits: { fileSize: MAX_FILE_BYTES }, defParamCharset: 'utf8' };

const ZIP = [0x50, 0x4b, 0x03, 0x04];
const OLE = [0xd0, 0xcf, 0x11, 0xe0];

/**
 * Ruxsat etilgan turlar va ularning imzosi. Content-Type'ga ishonmaymiz —
 * fayl boshidagi baytlar e'lon qilingan turga mos kelishi shart.
 */
const SIGNATURES: Record<string, number[] | null> = {
  'application/pdf': [0x25, 0x50, 0x44, 0x46],
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/png': [0x89, 0x50, 0x4e, 0x47],
  'image/webp': [0x52, 0x49, 0x46, 0x46],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ZIP,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ZIP,
  'application/msword': OLE,
  'application/vnd.ms-excel': OLE,
  'text/plain': null,
};

export function assertUploadable(file: Express.Multer.File | undefined): asserts file is Express.Multer.File {
  if (!file) throw new BadRequestException('Fayl yuborilmagan');
  if (file.size > MAX_FILE_BYTES) throw new BadRequestException('Fayl 10 MB dan oshmasligi kerak');
  if (!(file.mimetype in SIGNATURES)) {
    throw new BadRequestException(`Mumkin bo‘lmagan fayl turi: ${file.mimetype}`);
  }
  const signature = SIGNATURES[file.mimetype];
  if (!signature) return;
  if (file.buffer.length < signature.length) throw new BadRequestException('Fayl bo‘sh yoki buzilgan');
  if (!signature.every((byte, i) => file.buffer[i] === byte)) {
    throw new BadRequestException(`Fayl Content-Type (${file.mimetype}) bilan haqiqiy formati mos kelmaydi`);
  }
}

/** Kalitda asl nom yo'q (unicode/bo'shliq muammosi) — nom DB'da saqlanadi. */
export function storageKey(prefix: string, originalName: string): string {
  const ext = extname(originalName).toLowerCase().replace(/[^a-z0-9.]/g, '').slice(0, 10);
  return `${prefix}/${randomUUID()}${ext}`;
}

export const safeFileName = (name: string) => name.slice(0, 255);
