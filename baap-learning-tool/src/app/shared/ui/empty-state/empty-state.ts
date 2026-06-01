import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  template: `
    <div class="theme-bg-secondary theme-border rounded p-6 text-center">
      <p class="font-semibold">{{ title }}</p>
      @if (message) {
        <p class="text-sm opacity-70 mt-1">{{ message }}</p>
      }
    </div>
  `,
})
export class EmptyState {
  @Input() title = 'Nothing here yet';
  @Input() message = '';
}
