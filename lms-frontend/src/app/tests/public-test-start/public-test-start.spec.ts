import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PublicTestStart } from './public-test-start';

describe('PublicTestStart', () => {
  let component: PublicTestStart;
  let fixture: ComponentFixture<PublicTestStart>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PublicTestStart]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PublicTestStart);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
