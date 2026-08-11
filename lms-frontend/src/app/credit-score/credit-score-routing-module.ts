import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CreditScore } from './credit-score/credit-score';

const routes: Routes = [{ path: '', component: CreditScore }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class CreditScoreRoutingModule {}
