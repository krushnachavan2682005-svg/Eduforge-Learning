import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-app-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  template: `<router-outlet />`,
})
export class AppShell {}
