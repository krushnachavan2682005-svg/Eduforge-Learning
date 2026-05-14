import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Reviewer } from './reviewer';

describe('Reviewer', () => {
  let component: Reviewer;
  let fixture: ComponentFixture<Reviewer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Reviewer]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Reviewer);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
