import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ToolLogComponent } from './tool-log.component';

describe('ToolLogComponent', () => {
  let component: ToolLogComponent;
  let fixture: ComponentFixture<ToolLogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ToolLogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ToolLogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
