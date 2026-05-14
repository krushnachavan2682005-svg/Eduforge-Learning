import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LeaderBoard } from './leader-board/leader-board';
import { LeaderView } from './leader-view/leader-view';

const routes: Routes = [
  { path: '', component: LeaderBoard },
  {
    path: 'leader-view',
    component: LeaderView
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes), LeaderBoard, LeaderView],
  exports: [RouterModule],
})
export class LeaderBoardRoutingModule {}
