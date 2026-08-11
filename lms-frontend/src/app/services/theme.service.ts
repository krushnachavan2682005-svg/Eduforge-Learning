import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject } from 'rxjs';

export type Theme = 'blue' | 'green' | 'indigo' | 'orange' | 'dark';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private currentThemeSubject = new BehaviorSubject<Theme>('dark');
  public currentTheme$ = this.currentThemeSubject.asObservable();

  private readonly THEME_KEY = 'selected-theme';
  private isBrowser: boolean;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  initTheme(): void {
    if (!this.isBrowser) return;

    const savedTheme =
      (localStorage.getItem(this.THEME_KEY) as Theme) || 'dark';

    if (['blue', 'green', 'indigo', 'orange', 'dark'].includes(savedTheme)) {
      this.applyTheme(savedTheme);
      this.currentThemeSubject.next(savedTheme);
    } else {
      this.applyTheme('dark');
      this.currentThemeSubject.next('dark');
    }
  }

  setTheme(theme: Theme): void {
    this.currentThemeSubject.next(theme);
    this.applyTheme(theme);
    this.saveTheme(theme);
  }

  getCurrentTheme(): Theme {
    return this.currentThemeSubject.value;
  }

  private applyTheme(theme: Theme): void {
    if (!this.isBrowser) return;

    const root = document.documentElement;
    root.removeAttribute('data-theme');
    root.setAttribute('data-theme', theme);
  }

  private saveTheme(theme: Theme): void {
    if (!this.isBrowser) return;
    localStorage.setItem(this.THEME_KEY, theme);
  }

  getAvailableThemes(): Array<{ name: string; value: Theme; color: string }> {
    return [
      { name: 'Blue Theme', value: 'blue', color: '#3b82f6' },
      { name: 'Green Theme', value: 'green', color: '#22c55e' },
      { name: 'Indigo Theme', value: 'indigo', color: '#6366f1' },
      { name: 'Orange Theme', value: 'orange', color: '#f97316' },
      { name: 'Dark Pro', value: 'dark', color: '#64748b' },
    ];
  }
}
