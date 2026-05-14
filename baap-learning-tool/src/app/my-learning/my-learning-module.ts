import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { MyLearningRoutingModule } from './my-learning-routing-module';
import { FormsModule } from '@angular/forms';

@NgModule({
  declarations: [],
  imports: [CommonModule,FormsModule, MyLearningRoutingModule],
})
export class MyLearningModule {}
