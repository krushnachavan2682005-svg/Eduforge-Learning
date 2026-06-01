import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-badge',
  standalone: true,
  template: `
    <span class="inline-flex items-center px-2 py-1 rounded text-xs theme-bg-secondary theme-border">
      {{ label }}
    </span>
  `,
})
export class Badge {
  @Input() label = '';
}
