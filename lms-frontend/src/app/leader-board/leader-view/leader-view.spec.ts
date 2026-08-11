import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LeaderView } from './leader-view';

describe('LeaderView', () => {
  let component: LeaderView;
  let fixture: ComponentFixture<LeaderView>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LeaderView]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LeaderView);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
