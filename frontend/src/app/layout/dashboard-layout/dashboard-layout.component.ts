import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/domain.services';
import { IconComponent } from '../../shared/components/icon.component';
import { initials } from '../../shared/utils/form-utils';

interface NavItem { path: string; label: string; icon: string; exact?: boolean; }

const NAV: Record<string, NavItem[]> = {
  admin: [
    { path: '/admin', label: 'Overview', icon: 'grid', exact: true }, { path: '/admin/students', label: 'Students', icon: 'users' },
    { path: '/admin/courses', label: 'Courses', icon: 'book' }, { path: '/admin/trainers', label: 'Trainers', icon: 'user' },
    { path: '/admin/batches', label: 'Batches', icon: 'calendar' }, { path: '/admin/enrollments', label: 'Enrollments', icon: 'graduation' },
    { path: '/admin/appointments', label: 'Appointments', icon: 'clock' }, { path: '/admin/services', label: 'Services', icon: 'layers' },
    { path: '/admin/inquiries', label: 'Inquiries', icon: 'inbox' }, { path: '/admin/reviews', label: 'Reviews', icon: 'star' },
    { path: '/admin/testimonials', label: 'Testimonials', icon: 'message' }, { path: '/admin/faqs', label: 'FAQs', icon: 'info' },
    { path: '/admin/events', label: 'Events', icon: 'spark' }, { path: '/admin/reports', label: 'Reports', icon: 'chart' },
    { path: '/admin/settings', label: 'Settings', icon: 'settings' },
  ],
  student: [
    { path: '/student', label: 'Overview', icon: 'grid', exact: true }, { path: '/student/courses', label: 'My Courses', icon: 'book' },
    { path: '/student/appointments', label: 'My Appointments', icon: 'clock' }, { path: '/student/schedule', label: 'My Schedule', icon: 'calendar' },
    { path: '/student/notifications', label: 'Notifications', icon: 'bell' }, { path: '/student/profile', label: 'My Profile', icon: 'user' },
  ],
  trainer: [
    { path: '/trainer', label: 'Overview', icon: 'grid', exact: true }, { path: '/trainer/courses', label: 'My Courses', icon: 'book' },
    { path: '/trainer/batches', label: 'My Batches', icon: 'layers' }, { path: '/trainer/schedule', label: 'My Schedule', icon: 'calendar' },
    { path: '/trainer/appointments', label: 'Appointments', icon: 'clock' }, { path: '/trainer/students', label: 'Students', icon: 'users' },
    { path: '/trainer/notifications', label: 'Notifications', icon: 'bell' }, { path: '/trainer/profile', label: 'My Profile', icon: 'user' },
  ],
};

@Component({
  selector: 'app-dashboard-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="skip-link" href="#dash-main">Skip to content</a>
    <div class="shell" [class.open]="sidebarOpen()">
      <aside class="sidebar" aria-label="Dashboard navigation">
        <a routerLink="/" class="brand"><span class="mark">NTA</span><span>Navigate Tech<br /><small>{{ roleLabel() }} portal</small></span></a>
        <nav>
          @for (item of nav(); track item.path) {
            <a [routerLink]="item.path" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: !!item.exact }">
              <app-icon [name]="item.icon" [size]="18" /> <span>{{ item.label }}</span>
              @if (item.label === 'Notifications' && unread() > 0) { <span class="count">{{ unread() }}</span> }
            </a>
          }
        </nav>
        <div class="side-foot">
          <a routerLink="/" class="side-link"><app-icon name="globe" [size]="18" /> Visit website</a>
          <button type="button" class="side-link" (click)="auth.logout()"><app-icon name="logout" [size]="18" /> Log out</button>
        </div>
      </aside>
      <div class="scrim" (click)="sidebarOpen.set(false)"></div>
      <div class="main">
        <header class="topbar">
          <button type="button" class="btn btn-icon btn-ghost menu-btn" (click)="sidebarOpen.set(!sidebarOpen())" aria-label="Toggle sidebar"><app-icon name="menu" /></button>
          <div class="greet"><strong>Welcome, {{ firstName() }}</strong><span class="muted small">{{ today }}</span></div>
          <a class="btn btn-icon btn-ghost bell" [routerLink]="notificationsLink()" aria-label="Notifications">
            <app-icon name="bell" />
            @if (unread() > 0) { <span class="dot">{{ unread() > 9 ? '9+' : unread() }}</span> }
          </a>
          <div class="profile">
            <button type="button" class="who" (click)="menuOpen.set(!menuOpen())" [attr.aria-expanded]="menuOpen()" aria-haspopup="menu">
              <span class="avatar sm">{{ initials(auth.user()?.fullName) }}</span>
              <span class="who-text"><strong>{{ auth.user()?.fullName }}</strong><span class="muted small">{{ roleLabel() }}</span></span>
              <app-icon name="chevron-down" [size]="16" />
            </button>
            @if (menuOpen()) {
              <div class="menu" role="menu">
                <a role="menuitem" [routerLink]="base() + '/profile'">My profile</a>
                <a role="menuitem" routerLink="/">Website home</a>
                <button type="button" role="menuitem" (click)="auth.logout()">Log out</button>
              </div>
            }
          </div>
        </header>
        <main id="dash-main" class="content" tabindex="-1"><router-outlet /></main>
      </div>
    </div>
  `,
  styles: [`
    .shell { display: grid; grid-template-columns: 260px 1fr; min-height: 100vh; }
    .sidebar { position: sticky; top: 0; height: 100vh; overflow-y: auto; background: var(--navy-950); color: #b8c6da; display: flex; flex-direction: column; padding: 20px 14px; }
    .brand { display: flex; gap: 10px; align-items: center; color: var(--white); font-family: var(--font-display); font-weight: 800; line-height: 1.15; padding: 0 8px 20px; }
    .brand small { color: var(--accent); font-weight: 600; font-family: var(--font-body); }
    .mark { width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; background: var(--accent); color: var(--navy-950); font-size: 0.78rem; }
    nav { display: flex; flex-direction: column; gap: 2px; }
    nav a, .side-link { display: flex; gap: 12px; align-items: center; padding: 10px 12px; border-radius: 10px; color: #b8c6da; font-weight: 500; font-size: 0.93rem; background: none; border: none; cursor: pointer; width: 100%; text-align: left; }
    nav a:hover, .side-link:hover { background: rgba(255,255,255,0.06); color: var(--white); }
    nav a.active { background: rgba(242,165,65,0.14); color: var(--white); box-shadow: inset 3px 0 0 var(--accent); }
    .count { margin-left: auto; background: var(--accent); color: var(--navy-950); border-radius: 999px; font-size: 0.72rem; font-weight: 700; padding: 1px 8px; }
    .side-foot { margin-top: auto; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.08); }
    .main { min-width: 0; display: flex; flex-direction: column; }
    .topbar { position: sticky; top: 0; z-index: 50; height: 68px; display: flex; align-items: center; gap: 12px; padding: 0 24px; background: rgba(255,255,255,0.94); backdrop-filter: blur(8px); border-bottom: 1px solid var(--line); }
    .greet { display: flex; flex-direction: column; line-height: 1.25; margin-right: auto; }
    .menu-btn { display: none; }
    .bell { position: relative; }
    .dot { position: absolute; top: 2px; right: 0; background: var(--danger); color: var(--white); font-size: 0.65rem; font-weight: 700; border-radius: 999px; padding: 0 5px; min-width: 18px; line-height: 18px; text-align: center; }
    .profile { position: relative; }
    .who { display: flex; gap: 10px; align-items: center; background: none; border: none; cursor: pointer; padding: 4px 6px; border-radius: 12px; text-align: left; }
    .who:hover { background: var(--navy-50); }
    .who-text { display: flex; flex-direction: column; line-height: 1.2; font-size: 0.9rem; }
    .avatar.sm { width: 38px; height: 38px; font-size: 0.85rem; }
    .menu { position: absolute; right: 0; top: calc(100% + 8px); min-width: 200px; background: var(--white); border: 1px solid var(--line); border-radius: 14px; box-shadow: var(--shadow-lg); padding: 8px; display: flex; flex-direction: column; }
    .menu a, .menu button { text-align: left; padding: 9px 12px; border-radius: 8px; background: none; border: none; color: var(--ink); cursor: pointer; font-size: 0.93rem; }
    .menu a:hover, .menu button:hover { background: var(--navy-50); }
    .content { padding: 28px 24px 48px; max-width: 1280px; width: 100%; }
    .scrim { display: none; }
    @media (max-width: 960px) {
      .shell { grid-template-columns: 1fr; }
      .sidebar { position: fixed; left: 0; top: 0; z-index: 200; width: 270px; transform: translateX(-100%); transition: transform .25s ease; }
      .shell.open .sidebar { transform: none; }
      .shell.open .scrim { display: block; position: fixed; inset: 0; z-index: 150; background: rgba(6,21,40,0.5); }
      .menu-btn { display: inline-flex; }
      .who-text { display: none; }
      .content { padding: 20px 16px 40px; }
    }
  `],
})
export class DashboardLayoutComponent implements OnInit {
  auth = inject(AuthService);
  private router = inject(Router);
  private notifications = inject(NotificationService);

  sidebarOpen = signal(false);
  menuOpen = signal(false);
  unread = signal(0);
  initials = initials;
  readonly today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  nav = computed(() => NAV[this.auth.role() || 'student'] || []);
  base = computed(() => this.auth.dashboardUrl());
  notificationsLink = computed(() => `${this.base()}/notifications`);
  roleLabel = computed(() => ({ admin: 'Administrator', trainer: 'Trainer', student: 'Student' })[this.auth.role() || 'student']);
  firstName = computed(() => (this.auth.user()?.fullName || '').split(' ')[0]);

  ngOnInit(): void {
    this.loadUnread();
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      this.sidebarOpen.set(false);
      this.menuOpen.set(false);
      this.loadUnread();
    });
  }

  private loadUnread(): void {
    if (!this.auth.isLoggedIn()) return;
    this.notifications.mine().subscribe({ next: (r) => this.unread.set(r.unread), error: () => undefined });
  }
}
