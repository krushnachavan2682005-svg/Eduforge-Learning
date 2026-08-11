import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { MyLearning } from './my-learning/my-learning';
import { StudentView } from './student-view/student-view';

const routes: Routes = [
  { path: '', component: MyLearning },
   {
      path: 'student-view/:id',
      component: StudentView
    },
    {
      path: 'student-view',
      component: StudentView
    }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class MyLearningRoutingModule {}
