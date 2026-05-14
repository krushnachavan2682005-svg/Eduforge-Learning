import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MyTest } from './my-test';

describe('MyTest', () => {
  let component: MyTest;
  let fixture: ComponentFixture<MyTest>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyTest]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MyTest);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
