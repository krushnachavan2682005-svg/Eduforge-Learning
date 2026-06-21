import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-page-header',
  standalone: true,
  template: `
    <div class="mb-6 flex flex-col gap-4 rounded-3xl border border-slate-200/80 bg-white px-5 py-5 shadow-sm md:flex-row md:items-center md:justify-between">
      <div class="min-w-0">
        <p class="mb-2 text-xs font-bold uppercase tracking-wide text-teal-700">Workspace</p>
        <h1 class="text-2xl font-extrabold tracking-normal text-slate-900 md:text-3xl">{{ title }}</h1>
        @if (subtitle) {
          <p class="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{{ subtitle }}</p>
        }
      </div>
      <div class="flex shrink-0 flex-wrap items-center gap-2">
        <ng-content></ng-content>
      </div>
    </div>
  `,
})
export class PageHeader {
  @Input() title = '';
  @Input() subtitle = '';
}
