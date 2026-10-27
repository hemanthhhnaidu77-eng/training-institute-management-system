export type Role = 'admin' | 'student' | 'trainer';
export type Level = 'Beginner' | 'Intermediate' | 'Advanced';
export type LearningMode = 'Online' | 'Offline' | 'Hybrid';
export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'rescheduled';
export type EnrollmentStatus = 'pending' | 'approved' | 'rejected' | 'completed' | 'cancelled';

export interface ApiResponse<T> { success: boolean; data: T; meta?: PageMeta & Record<string, unknown>; }
export interface PageMeta { page?: number; limit?: number; total: number; totalPages?: number; }
export interface Paged<T> { items: T[]; meta: PageMeta; }
export interface FieldError { field: string; message: string; }
export interface ApiErrorInfo { status: number; code: string; message: string; details?: FieldError[] | Record<string, unknown>; }

export interface User {
  id: string; role: Role; fullName: string; email: string; mobile: string;
  preferredCourseId?: string | null; trainerId?: string | null; isActive: boolean;
  lastLoginAt?: string | null; createdAt: string; updatedAt: string; enrollmentCount?: number;
}
export interface AuthResult { user: User; token: string; expiresAt: string; }

export interface TrainerRef { id: string; title: string; slug: string; }
export interface Trainer {
  id: string; name: string; photoUrl?: string | null; designation: string; specialization: string; experienceYears: number;
  certifications: string[]; bio: string; courseIds: string[]; availabilityDays: string[]; availableFrom: string; availableTo: string;
  isActive: boolean; email?: string | null; userId?: string | null; courses?: TrainerRef[]; createdAt?: string;
}

export interface Batch {
  id: string; name: string; courseId: string; trainerId?: string | null; startDate: string; endDate: string; startTime: string; endTime: string;
  days: string[]; mode: LearningMode; location?: string | null; capacity: number; status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
  notes?: string | null; courseTitle?: string; courseSlug?: string | null; courseDuration?: string | null; trainerName?: string;
  seatsTaken?: number; availableSeats?: number; isFull?: boolean;
}

export interface Course {
  id: string; slug: string; title: string; category: string; imageUrl?: string | null; shortDescription: string; description: string;
  duration: string; level: Level; fee: number; discountedFee?: number | null; effectiveFee?: number; mode: LearningMode; trainerId?: string | null;
  trainerName?: string | null; syllabus: string[]; prerequisites: string[]; outcomes: string[]; status: 'active' | 'draft' | 'archived';
  enrollmentOpen: boolean; featured: boolean; batchCount?: number; enrolledCount?: number; rating?: number | null; reviewCount?: number;
  trainer?: Trainer | null; batches?: Batch[]; createdAt?: string; isPrimaryTrainer?: boolean;
}

export interface ServiceItem {
  id: string; title: string; icon: string; description: string; benefits: string[]; deliveryMode: string; ctaLabel: string;
  ctaType: 'courses' | 'appointment' | 'contact' | 'placements' | 'batches'; order: number; isEnabled: boolean;
}

export interface Slot { time: string; available: boolean; reason: string | null; }
export interface Availability { date: string; dayOpen: boolean; reason: string | null; slots: Slot[]; slotMinutes: number; timezone: string; trainerId: string | null; }
export interface StatusEntry { status: string; at: string; by: string; note?: string | null; }
export interface Appointment {
  id: string; appointmentNo: string; userId?: string | null; fullName: string; email: string; mobile: string;
  courseId?: string | null; serviceId?: string | null; trainerId?: string | null; courseTitle?: string | null; serviceTitle?: string | null; trainerName?: string | null;
  date: string; time: string; durationMinutes: number; mode: 'Online' | 'Phone' | 'In Person'; message?: string | null; status: AppointmentStatus;
  requestedAction?: { type: 'cancel' | 'reschedule'; date?: string; time?: string; reason?: string | null; requestedAt: string } | null;
  adminNote?: string | null; statusHistory: StatusEntry[]; createdAt: string; immediate?: boolean;
}

export interface Enrollment {
  id: string; studentId: string; courseId: string; batchId?: string | null; status: EnrollmentStatus; note?: string | null; adminNote?: string | null;
  certificateNo?: string | null; completedAt?: string | null; createdAt: string; studentName?: string; studentEmail?: string | null;
  courseTitle?: string; courseSlug?: string | null; courseDuration?: string | null; trainerName?: string | null;
  batch?: Pick<Batch, 'id' | 'name' | 'startDate' | 'endDate' | 'startTime' | 'endTime' | 'days' | 'mode' | 'location' | 'status'> | null;
  history?: StatusEntry[];
}

export interface InquiryNote { text: string; by: string; at: string; }
export interface Inquiry {
  id: string; ticketNo: string; name: string; email: string; mobile?: string | null; category: string; subject: string; message: string;
  status: 'new' | 'in_progress' | 'resolved' | 'closed'; notes?: InquiryNote[]; history?: StatusEntry[]; createdAt: string; updatedAt?: string;
}

export interface Faq { id: string; category: string; question: string; answer: string; order: number; isPublished: boolean; }
export interface Testimonial { id: string; name: string; course: string; quote: string; rating: number; role?: string | null; isPublished: boolean; isSample: boolean; }
export interface EventItem { id: string; title: string; type: string; date: string; startTime: string; endTime?: string | null; mode: string; location?: string | null; description: string; isPublished: boolean; }
export interface Review { id: string; studentId?: string; studentName: string; courseId: string; courseTitle?: string | null; rating: number; comment: string; status?: 'pending' | 'approved' | 'rejected'; createdAt: string; testimonialId?: string; }
export interface AppNotification { id: string; userId: string; title: string; message: string; type: 'info' | 'success' | 'warning'; link?: string | null; isRead: boolean; createdAt: string; }

export interface Settings {
  instituteName: string; tagline: string; email: string; phone: string; whatsapp?: string; address: string; workingHours: string;
  mapEmbedUrl?: string | null; timezone: string;
  socials: { facebook?: string | null; instagram?: string | null; linkedin?: string | null; youtube?: string | null; x?: string | null };
  branding: { logoText: string; primaryColor: string; accentColor: string };
  appointment: { slots: string[]; workingDays: string[]; slotMinutes: number; counselorsPerSlot: number; bookingWindowDays: number };
}

export interface ClassSession { date: string; day: string; startTime: string; endTime: string; batchId: string; batchName: string; courseTitle?: string; trainerName?: string; mode: string; location?: string | null; }
export interface ScheduleData { batches: Batch[]; sessions: ClassSession[]; }
export interface ActivityEntry { id: string; actorName: string; actorRole: string; action: string; entity: string; summary: string; createdAt: string; }
export interface SessionRecord { id: string; batchId: string; batchName?: string | null; date: string; topic: string; notes?: string | null; attendeesCount?: number | null; createdAt: string; }
export interface TrainerStudent { enrollmentId: string; studentId: string; fullName: string; email: string; batchId: string; batchName: string; courseTitle: string; status: string; }

export interface StudentDashboard {
  stats: { enrolledCourses: number; pendingEnrollments: number; completedCourses: number; upcomingAppointments: number; upcomingClasses: number; pendingInquiries: number; unreadNotifications: number };
  nextAppointments: Appointment[]; nextClasses: ClassSession[]; enrollments: Enrollment[]; notifications: AppNotification[];
}
export interface AdminDashboard {
  stats: Record<string, number>;
  trend: { month: string; registrations: number; enrollments: number; appointments: number }[];
  recentRegistrations: User[]; upcomingAppointments: Appointment[]; upcomingSessions: ClassSession[]; recentActivity: ActivityEntry[];
}
export interface TrainerDashboard { stats: Record<string, number>; nextAppointments?: Appointment[]; nextClasses?: ClassSession[]; profileMissing?: boolean; }
export interface Report { type: string; title: string; from: string | null; to: string | null; columns: { key: string; label: string }[]; rows: Record<string, unknown>[]; summary: { total: number; byStatus: Record<string, number> }; }
export interface StudentDetail extends User { enrollments: Enrollment[]; appointments: Appointment[]; }
