import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { StorageService } from './storage-service';
import { STORAGEENUMS } from '../shared/enum';
import { environment } from '../../environment/env';

export const tokenInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const str = inject(StorageService);
  const platformId = inject(PLATFORM_ID);
  const skipTokenUrls = [
    'doc-upload/signed-url',
  ];
  const isAuthLogin = req.url.includes('/auth/login');
  const isAuthMe = req.url === `${environment.AUTH_BASE_URL}/me`;
  const isSharedResumeRoute = router?.url?.includes('/resume/shared');
  const shouldSkipToken =
    isAuthLogin ||
    skipTokenUrls.some((url) => req.url.includes(url)) ||
    isSharedResumeRoute;
  let modifiedReq = req;
  modifiedReq = modifiedReq.clone({
    headers: modifiedReq.headers.delete('enableloading'),
  });

  if (isPlatformBrowser(platformId) && !shouldSkipToken) {
    const token = str?.getItem(STORAGEENUMS.AUTH_TOKEN);
    if (token) {
      modifiedReq = modifiedReq.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`,
        },
      });
    }
  }

  return next(modifiedReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && isAuthMe && !shouldSkipToken && !isSharedResumeRoute) {
        console.warn('[Auth] request unauthorized; clearing session', error);
        router.navigate(['/auth/login']);
        str?.clear();
      } else if (error.status === 401) {
        console.warn('[Auth] non-auth 401 preserved local session', {
          url: req.url,
          error,
        });
      }
      return throwError(() => error);
    }),
  );
};

