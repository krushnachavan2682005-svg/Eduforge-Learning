import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthSessionService } from '../session/auth-session.service';

type RedirectMap = {
  super_admin?: string;
  organization_admin?: string;
  teacher?: string;
  student?: string;
};

export const LegacyWorkspaceRedirectGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const session = inject(AuthSessionService);
  const redirects = (route.data?.['redirects'] || {}) as RedirectMap;

  return session.restoreSession().pipe(
    map((valid) => {
      if (!valid) {
        return router.createUrlTree(['/auth/login']);
      }

      const currentPath = state.url.split('?')[0].replace(/\/$/, '');
      const legacyRoot = `/${route.routeConfig?.path || ''}`.replace(/\/$/, '');

      if (currentPath !== legacyRoot) {
        return true;
      }

      const role = session.getRole() as keyof RedirectMap;
      const target = redirects[role];

      if (target) {
        return router.createUrlTree([target]);
      }

      return true;
    }),
  );
};
