import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { catchError, finalize, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { StorageService } from './storage-service';
import { STORAGEENUMS } from '../shared/enum';

export const tokenInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const str = inject(StorageService);
  const platformId = inject(PLATFORM_ID);
  const skipTokenUrls = [
    'login',
    'doc-upload/signed-url',
    'baap-app-images.s3.ap-south-1.amazonaws.com',
  ];
  const isSharedResumeRoute = router?.url?.includes('/resume/shared');
  const shouldSkipToken =
    skipTokenUrls.some((url) => req.url.includes(url)) || isSharedResumeRoute;
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
      // Don't redirect to login for shared resume routes or public endpoints
      if (error.status === 401 && !shouldSkipToken && !isSharedResumeRoute) {
        router.navigate(['/auth/login']);
        str?.clear();
      }
      return throwError(() => error);
    }),
  );
};
