import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="nf">
      <span class="code">404</span>
      <h1>This page took a different path</h1>
      <p class="muted">The page you're looking for doesn't exist or has moved.</p>
      <div class="flex flex-wrap center"><a routerLink="/" class="btn btn-primary">Go home</a><a routerLink="/courses" class="btn btn-outline">Browse courses</a></div>
    </main>
  `,
  styles: [`.nf { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 24px; }
    .code { font-family: var(--font-display); font-weight: 800; font-size: 6rem; line-height: 1; color: var(--accent); } .center { justify-content: center; }`],
})
export class NotFoundComponent {}
