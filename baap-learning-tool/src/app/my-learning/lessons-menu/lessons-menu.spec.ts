import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LessonsMenu } from './lessons-menu';

describe('LessonsMenu', () => {
  let component: LessonsMenu;
  let fixture: ComponentFixture<LessonsMenu>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LessonsMenu]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LessonsMenu);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
