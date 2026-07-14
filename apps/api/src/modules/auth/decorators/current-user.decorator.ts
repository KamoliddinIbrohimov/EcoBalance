import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import type { AuthenticatedUser } from '../strategies/jwt-access.strategy';

export const CurrentUser = createParamDecorator<keyof AuthenticatedUser | undefined>(
  (data, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = req.user;
    return data && user ? user[data] : user;
  },
);
