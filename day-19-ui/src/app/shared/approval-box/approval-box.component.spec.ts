import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ApprovalBoxComponent } from './approval-box.component';

describe('ApprovalBoxComponent', () => {
  let component: ApprovalBoxComponent;
  let fixture: ComponentFixture<ApprovalBoxComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ApprovalBoxComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ApprovalBoxComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
