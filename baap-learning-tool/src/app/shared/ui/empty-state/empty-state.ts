import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  template: `
    <div class="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
      <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
        <span class="material-icons text-2xl">inbox</span>
      </div>
      <p class="text-lg font-extrabold text-slate-900">{{ title }}</p>
      @if (message) {
        <p class="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{{ message }}</p>
      }
    </div>
  `,
})
export class EmptyState {
  @Input() title = 'Nothing here yet';
  @Input() message = '';
}
