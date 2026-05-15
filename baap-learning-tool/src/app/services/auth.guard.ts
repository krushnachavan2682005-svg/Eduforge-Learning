import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { Observable, map, of } from 'rxjs';
import { Auth } from '../auth/auth';
import { StorageService } from './storage-service';
import { STORAGEENUMS } from '../shared/enum';

@Injectable({
  providedIn: 'root',
})
export class AuthGuard implements CanActivate {
  constructor(
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object,
    private auth: Auth,
    private str: StorageService,
  ) {}

  canActivate(): boolean | Observable<boolean> {
    if (!isPlatformBrowser(this.platformId)) {
      return false;
    }

    const token = this.str?.getItem(STORAGEENUMS.AUTH_TOKEN);
    if (!token) {
      console.warn('[Auth] guard blocked route: missing token');
      this.router.navigate(['/auth/login']);
      return false;
    }

    return this.auth.restoreSession().pipe(
      map((isValid) => {
        if (!isValid) {
          console.warn('[Auth] guard blocked route: invalid token');
          this.router.navigate(['/auth/login']);
          return false;
        }
        return true;
      }),
    );
  }
}
