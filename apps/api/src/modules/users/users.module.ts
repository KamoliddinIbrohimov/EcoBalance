import { Module } from '@nestjs/common';

import { OrganizationsController } from './organizations.controller';
import { RolesController, UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController, RolesController, OrganizationsController],
  providers: [UsersService],
})
export class UsersModule {}
