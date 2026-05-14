import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: 'courses/view-course/**',
    renderMode: RenderMode.Server,
  },
  {
    path: 'courses/lessons/**',
    renderMode: RenderMode.Server, 
  },
  {
    path: 'my-application/candidate-view/**',
    renderMode: RenderMode.Server, 
  },
  {
    path: 'my-learning/course/**',
    renderMode: RenderMode.Server, 
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender, // Prerender all other routes
  },
];
