import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { Test } from './test/test';
import { AssignTest } from './assign-test/assign-test';
import { AddNewTest } from './add-new-test/add-new-test';
import { StartExam } from './start-exam/start-exam';
import { Reviewer } from './reviewer/reviewer';
import { ReviewList } from './review-list/review-list';
import { MyTest } from './my-test/my-test';
import { TestResult } from './test-result/test-result';
import { StudentResult } from './student-result/student-result';
import { PublicTestStart } from './public-test-start/public-test-start';
import { StudentReviewTest } from './student-review-test/student-review-test';

const routes: Routes = [
  {
    path: 'test',
    component: Test,
  },
  {
    path: 'test/:id',
    component: Test,
  },
  {
    path: 'assign-test',
    component: AssignTest,
  },
  {
    path: 'add-new-test',
    component: AddNewTest,
  },
  {
    path: 'start-exam',
    component: StartExam,
  },
  {
    path: 'review-list',
    component: ReviewList,
  },
  { path: 'start-exam/:id', component: StartExam },
  { path: 'reviewer', component: Reviewer },

  {
    path: 'public-test-start',
    component: PublicTestStart,
  },
  {
    path: 'public-test-start/:id',
    component: PublicTestStart,
  },
  {
    path: 'student-review-test/:id',
    component: StudentReviewTest,
  },
  {
    path: 'student-review-test',
    component: StudentReviewTest,
  },
  {
    path: 'my-test',
    component: MyTest,
  },
  {
    path: 'test-result',
    component: TestResult,
  },
  {
    path: 'student-result',
    component: StudentResult,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TestsRoutingModule {}
