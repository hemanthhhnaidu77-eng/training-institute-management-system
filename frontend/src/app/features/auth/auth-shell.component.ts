import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../shared/components/icon.component';

/** Split-screen frame shared by login / register / password pages. */
@Component({
  selector: 'app-auth-shell',
  standalone: true,
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="auth">
      <div class="panel">
        <div class="pitch">
          <span class="eyebrow">Student portal</span>
          <h2>Your learning, all in one place</h2>
          <ul>
            <li><app-icon name="book" [size]="18" /> Track enrollments and course progress</li>
            <li><app-icon name="calendar" [size]="18" /> See your class schedule</li>
            <li><app-icon name="clock" [size]="18" /> Manage appointments</li>
            <li><app-icon name="award" [size]="18" /> Access completion records</li>
          </ul>
          <a routerLink="/courses" class="btn btn-light btn-sm">Browse courses first</a>
        </div>
        <div class="form-side">
          <h1>{{ title }}</h1>
          @if (subtitle) { <p class="muted">{{ subtitle }}</p> }
          <ng-content />
        </div>
      </div>
    </section>
  `,
  styles: [`
    .auth { padding: 48px 16px 72px; background: radial-gradient(circle at 15% 20%, var(--navy-100), transparent 40%), var(--bg); }
    .panel { max-width: 1040px; margin: 0 auto; display: grid; grid-template-columns: 0.9fr 1.1fr; background: var(--white); border-radius: var(--radius-lg); box-shadow: var(--shadow-lg); overflow: hidden; }
    .pitch { background: radial-gradient(circle at 80% 0%, rgba(242,165,65,0.3), transparent 45%), linear-gradient(160deg, var(--navy-950), var(--navy-800)); color: #c9d6e8; padding: 48px 40px; display: flex; flex-direction: column; justify-content: center; }
    .pitch h2 { color: var(--white); } .eyebrow { color: var(--accent); }
    .pitch ul { list-style: none; padding: 0; margin: 8px 0 28px; display: grid; gap: 14px; }
    .pitch li { display: flex; gap: 10px; align-items: center; } .pitch app-icon { color: var(--accent); }
    .pitch .btn { align-self: flex-start; }
    .form-side { padding: 48px 44px; }
    h1 { font-size: 1.9rem; margin-bottom: 4px; }
    @media (max-width: 860px) { .panel { grid-template-columns: 1fr; } .pitch { display: none; } .form-side { padding: 32px 22px; } }
  `],
})
export class AuthShellComponent {
  @Input() title = '';
  @Input() subtitle = '';
}
