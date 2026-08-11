import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AssginCourse } from './assgin-course';

describe('AssginCourse', () => {
  let component: AssginCourse;
  let fixture: ComponentFixture<AssginCourse>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssginCourse]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AssginCourse);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
