import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class SkeletonTheme {
  lineTheme = {
    height: '40px',
    'margin-bottom': '12px',
    'border-radius': '6px',
  };
  boxTheme = {
    width: '14%',
    height: '22vh',
    'margin-top': '8px',
    'margin-right': '28px',
    'border-radius': '6px',
  };
  expanded = {
    height: '170px',
    'margin-bottom': '12px',
    'border-radius': '6px',
  };
}
