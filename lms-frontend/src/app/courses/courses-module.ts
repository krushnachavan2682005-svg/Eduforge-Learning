import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { CoursesRoutingModule } from './courses-routing-module';
import { QuillModule } from 'ngx-quill';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    CoursesRoutingModule,
    QuillModule?.forRoot()
  ]
})
export class CoursesModule { }
