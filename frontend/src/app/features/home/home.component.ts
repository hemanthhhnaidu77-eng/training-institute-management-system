import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiErrorInfo, Batch, Course, EventItem, Faq, Testimonial, Trainer } from '../../core/models/models';
import { AuthService } from '../../core/services/auth.service';
import { BatchService, ContentService, CourseService, TrainerService } from '../../core/services/domain.services';
import { ToastService } from '../../core/services/toast.service';
import { CourseCardComponent } from '../../shared/components/content.components';
import { AlertComponent, LoaderComponent } from '../../shared/components/feedback.components';
import { FieldErrorComponent } from '../../shared/components/field-error.component';
import { IconComponent } from '../../shared/components/icon.component';
import { initials } from '../../shared/utils/form-utils';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule, IconComponent, CourseCardComponent, LoaderComponent, AlertComponent, FieldErrorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- HERO -->
    <section class="hero">
      <div class="container hero-grid">
        <div class="hero-copy fade-up">
          <span class="eyebrow"><app-icon name="spark" [size]="16" /> IT &amp; skills training institute</span>
          <h1>Learn Today. Build Tomorrow. <span class="hl">Achieve Your Career Goals.</span></h1>
          <p class="lead">Upgrade your skills with industry-oriented training, expert mentors, practical projects, and career-focused learning programs.</p>
          <div class="cta">
            <a routerLink="/courses" class="btn btn-accent btn-lg">Explore Courses <app-icon name="arrow-right" [size]="18" /></a>
            <a routerLink="/appointments" class="btn btn-light btn-lg">Book a Free Consultation</a>
            <a [routerLink]="auth.isLoggedIn() ? auth.dashboardUrl() : '/login'" class="btn btn-ghost btn-lg login">{{ auth.isLoggedIn() ? 'Go to Dashboard' : 'Student Login' }}</a>
          </div>
          <ul class="trust">
            <li><app-icon name="check" [size]="16" /> Live, mentor-led classes</li>
            <li><app-icon name="check" [size]="16" /> Online, offline &amp; hybrid</li>
            <li><app-icon name="check" [size]="16" /> Portfolio projects</li>
          </ul>
        </div>
        <div class="hero-art" aria-hidden="true">
          <div class="ticket main">
            <span class="badge badge-accent">Next batch</span>
            @if (nextBatch(); as b) {
              <h3>{{ b.courseTitle }}</h3>
              <p>{{ b.name }}</p>
              <div class="t-row"><span><app-icon name="calendar" [size]="15" /> Starts {{ b.startDate }}</span><span><app-icon name="clock" [size]="15" /> {{ b.startTime }}-{{ b.endTime }}</span></div>
              <div class="seats"><div class="bar"><span [style.width.%]="seatPct(b)"></span></div><small>{{ b.availableSeats }} of {{ b.capacity }} seats open</small></div>
            } @else {
              <h3>New batches every month</h3>
              <p>Weekday, weekend and fast-track options.</p>
            }
          </div>
          <div class="ticket mini one"><app-icon name="award" [size]="20" /><span><strong>{{ courses().length || '12' }}+</strong> career programs</span></div>
          <div class="ticket mini two"><app-icon name="users" [size]="20" /><span><strong>1:1</strong> mentoring available</span></div>
        </div>
      </div>
    </section>

    @if (loading()) { <app-loader label="Loading courses, trainers and batches..." /> }
    @if (error(); as e) { <div class="container section-sm"><app-alert type="error" title="We couldn't load live content" (retry)="load()">{{ e.message }}</app-alert></div> }

    @if (!loading() && !error()) {
      <!-- STATS (computed from real records) -->
      <section class="stats-band">
        <div class="container stats">
          <div><strong>{{ courses().length }}</strong><span>Active courses</span></div>
          <div><strong>{{ trainers().length }}</strong><span>Expert trainers</span></div>
          <div><strong>{{ batches().length }}</strong><span>Upcoming batches</span></div>
          <div><strong>{{ enrolledTotal() }}</strong><span>Learners enrolled</span></div>
        </div>
        <p class="container stats-note">Figures are calculated live from our course, trainer, batch and enrollment records.</p>
      </section>

      <!-- POPULAR COURSES -->
      <section class="section">
        <div class="container">
          <div class="head-row">
            <div><span class="eyebrow">Popular courses</span><h2>Programs learners choose most</h2></div>
            <a routerLink="/courses" class="btn btn-outline">View all courses</a>
          </div>
          <div class="grid grid-3">
            @for (c of featured(); track c.id) { <app-course-card [course]="c" /> }
          </div>
        </div>
      </section>

      <!-- CATEGORIES -->
      <section class="section section-alt">
        <div class="container">
          <div class="section-head"><span class="eyebrow">Training categories</span><h2>Find your track</h2><p>From your first line of code to cloud architecture and AI.</p></div>
          <div class="grid grid-4">
            @for (cat of categories(); track cat.name) {
              <a class="card card-hover cat" routerLink="/courses" [queryParams]="{ category: cat.name }">
                <div class="icon-tile"><app-icon [name]="cat.icon" /></div>
                <div><h4 class="mb-0">{{ cat.name }}</h4><span class="muted small">{{ cat.count }} course{{ cat.count === 1 ? '' : 's' }}</span></div>
              </a>
            }
          </div>
        </div>
      </section>

      <!-- INTRO + WHY US -->
      <section class="section">
        <div class="container grid grid-2 intro">
          <div>
            <span class="eyebrow">About the institute</span>
            <h2>Practical learning, built around real careers</h2>
            <p class="muted">We are a professional training institute focused on job-relevant technology and digital skills. Every program combines live instruction, guided labs and real-world projects so you leave with skills you can demonstrate, not just certificates.</p>
            <a routerLink="/about" class="btn btn-primary">More about us</a>
          </div>
          <div class="grid grid-2 why">
            @for (w of whyUs; track w.title) {
              <div class="card"><div class="icon-tile accent"><app-icon [name]="w.icon" /></div><h4 class="mt-2">{{ w.title }}</h4><p class="muted small mb-0">{{ w.text }}</p></div>
            }
          </div>
        </div>
      </section>

      <!-- TRAINERS -->
      <section class="section section-alt">
        <div class="container">
          <div class="head-row"><div><span class="eyebrow">Expert trainers</span><h2>Learn from practitioners</h2></div><a routerLink="/trainers" class="btn btn-outline">Meet all trainers</a></div>
          <div class="grid grid-4">
            @for (t of trainers().slice(0, 4); track t.id) {
              <article class="card card-hover trainer">
                <div class="avatar avatar-lg">@if (t.photoUrl) { <img [src]="t.photoUrl" [alt]="t.name" /> } @else { {{ initials(t.name) }} }</div>
                <h4 class="mt-2 mb-0">{{ t.name }}</h4>
                <p class="muted small mb-0">{{ t.designation }}</p>
                <span class="badge mt-2">{{ t.experienceYears }}+ years</span>
              </article>
            }
          </div>
        </div>
      </section>

      <!-- PLACEMENT -->
      <section class="section section-navy">
        <div class="container grid grid-2 placement">
          <div>
            <span class="eyebrow">Placement assistance</span>
            <h2>Career support from day one</h2>
            <p>Resume reviews, mock interviews, interview coaching and opportunity sharing to help you prepare for the job market.</p>
            <p class="small disclaimer">We provide placement assistance; we do not guarantee employment.</p>
            <a routerLink="/placements" class="btn btn-accent">See how it works</a>
          </div>
          <ol class="steps">
            @for (s of placementSteps; track s; let i = $index) { <li><span>{{ i + 1 }}</span>{{ s }}</li> }
          </ol>
        </div>
      </section>

      <!-- TESTIMONIALS -->
      @if (testimonials().length) {
        <section class="section">
          <div class="container">
            <div class="section-head"><span class="eyebrow">Student testimonials</span><h2>What learners say</h2></div>
            <div class="grid grid-2">
              @for (t of testimonials().slice(0, 4); track t.id) {
                <figure class="card quote">
                  <div class="stars" [attr.aria-label]="t.rating + ' out of 5 stars'">@for (s of stars(t.rating); track $index) { <app-icon name="star" [size]="16" /> }</div>
                  <blockquote>"{{ t.quote }}"</blockquote>
                  <figcaption><strong>{{ t.name }}</strong> <span class="muted">&middot; {{ t.course }}</span>
                    @if (t.isSample) { <span class="sample-note">Sample content</span> }
                  </figcaption>
                </figure>
              }
            </div>
          </div>
        </section>
      }

      <!-- BATCHES + EVENTS -->
      <section class="section section-alt">
        <div class="container grid grid-2 two-col">
          <div>
            <div class="head-row"><div><span class="eyebrow">Upcoming batches</span><h2>Start soon</h2></div><a routerLink="/batches" class="link-btn">All batches &rarr;</a></div>
            @for (b of batches().slice(0, 4); track b.id) {
              <a class="card row-card" routerLink="/batches">
                <div class="date-chip"><strong>{{ b.startDate.slice(8, 10) }}</strong><span>{{ month(b.startDate) }}</span></div>
                <div class="grow"><div class="cell-title">{{ b.courseTitle }}</div><div class="muted small">{{ b.days.join(', ') }} &middot; {{ b.startTime }}-{{ b.endTime }} &middot; {{ b.mode }}</div></div>
                <span class="badge" [class.badge-danger]="b.isFull" [class.badge-success]="!b.isFull">{{ b.isFull ? 'Full' : b.availableSeats + ' seats' }}</span>
              </a>
            } @empty { <p class="muted">New batches will be announced soon.</p> }
          </div>
          <div>
            <div class="head-row"><div><span class="eyebrow">Workshops &amp; events</span><h2>Join a session</h2></div></div>
            @for (e of events().slice(0, 4); track e.id) {
              <div class="card row-card">
                <div class="date-chip accent"><strong>{{ e.date.slice(8, 10) }}</strong><span>{{ month(e.date) }}</span></div>
                <div class="grow"><div class="cell-title">{{ e.title }}</div><div class="muted small">{{ e.type }} &middot; {{ e.startTime }} &middot; {{ e.mode }}</div></div>
                <a class="btn btn-sm btn-outline" routerLink="/contact" [queryParams]="{ subject: 'Event: ' + e.title }">Register interest</a>
              </div>
            } @empty { <p class="muted">No events scheduled right now. Subscribe below to hear about new ones.</p> }
          </div>
        </div>
      </section>

      <!-- FAQ -->
      <section class="section">
        <div class="container narrow">
          <div class="section-head"><span class="eyebrow">FAQ</span><h2>Frequently asked questions</h2></div>
          @for (f of faqs().slice(0, 5); track f.id) { <details class="faq"><summary>{{ f.question }}</summary><p>{{ f.answer }}</p></details> }
          <p class="text-center mt-3"><a routerLink="/faq" class="btn btn-outline">See all FAQs</a></p>
        </div>
      </section>
    }

    <!-- CONSULTATION + NEWSLETTER -->
    <section class="section-sm">
      <div class="container">
        <div class="consult">
          <div>
            <h2>Not sure which course fits you?</h2>
            <p>Book a free 1:1 consultation with a counsellor or trainer. Online, by phone or in person.</p>
          </div>
          <div class="flex flex-wrap">
            <a routerLink="/appointments" class="btn btn-accent btn-lg">Book a Free Consultation</a>
            <a routerLink="/contact" class="btn btn-light btn-lg">Contact us</a>
          </div>
        </div>
        <form class="newsletter card" [formGroup]="newsletter" (ngSubmit)="subscribe()" novalidate>
          <div><h3 class="mb-0">Get course updates</h3><p class="muted small mb-0">New batches, workshops and career tips. No spam.</p></div>
          <div class="field nl-field">
            <label for="nl-email" class="sr-only">Email address</label>
            <input id="nl-email" type="email" class="input" formControlName="email" placeholder="you@example.com" autocomplete="email" />
            <app-field-error [control]="newsletter.controls.email" label="Email" />
          </div>
          <button type="submit" class="btn btn-primary" [disabled]="subscribing()">{{ subscribing() ? 'Subscribing...' : 'Subscribe' }}</button>
        </form>
      </div>
    </section>
  `,
  styles: [`
    .hero { position: relative; overflow: hidden; background: radial-gradient(circle at 80% 10%, rgba(242,165,65,0.25), transparent 35%), radial-gradient(circle at 10% 90%, rgba(27,153,139,0.18), transparent 35%), linear-gradient(160deg, var(--navy-950), var(--navy-800)); color: #c9d6e8; }
    .hero::before { content: ''; position: absolute; inset: 0; background-image: linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px); background-size: 48px 48px; mask-image: linear-gradient(180deg, #000, transparent 85%); }
    .hero-grid { position: relative; display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 48px; align-items: center; padding-top: 88px; padding-bottom: 96px; }
    .hero h1 { color: var(--white); }
    .hl { color: var(--accent); display: block; }
    .eyebrow { color: var(--accent); }
    .lead { font-size: 1.15rem; max-width: 560px; }
    .cta { display: flex; flex-wrap: wrap; gap: 12px; margin: 28px 0 24px; }
    .login { color: var(--white); } .login:hover { background: rgba(255,255,255,0.08); color: var(--white); }
    .trust { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 8px 20px; font-size: 0.92rem; }
    .trust li { display: inline-flex; gap: 6px; align-items: center; } .trust app-icon { color: var(--accent); }
    .hero-art { position: relative; min-height: 340px; }
    .ticket { position: absolute; background: var(--white); color: var(--ink); border-radius: var(--radius-lg); box-shadow: var(--shadow-lg); }
    .ticket.main { inset: 30px 10px auto 30px; padding: 26px; border-top: 6px solid var(--accent); animation: fade-up .6s ease both .1s; }
    .ticket.main h3 { margin: 12px 0 2px; font-size: 1.3rem; }
    .ticket.main p { color: var(--ink-3); margin-bottom: 14px; }
    .t-row { display: flex; flex-wrap: wrap; gap: 14px; font-size: 0.88rem; color: var(--ink-2); }
    .t-row span { display: inline-flex; gap: 6px; align-items: center; }
    .seats { margin-top: 18px; } .bar { height: 8px; border-radius: 99px; background: var(--navy-100); overflow: hidden; margin-bottom: 6px; }
    .bar span { display: block; height: 100%; background: linear-gradient(90deg, var(--teal), var(--accent)); border-radius: 99px; }
    .seats small { color: var(--ink-3); }
    .ticket.mini { display: flex; gap: 10px; align-items: center; padding: 12px 16px; font-size: 0.88rem; }
    .ticket.mini app-icon { color: var(--accent-600); }
    .one { left: 0; bottom: 18px; animation: fade-up .6s ease both .3s; } .two { right: 0; top: 0; animation: fade-up .6s ease both .45s; }
    @media (max-width: 960px) { .hero-grid { grid-template-columns: 1fr; padding-top: 56px; padding-bottom: 64px; } .hero-art { min-height: 300px; } }
    .stats-band { background: var(--white); border-bottom: 1px solid var(--line); }
    .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; padding-top: 28px; }
    .stats div { display: flex; flex-direction: column; border-left: 3px solid var(--accent); padding-left: 16px; }
    .stats strong { font-family: var(--font-display); font-size: 2rem; color: var(--navy-900); line-height: 1.1; }
    .stats span { color: var(--ink-3); font-size: 0.9rem; }
    .stats-note { font-size: 0.78rem; color: var(--ink-3); padding-bottom: 20px; padding-top: 10px; margin: 0 auto; }
    @media (max-width: 720px) { .stats { grid-template-columns: 1fr 1fr; } }
    .head-row { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; margin-bottom: 28px; }
    .head-row h2 { margin: 0; }
    .cat { display: flex; gap: 14px; align-items: center; color: inherit; }
    .intro { align-items: center; gap: 48px; }
    .why .card { padding: 20px; }
    .trainer { text-align: center; display: flex; flex-direction: column; align-items: center; }
    .placement { align-items: center; gap: 48px; }
    .disclaimer { color: var(--accent); }
    .steps { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
    .steps li { display: flex; gap: 14px; align-items: center; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 14px 16px; color: var(--white); font-weight: 500; }
    .steps span { width: 32px; height: 32px; border-radius: 50%; background: var(--accent); color: var(--navy-950); display: grid; place-items: center; font-weight: 800; flex-shrink: 0; }
    .quote { margin: 0; display: flex; flex-direction: column; gap: 12px; }
    .quote blockquote { margin: 0; font-size: 1.02rem; color: var(--ink-2); }
    .quote figcaption { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .stars { color: var(--accent); display: flex; gap: 2px; }
    .two-col { gap: 40px; }
    .row-card { display: flex; gap: 14px; align-items: center; padding: 14px 16px; margin-bottom: 12px; color: inherit; }
    .grow { flex: 1; min-width: 0; }
    .date-chip { width: 54px; flex-shrink: 0; text-align: center; border-radius: 12px; background: var(--navy-900); color: var(--white); padding: 6px 0; line-height: 1.15; display: flex; flex-direction: column; }
    .date-chip strong { font-family: var(--font-display); font-size: 1.3rem; } .date-chip span { font-size: 0.72rem; text-transform: uppercase; }
    .date-chip.accent { background: var(--accent); color: var(--navy-950); }
    .narrow { max-width: 820px; }
    .consult { display: flex; justify-content: space-between; align-items: center; gap: 24px; flex-wrap: wrap; padding: 40px; border-radius: var(--radius-lg); background: linear-gradient(120deg, var(--navy-900), var(--navy-700)); color: #c9d6e8; }
    .consult h2 { color: var(--white); margin-bottom: 6px; } .consult p { margin: 0; }
    .newsletter { margin-top: 24px; display: grid; grid-template-columns: 1fr minmax(220px, 340px) auto; gap: 16px; align-items: start; }
    .nl-field { gap: 4px; }
    @media (max-width: 760px) { .newsletter { grid-template-columns: 1fr; } .consult { padding: 28px; } }
  `],
})
export class HomeComponent implements OnInit {
  auth = inject(AuthService);
  private courseService = inject(CourseService);
  private trainerService = inject(TrainerService);
  private batchService = inject(BatchService);
  private content = inject(ContentService);
  private toast = inject(ToastService);
  private fb = inject(FormBuilder);

  loading = signal(true);
  error = signal<ApiErrorInfo | null>(null);
  courses = signal<Course[]>([]);
  categoryNames = signal<string[]>([]);
  trainers = signal<Trainer[]>([]);
  batches = signal<Batch[]>([]);
  testimonials = signal<Testimonial[]>([]);
  events = signal<EventItem[]>([]);
  faqs = signal<Faq[]>([]);
  subscribing = signal(false);
  initials = initials;

  newsletter = this.fb.nonNullable.group({ email: ['', [Validators.required, Validators.email]] });

  featured = computed(() => {
    const list = this.courses();
    const f = list.filter((c) => c.featured);
    return (f.length >= 3 ? f : list).slice(0, 6);
  });
  enrolledTotal = computed(() => this.courses().reduce((sum, c) => sum + (c.enrolledCount || 0), 0));
  nextBatch = computed(() => this.batches().find((b) => !b.isFull) || null);
  categories = computed(() => {
    const icons: Record<string, string> = { 'Web Development': 'laptop', Programming: 'file', 'Data & AI': 'trending', 'Cloud & DevOps': 'layers', Security: 'shield', 'Quality Engineering': 'check', Marketing: 'target' };
    return this.categoryNames().map((name) => ({ name, icon: icons[name] || 'book', count: this.courses().filter((c) => c.category === name).length }));
  });

  readonly whyUs = [
    { icon: 'users', title: 'Expert mentors', text: 'Trainers with years of hands-on industry experience.' },
    { icon: 'layers', title: 'Project-based', text: 'Build portfolio projects using real team workflows.' },
    { icon: 'calendar', title: 'Flexible batches', text: 'Weekday, weekend, online, offline and hybrid options.' },
    { icon: 'target', title: 'Career focused', text: 'Resume, interview and placement assistance built in.' },
  ];
  readonly placementSteps = ['Skill assessment & career counselling', 'Project portfolio & resume building', 'Mock interviews with feedback', 'Interview scheduling support where available'];

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      courses: this.courseService.list({ sort: 'popular' }),
      trainers: this.trainerService.list(),
      batches: this.batchService.list({ status: 'upcoming' }),
      testimonials: this.content.testimonials(),
      events: this.content.events(),
      faqs: this.content.faqs(),
    }).subscribe({
      next: (r) => {
        this.courses.set(r.courses.items);
        this.categoryNames.set(r.courses.categories);
        this.trainers.set(r.trainers);
        this.batches.set(r.batches);
        this.testimonials.set(r.testimonials);
        this.events.set(r.events);
        this.faqs.set(r.faqs);
        this.loading.set(false);
      },
      error: (e: ApiErrorInfo) => {
        this.error.set(e);
        this.loading.set(false);
      },
    });
  }

  seatPct(b: Batch): number { return b.capacity ? Math.round(((b.seatsTaken || 0) / b.capacity) * 100) : 0; }
  stars(n: number): number[] { return Array.from({ length: n }); }
  month(date: string): string { return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(date.slice(5, 7)) - 1]; }

  subscribe(): void {
    if (this.newsletter.invalid) {
      this.newsletter.markAllAsTouched();
      return;
    }
    this.subscribing.set(true);
    this.content.subscribe(this.newsletter.getRawValue().email).subscribe({
      next: (r) => {
        this.toast.success(r.message);
        this.newsletter.reset();
        this.subscribing.set(false);
      },
      error: (e: ApiErrorInfo) => {
        this.toast.error(e.message);
        this.subscribing.set(false);
      },
    });
  }
}
