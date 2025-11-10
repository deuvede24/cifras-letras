import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./components/menu/menu.component').then(m => m.MenuComponent)
  },
  {
    path: 'letras',
    loadComponent: () => import('./components/letras/letras.component').then(m => m.LetrasComponent)
  },
  {
    path: 'cifras',
    loadComponent: () => import('./components/cifras/cifras.component').then(m => m.CifrasComponent)
  }
];