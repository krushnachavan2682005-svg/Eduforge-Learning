import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthSessionService } from '../session/auth-session.service';

export const RoleGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const session = inject(AuthSessionService);
  const expectedRoles = (route.data?.['roles'] || []) as string[];

  return session.restoreSession().pipe(
    map((valid) => {
      if (!valid) {
        router.navigate(['/auth/login']);
        return false;
      }
      if (!expectedRoles.length || session.hasRole(expectedRoles as any)) {
        return true;
      }
      router.navigate(['/dashboard']);
      return false;
    }),
  );
};
