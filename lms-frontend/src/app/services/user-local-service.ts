import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
@Injectable({
  providedIn: 'root'
})
export class UserLocalService {
    constructor(@Inject(PLATFORM_ID) private platformId: Object) {}
 
  getUserId(): string | null {
    if (isPlatformBrowser(this.platformId)) {
      return localStorage?.getItem('userId');
    }
    return null;
  }
 
  setUserId(id: string) {
    if (isPlatformBrowser(this.platformId)) {
      localStorage?.setItem('userId', id);
    }
  }
 
  removeUserId() {
    if (isPlatformBrowser(this.platformId)) {
      localStorage?.removeItem('userId');
    }
  }
}
