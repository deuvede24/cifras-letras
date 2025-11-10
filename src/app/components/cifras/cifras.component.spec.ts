import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CifrasComponent } from './cifras.component';

describe('CifrasComponent', () => {
  let component: CifrasComponent;
  let fixture: ComponentFixture<CifrasComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CifrasComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CifrasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
