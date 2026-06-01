import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-page-header',
  standalone: true,
  template: `
    <div class="mb-4 flex items-start justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold">{{ title }}</h1>
        @if (subtitle) {
          <p class="text-sm opacity-70 mt-1">{{ subtitle }}</p>
        }
      </div>
      <ng-content></ng-content>
    </div>
  `,
})
export class PageHeader {
  @Input() title = '';
  @Input() subtitle = '';
}
