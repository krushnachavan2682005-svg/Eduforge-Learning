import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="theme-bg-secondary theme-border rounded p-4 min-h-24">
      <div class="flex items-center justify-between gap-3">
        <div>
          <p class="text-sm opacity-70">{{ label }}</p>
          <p class="text-2xl font-semibold mt-1">{{ value }}</p>
        </div>
        @if (icon) {
          <i class="material-icons text-2xl opacity-70">{{ icon }}</i>
        }
      </div>
      @if (hint) {
        <p class="text-xs opacity-70 mt-2">{{ hint }}</p>
      }
    </div>
  `,
})
export class StatCard {
  @Input() label = '';
  @Input() value: string | number = 0;
  @Input() icon = '';
  @Input() hint = '';
}
