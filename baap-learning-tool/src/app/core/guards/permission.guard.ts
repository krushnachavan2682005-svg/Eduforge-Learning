import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthSessionService } from '../session/auth-session.service';

export const PermissionGuard: CanActivateFn = (route) => {
  const router = inject(Router);
  const session = inject(AuthSessionService);
  const required = (route.data?.['permissions'] || []) as string[];

  return session.restoreSession().pipe(
    map((valid) => {
      if (!valid) {
        router.navigate(['/auth/login']);
        return false;
      }
      if (!required.length || session.hasPermission(required)) {
        return true;
      }
      router.navigate(['/dashboard']);
      return false;
    }),
  );
};
