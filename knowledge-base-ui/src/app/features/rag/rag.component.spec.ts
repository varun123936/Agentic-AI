import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RagComponent } from './rag.component';

describe('RagComponent', () => {
  let component: RagComponent;
  let fixture: ComponentFixture<RagComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RagComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RagComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
