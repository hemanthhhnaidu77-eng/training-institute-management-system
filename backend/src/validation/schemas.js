'use strict';
/** Request-body schemas used by controllers (see utils/validate.js for rule types). */

const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];
const MODES = ['Online', 'Offline', 'Hybrid'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const CONSULTATION_MODES = ['Online', 'Phone', 'In Person'];
const INQUIRY_CATEGORIES = ['Course Information', 'Fees and Payment', 'Admissions', 'Corporate Training', 'Placement Support', 'Technical Support', 'Feedback', 'Other'];
const INQUIRY_STATUSES = ['new', 'in_progress', 'resolved', 'closed'];
const APPOINTMENT_STATUSES = ['pending', 'confirmed', 'completed', 'cancelled', 'rescheduled'];
const ENROLLMENT_STATUSES = ['pending', 'approved', 'rejected', 'completed', 'cancelled'];
const BATCH_STATUSES = ['upcoming', 'ongoing', 'completed', 'cancelled'];

const list = (maxItems = 40, maxLength = 300) => ({ type: 'array', maxItems, items: { type: 'string', maxLength } });

const register = {
  fullName: { type: 'string', required: true, minLength: 2, maxLength: 80 },
  email: { type: 'email', required: true },
  mobile: { type: 'mobile', required: true },
  password: { type: 'password', required: true },
  preferredCourseId: { type: 'id' },
  acceptTerms: { type: 'boolean', required: true },
};

const login = {
  email: { type: 'email', required: true },
  password: { type: 'string', required: true, maxLength: 128 },
  remember: { type: 'boolean', default: false },
};

const forgotPassword = { email: { type: 'email', required: true } };
const resetPassword = {
  token: { type: 'string', required: true, minLength: 32, maxLength: 128, pattern: /^[a-f0-9]+$/ },
  password: { type: 'password', required: true },
};
const changePassword = {
  currentPassword: { type: 'string', required: true, maxLength: 128 },
  newPassword: { type: 'password', required: true, label: 'New password' },
};

const profile = {
  fullName: { type: 'string', minLength: 2, maxLength: 80, required: true },
  mobile: { type: 'mobile', required: true },
  preferredCourseId: { type: 'id' },
};

const staffUser = {
  role: { type: 'enum', values: ['admin', 'trainer'], required: true },
  fullName: { type: 'string', required: true, minLength: 2, maxLength: 80 },
  email: { type: 'email', required: true },
  mobile: { type: 'mobile', required: true },
  password: { type: 'password', required: true },
  trainerId: { type: 'id' },
};

const course = {
  title: { type: 'string', required: true, minLength: 3, maxLength: 120 },
  slug: { type: 'string', maxLength: 120, pattern: /^[a-z0-9-]+$/, patternMessage: 'Slug may only contain lowercase letters, numbers and hyphens' },
  category: { type: 'string', required: true, maxLength: 60 },
  imageUrl: { type: 'url' },
  shortDescription: { type: 'string', required: true, maxLength: 300 },
  description: { type: 'text', required: true, maxLength: 5000 },
  duration: { type: 'string', required: true, maxLength: 60 },
  level: { type: 'enum', values: LEVELS, required: true },
  fee: { type: 'number', required: true, min: 0, max: 1000000 },
  discountedFee: { type: 'number', min: 0, max: 1000000 },
  mode: { type: 'enum', values: MODES, required: true },
  trainerId: { type: 'id' },
  syllabus: list(40),
  prerequisites: list(20),
  outcomes: list(20),
  status: { type: 'enum', values: ['active', 'draft', 'archived'], default: 'active' },
  enrollmentOpen: { type: 'boolean', default: true },
  featured: { type: 'boolean', default: false },
};

const trainer = {
  name: { type: 'string', required: true, minLength: 2, maxLength: 80 },
  photoUrl: { type: 'url' },
  designation: { type: 'string', required: true, maxLength: 100 },
  specialization: { type: 'string', required: true, maxLength: 150 },
  experienceYears: { type: 'number', required: true, min: 0, max: 60, integer: true },
  certifications: list(20, 150),
  bio: { type: 'text', required: true, maxLength: 2000 },
  courseIds: { type: 'array', maxItems: 30, unique: true, items: { type: 'id' } },
  availabilityDays: { type: 'array', unique: true, items: { type: 'enum', values: DAYS }, default: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
  availableFrom: { type: 'time', default: '10:00' },
  availableTo: { type: 'time', default: '18:00' },
  email: { type: 'email' },
  isActive: { type: 'boolean', default: true },
};

const trainerSelf = {
  photoUrl: trainer.photoUrl,
  bio: trainer.bio,
  certifications: trainer.certifications,
  specialization: trainer.specialization,
};

const service = {
  title: { type: 'string', required: true, maxLength: 100 },
  icon: { type: 'string', maxLength: 40, default: 'spark' },
  description: { type: 'text', required: true, maxLength: 1500 },
  benefits: list(10, 200),
  deliveryMode: { type: 'string', required: true, maxLength: 100 },
  ctaLabel: { type: 'string', maxLength: 40, default: 'Book a Consultation' },
  ctaType: { type: 'enum', values: ['courses', 'appointment', 'contact', 'placements', 'batches'], default: 'appointment' },
  order: { type: 'number', integer: true, min: 0, max: 1000, default: 100 },
  isEnabled: { type: 'boolean', default: true },
};

const batch = {
  name: { type: 'string', required: true, maxLength: 100 },
  courseId: { type: 'id', required: true },
  trainerId: { type: 'id' },
  startDate: { type: 'date', required: true },
  endDate: { type: 'date', required: true },
  startTime: { type: 'time', required: true },
  endTime: { type: 'time', required: true },
  days: { type: 'array', required: true, minItems: 1, unique: true, items: { type: 'enum', values: DAYS } },
  mode: { type: 'enum', values: MODES, required: true },
  location: { type: 'string', maxLength: 150 },
  capacity: { type: 'number', required: true, integer: true, min: 1, max: 500 },
  status: { type: 'enum', values: BATCH_STATUSES, default: 'upcoming' },
  notes: { type: 'text', maxLength: 1000 },
};

const enrollmentRequest = {
  courseId: { type: 'id', required: true },
  batchId: { type: 'id' },
  note: { type: 'text', maxLength: 1000 },
};

const enrollmentStatus = {
  status: { type: 'enum', values: ENROLLMENT_STATUSES, required: true },
  batchId: { type: 'id' },
  adminNote: { type: 'text', maxLength: 1000 },
};

const appointment = {
  fullName: { type: 'string', required: true, minLength: 2, maxLength: 80 },
  email: { type: 'email', required: true },
  mobile: { type: 'mobile', required: true },
  courseId: { type: 'id' },
  serviceId: { type: 'id' },
  trainerId: { type: 'id' },
  date: { type: 'date', required: true },
  time: { type: 'time', required: true, label: 'Time slot' },
  mode: { type: 'enum', values: CONSULTATION_MODES, required: true, label: 'Consultation mode' },
  message: { type: 'text', maxLength: 1500 },
};

const appointmentCancel = { reason: { type: 'text', maxLength: 500 } };
const appointmentReschedule = {
  date: { type: 'date', required: true },
  time: { type: 'time', required: true, label: 'Time slot' },
  reason: { type: 'text', maxLength: 500 },
};
const appointmentAdminAction = {
  action: { type: 'enum', values: ['confirm', 'reject', 'cancel', 'complete', 'reschedule', 'dismiss_request'], required: true },
  date: { type: 'date' },
  time: { type: 'time' },
  note: { type: 'text', maxLength: 500 },
};
const appointmentTrainerAction = {
  action: { type: 'enum', values: ['confirm', 'complete'], required: true },
  note: { type: 'text', maxLength: 500 },
};

const inquiry = {
  name: { type: 'string', required: true, minLength: 2, maxLength: 80 },
  email: { type: 'email', required: true },
  mobile: { type: 'mobile' },
  category: { type: 'enum', values: INQUIRY_CATEGORIES, required: true },
  subject: { type: 'string', required: true, maxLength: 150 },
  message: { type: 'text', required: true, minLength: 10, maxLength: 3000 },
};
const inquiryStatus = {
  status: { type: 'enum', values: INQUIRY_STATUSES, required: true },
  note: { type: 'text', maxLength: 1000 },
};
const inquiryNote = { note: { type: 'text', required: true, maxLength: 1000 } };

const newsletter = { email: { type: 'email', required: true }, name: { type: 'string', maxLength: 80 } };

const testimonial = {
  name: { type: 'string', required: true, maxLength: 80 },
  course: { type: 'string', required: true, maxLength: 120 },
  quote: { type: 'text', required: true, maxLength: 800 },
  rating: { type: 'number', integer: true, min: 1, max: 5, default: 5 },
  role: { type: 'string', maxLength: 100 },
  isPublished: { type: 'boolean', default: true },
  isSample: { type: 'boolean', default: false },
};

const faq = {
  category: { type: 'string', required: true, maxLength: 60 },
  question: { type: 'string', required: true, maxLength: 250 },
  answer: { type: 'text', required: true, maxLength: 2000 },
  order: { type: 'number', integer: true, min: 0, max: 1000, default: 100 },
  isPublished: { type: 'boolean', default: true },
};

const event = {
  title: { type: 'string', required: true, maxLength: 120 },
  type: { type: 'enum', values: ['Workshop', 'Webinar', 'Seminar', 'Hackathon', 'Career Fair'], required: true },
  date: { type: 'date', required: true },
  startTime: { type: 'time', required: true },
  endTime: { type: 'time' },
  mode: { type: 'enum', values: ['Online', 'Offline', 'Hybrid'], required: true },
  location: { type: 'string', maxLength: 150 },
  description: { type: 'text', required: true, maxLength: 1500 },
  isPublished: { type: 'boolean', default: true },
};

const review = {
  courseId: { type: 'id', required: true },
  rating: { type: 'number', required: true, integer: true, min: 1, max: 5 },
  comment: { type: 'text', required: true, minLength: 10, maxLength: 1500 },
};
const reviewModeration = {
  status: { type: 'enum', values: ['approved', 'rejected', 'pending'], required: true },
  publishAsTestimonial: { type: 'boolean', default: false },
};

const studentAdminUpdate = {
  fullName: { type: 'string', minLength: 2, maxLength: 80 },
  mobile: { type: 'mobile' },
  isActive: { type: 'boolean' },
};

const sessionRecord = {
  batchId: { type: 'id', required: true },
  date: { type: 'date', required: true },
  topic: { type: 'string', required: true, maxLength: 200 },
  notes: { type: 'text', maxLength: 1500 },
  attendeesCount: { type: 'number', integer: true, min: 0, max: 500 },
};

const settings = {
  instituteName: { type: 'string', maxLength: 100 },
  tagline: { type: 'string', maxLength: 200 },
  email: { type: 'email' },
  phone: { type: 'string', maxLength: 30 },
  whatsapp: { type: 'string', maxLength: 30 },
  address: { type: 'text', maxLength: 300 },
  workingHours: { type: 'string', maxLength: 150 },
  mapEmbedUrl: { type: 'url' },
  timezone: { type: 'enum', values: ['Asia/Kolkata', 'UTC'] },
  socials: {
    type: 'object',
    schema: {
      facebook: { type: 'url' },
      instagram: { type: 'url' },
      linkedin: { type: 'url' },
      youtube: { type: 'url' },
      x: { type: 'url' },
    },
  },
  branding: {
    type: 'object',
    schema: {
      logoText: { type: 'string', maxLength: 6 },
      primaryColor: { type: 'color' },
      accentColor: { type: 'color' },
    },
  },
  appointment: {
    type: 'object',
    schema: {
      slots: { type: 'array', unique: true, minItems: 1, maxItems: 24, items: { type: 'time' } },
      workingDays: { type: 'array', unique: true, minItems: 1, items: { type: 'enum', values: DAYS } },
      slotMinutes: { type: 'number', integer: true, min: 15, max: 120 },
      counselorsPerSlot: { type: 'number', integer: true, min: 1, max: 20 },
      bookingWindowDays: { type: 'number', integer: true, min: 1, max: 180 },
    },
  },
};

module.exports = {
  LEVELS, MODES, DAYS, CONSULTATION_MODES, INQUIRY_CATEGORIES, INQUIRY_STATUSES, APPOINTMENT_STATUSES,
  ENROLLMENT_STATUSES, BATCH_STATUSES,
  register, login, forgotPassword, resetPassword, changePassword, profile, staffUser, course, trainer, trainerSelf,
  service, batch, enrollmentRequest, enrollmentStatus, appointment, appointmentCancel, appointmentReschedule,
  appointmentAdminAction, appointmentTrainerAction, inquiry, inquiryStatus, inquiryNote, newsletter, testimonial,
  faq, event, review, reviewModeration, studentAdminUpdate, sessionRecord, settings,
};
