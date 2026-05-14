import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ActionItems } from './action-items/action-items';
import { AddActionItems } from './add-action-items/add-action-items';
import { SubmittedActionItems } from './submitted-action-items/submitted-action-items';
import { AddLevel } from './add-level/add-level';
import { MyActionItems } from './my-action-items/my-action-items';
import { ViewStudentSubmissions } from './view-student-submissions/view-student-submissions';

const routes: Routes = [
  { path: '', component: ActionItems },
  { path: 'add-action-items', component: AddActionItems },
  { path: 'add-level', component: AddLevel },
  { path: 'submitted-action-items', component: SubmittedActionItems },
  { path: 'my-action-items', component: MyActionItems },
  { path: 'view-student-submissions/:id', component: ViewStudentSubmissions },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ActionItemsRoutingModule {}
