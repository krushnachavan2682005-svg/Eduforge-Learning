import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="group min-h-28 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div class="flex items-start justify-between gap-4">
        <div class="min-w-0">
          <p class="text-sm font-semibold text-slate-500">{{ label }}</p>
          <p class="mt-2 text-3xl font-extrabold tracking-normal text-slate-900">{{ value }}</p>
        </div>
        @if (icon) {
          <span class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
            <i class="material-icons text-2xl">{{ icon }}</i>
          </span>
        }
      </div>
      @if (hint) {
        <p class="mt-3 text-xs leading-5 text-slate-500">{{ hint }}</p>
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
