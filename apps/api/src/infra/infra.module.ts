import { Global, Module } from '@nestjs/common';

import { ENV, loadEnv } from '../config/env';
import { AuditService } from './audit.service';
import { PrismaService } from './prisma.service';
import { StorageService } from './storage.service';

@Global()
@Module({
  providers: [{ provide: ENV, useFactory: () => loadEnv() }, PrismaService, StorageService, AuditService],
  exports: [ENV, PrismaService, StorageService, AuditService],
})
export class InfraModule {}
