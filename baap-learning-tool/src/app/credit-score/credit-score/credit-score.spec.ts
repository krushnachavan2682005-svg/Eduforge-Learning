import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreditScore } from './credit-score';

describe('CreditScore', () => {
  let component: CreditScore;
  let fixture: ComponentFixture<CreditScore>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreditScore],
    }).compileComponents();

    fixture = TestBed.createComponent(CreditScore);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
