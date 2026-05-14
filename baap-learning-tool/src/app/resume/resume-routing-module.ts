import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { Resume } from './resume/resume';
import { CreateResume } from './create-resume/create-resume';
import { SharedResume } from './shared-resume/shared-resume';
import { AuthGuard } from '../services/auth.guard';

const routes: Routes = [
  {
    path: '',
    component: Resume,
    canActivate: [AuthGuard],
  },
  {
    path: 'create',
    component: CreateResume,
    canActivate: [AuthGuard],
  },
  {
    path: 'edit/:id',
    component: CreateResume,
    canActivate: [AuthGuard],
  },
  {
    path: 'shared/:userId/:token',
    component: SharedResume,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ResumeRoutingModule {}
