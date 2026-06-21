import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-skeleton',
  standalone: true,
  template: `
    <div
      class="animate-pulse rounded-3xl bg-slate-200/80"
      [style.height.px]="height"
      [style.width]="width"
    ></div>
  `,
})
export class Skeleton {
  @Input() height = 80;
  @Input() width = '100%';
}
