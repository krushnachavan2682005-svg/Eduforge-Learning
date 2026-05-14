import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService, Theme } from '../services/theme.service';

@Component({
  selector: 'app-theme-selector',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="theme-selector">
      <h3 class="text-lg font-semibold theme-text mb-4">Choose Theme</h3>
      <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
        <button
          *ngFor="let theme of themes"
          (click)="selectTheme(theme.value)"
          [class]="getButtonClasses(theme.value)"
          class="p-4 rounded-lg border-2 transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2"
        >
          <div
            class="w-8 h-8 rounded-full mx-auto mb-2"
            [style.background-color]="theme.color"
          ></div>
          <span class="text-sm font-medium">{{ theme.name }}</span>
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .theme-selector {
        @apply p-6 rounded-xl theme-bg-secondary shadow-lg;
      }
    `,
  ],
})
export class ThemeSelectorComponent implements OnInit {
  themes: Array<{ name: string; value: Theme; color: string }> = [];
  currentTheme: Theme = 'blue';

  constructor(private themeService: ThemeService) {
    this.themes = this.themeService.getAvailableThemes();
  }

  ngOnInit(): void {
    this.themeService.currentTheme$.subscribe((theme) => {
      this.currentTheme = theme;
    });
  }

  selectTheme(theme: Theme): void {
    this.themeService.setTheme(theme);
  }

  getButtonClasses(theme: Theme): string {
    const baseClasses = 'flex flex-col items-center';
    const isSelected = this.currentTheme === theme;

    if (isSelected) {
      return `${baseClasses} border-current ring-2 ring-current theme-bg theme-text shadow-md`;
    } else {
      // Better styling for dark theme compatibility
      if (this.currentTheme === 'dark') {
        return `${baseClasses} border-gray-600 bg-gray-700 text-gray-200 hover:border-gray-500 hover:bg-gray-600`;
      } else {
        return `${baseClasses} border-gray-200 bg-white text-gray-700 hover:border-gray-300`;
      }
    }
  }
}
