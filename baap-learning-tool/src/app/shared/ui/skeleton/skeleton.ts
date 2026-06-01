import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-skeleton',
  standalone: true,
  template: `
    <div
      class="animate-pulse rounded theme-bg-secondary"
      [style.height.px]="height"
      [style.width]="width"
    ></div>
  `,
})
export class Skeleton {
  @Input() height = 80;
  @Input() width = '100%';
}
