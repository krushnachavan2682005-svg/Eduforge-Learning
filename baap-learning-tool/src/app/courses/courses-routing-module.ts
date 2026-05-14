import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CoursesList } from './courses-list/courses-list';
import { AddCourses } from './add-courses/add-courses';
import { ViewCourse } from './view-course/view-course';
import { AddSection } from './add-section/add-section';
import { ViewSection } from './view-section/view-section';

const routes: Routes = [
  { path: '', component: CoursesList },
  {
    path: 'add-courses',
    component: AddCourses
  },
  {
    path: 'view-course/:id',
    component: ViewCourse
  },
  {
    path: 'add-section/:section_id',
    component: AddSection
  },
  {
    path: 'view-section/:id',
    component: ViewSection
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class CoursesRoutingModule { }
