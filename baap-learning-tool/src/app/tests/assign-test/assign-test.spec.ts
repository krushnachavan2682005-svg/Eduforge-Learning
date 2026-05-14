import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AssignTest } from './assign-test';

describe('AssignTest', () => {
  let component: AssignTest;
  let fixture: ComponentFixture<AssignTest>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssignTest]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AssignTest);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
