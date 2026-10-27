import { Routes } from '@angular/router';
import { authGuard, guestGuard, roleGuard } from './core/guards/auth.guards';
import { DashboardLayoutComponent } from './layout/dashboard-layout/dashboard-layout.component';
import { PublicLayoutComponent } from './layout/public-layout/public-layout.component';
import { CRUD_CONFIGS } from './features/admin-dashboard/crud-configs';

const crud = (key: keyof typeof CRUD_CONFIGS, title: string) => ({
  path: key,
  title: `${title} | Admin`,
  data: { crud: CRUD_CONFIGS[key] },
  loadComponent: () => import('./features/admin-dashboard/admin-crud.component').then((m) => m.AdminCrudComponent),
});

export const routes: Routes = [
  {
    path: '',
    component: PublicLayoutComponent,
    children: [
      { path: '', title: 'Navigate Tech Academy | Learn Today. Build Tomorrow.', loadComponent: () => import('./features/home/home.component').then((m) => m.HomeComponent) },
      { path: 'about', title: 'About Us', loadComponent: () => import('./features/about/about.component').then((m) => m.AboutComponent) },
      { path: 'courses', title: 'Courses', loadComponent: () => import('./features/courses/course-list.component').then((m) => m.CourseListComponent) },
      { path: 'courses/:slug', title: 'Course details', loadComponent: () => import('./features/courses/course-detail.component').then((m) => m.CourseDetailComponent) },
      { path: 'services', title: 'Services', loadComponent: () => import('./features/services/services-page.component').then((m) => m.ServicesPageComponent) },
      { path: 'trainers', title: 'Trainers', loadComponent: () => import('./features/trainers/trainers-page.component').then((m) => m.TrainersPageComponent) },
      { path: 'batches', title: 'Batches & Schedule', loadComponent: () => import('./features/batches/batches-page.component').then((m) => m.BatchesPageComponent) },
      { path: 'placements', title: 'Placements & Career Support', loadComponent: () => import('./features/placements/placements.component').then((m) => m.PlacementsComponent) },
      { path: 'appointments', title: 'Book an Appointment', loadComponent: () => import('./features/appointments/appointment-booking.component').then((m) => m.AppointmentBookingComponent) },
      { path: 'contact', title: 'Contact Us', loadComponent: () => import('./features/contact/contact.component').then((m) => m.ContactComponent) },
      { path: 'faq', title: 'FAQ', loadComponent: () => import('./features/faq/faq.component').then((m) => m.FaqComponent) },
      { path: 'terms', title: 'Terms & Privacy', loadComponent: () => import('./features/legal/terms.component').then((m) => m.TermsComponent) },
      { path: 'login', title: 'Login', canActivate: [guestGuard], loadComponent: () => import('./features/auth/login.component').then((m) => m.LoginComponent) },
      { path: 'register', title: 'Create account', canActivate: [guestGuard], loadComponent: () => import('./features/auth/register.component').then((m) => m.RegisterComponent) },
      { path: 'forgot-password', title: 'Forgot password', loadComponent: () => import('./features/auth/forgot-password.component').then((m) => m.ForgotPasswordComponent) },
      { path: 'reset-password', title: 'Reset password', loadComponent: () => import('./features/auth/reset-password.component').then((m) => m.ResetPasswordComponent) },
    ],
  },
  {
    path: 'student',
    component: DashboardLayoutComponent,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['student'] },
    children: [
      { path: '', title: 'Student dashboard', loadComponent: () => import('./features/student-dashboard/student-overview.component').then((m) => m.StudentOverviewComponent) },
      { path: 'courses', title: 'My courses', loadComponent: () => import('./features/student-dashboard/student-courses.component').then((m) => m.StudentCoursesComponent) },
      { path: 'appointments', title: 'My appointments', loadComponent: () => import('./features/student-dashboard/student-appointments.component').then((m) => m.StudentAppointmentsComponent) },
      { path: 'schedule', title: 'My schedule', loadComponent: () => import('./features/student-dashboard/student-schedule.component').then((m) => m.StudentScheduleComponent) },
      { path: 'notifications', title: 'Notifications', loadComponent: () => import('./features/profile/notifications.component').then((m) => m.NotificationsComponent) },
      { path: 'profile', title: 'My profile', loadComponent: () => import('./features/profile/profile.component').then((m) => m.ProfileComponent) },
    ],
  },
  {
    path: 'trainer',
    component: DashboardLayoutComponent,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['trainer'] },
    children: [
      { path: '', title: 'Trainer dashboard', loadComponent: () => import('./features/trainer-dashboard/trainer-overview.component').then((m) => m.TrainerOverviewComponent) },
      { path: 'courses', title: 'My courses', loadComponent: () => import('./features/trainer-dashboard/trainer-pages.component').then((m) => m.TrainerCoursesComponent) },
      { path: 'batches', title: 'My batches', loadComponent: () => import('./features/trainer-dashboard/trainer-batches.component').then((m) => m.TrainerBatchesComponent) },
      { path: 'schedule', title: 'My schedule', loadComponent: () => import('./features/trainer-dashboard/trainer-pages.component').then((m) => m.TrainerScheduleComponent) },
      { path: 'appointments', title: 'Appointments', loadComponent: () => import('./features/trainer-dashboard/trainer-pages.component').then((m) => m.TrainerAppointmentsComponent) },
      { path: 'students', title: 'Students', loadComponent: () => import('./features/trainer-dashboard/trainer-pages.component').then((m) => m.TrainerStudentsComponent) },
      { path: 'notifications', title: 'Notifications', loadComponent: () => import('./features/profile/notifications.component').then((m) => m.NotificationsComponent) },
      { path: 'profile', title: 'My profile', loadComponent: () => import('./features/profile/profile.component').then((m) => m.ProfileComponent) },
    ],
  },
  {
    path: 'admin',
    component: DashboardLayoutComponent,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['admin'] },
    children: [
      { path: '', title: 'Admin dashboard', loadComponent: () => import('./features/admin-dashboard/admin-overview.component').then((m) => m.AdminOverviewComponent) },
      { path: 'students', title: 'Students | Admin', loadComponent: () => import('./features/admin-dashboard/admin-students.component').then((m) => m.AdminStudentsComponent) },
      crud('courses', 'Courses'),
      crud('trainers', 'Trainers'),
      crud('batches', 'Batches'),
      crud('services', 'Services'),
      crud('testimonials', 'Testimonials'),
      crud('faqs', 'FAQs'),
      crud('events', 'Events'),
      { path: 'enrollments', title: 'Enrollments | Admin', loadComponent: () => import('./features/admin-dashboard/admin-enrollments.component').then((m) => m.AdminEnrollmentsComponent) },
      { path: 'appointments', title: 'Appointments | Admin', loadComponent: () => import('./features/admin-dashboard/admin-appointments.component').then((m) => m.AdminAppointmentsComponent) },
      { path: 'inquiries', title: 'Inquiries | Admin', loadComponent: () => import('./features/admin-dashboard/admin-inquiries.component').then((m) => m.AdminInquiriesComponent) },
      { path: 'reviews', title: 'Reviews | Admin', loadComponent: () => import('./features/admin-dashboard/admin-reviews.component').then((m) => m.AdminReviewsComponent) },
      { path: 'reports', title: 'Reports | Admin', loadComponent: () => import('./features/admin-dashboard/admin-reports.component').then((m) => m.AdminReportsComponent) },
      { path: 'settings', title: 'Settings | Admin', loadComponent: () => import('./features/admin-dashboard/admin-settings.component').then((m) => m.AdminSettingsComponent) },
      { path: 'notifications', title: 'Notifications', loadComponent: () => import('./features/profile/notifications.component').then((m) => m.NotificationsComponent) },
      { path: 'profile', title: 'My profile', loadComponent: () => import('./features/profile/profile.component').then((m) => m.ProfileComponent) },
    ],
  },
  { path: '**', title: 'Page not found', loadComponent: () => import('./features/not-found/not-found.component').then((m) => m.NotFoundComponent) },
];
