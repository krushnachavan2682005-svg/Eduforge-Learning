import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthSessionService } from '../session/auth-session.service';

export const RoleRedirectGuard: CanActivateFn = () => {
  const router = inject(Router);
  const session = inject(AuthSessionService);

  return session.restoreSession().pipe(
    map((valid) => {
      if (!valid) {
        return router.createUrlTree(['/auth/login']);
      }

      if (session.isPlatformAdmin()) {
        return router.createUrlTree(['/platform/dashboard']);
      }
      if (session.isOrganizationAdmin()) {
        return router.createUrlTree(['/admin/dashboard']);
      }
      if (session.isTeacher()) {
        return router.createUrlTree(['/teacher/dashboard']);
      }
      if (session.isStudent()) {
        return router.createUrlTree(['/student/dashboard']);
      }

      return router.createUrlTree(['/dashboard']);
    }),
  );
};
