/**
 * Declarative configuration for the generic admin content manager.
 * Each entry drives the table columns and the create/edit form for one resource.
 */
export type CrudFieldType = 'text' | 'textarea' | 'number' | 'select' | 'checkbox' | 'date' | 'time' | 'lines' | 'multiselect' | 'url' | 'email';
export interface CrudOption { value: string; label: string; }
export interface CrudField {
  key: string; label: string; type: CrudFieldType; required?: boolean; options?: CrudOption[]; optionsSource?: 'courses' | 'trainers';
  hint?: string; min?: number; max?: number; full?: boolean; placeholder?: string;
}
export type CrudColumnType = 'text' | 'currency' | 'status' | 'bool' | 'list' | 'seats';
export interface CrudColumn { key: string; label: string; type?: CrudColumnType; secondary?: string; }
export interface CrudConfig {
  title: string; singular: string; subtitle: string; endpoint: string; listParams: Record<string, string>;
  columns: CrudColumn[]; fields: CrudField[]; searchKeys: string[];
  deleteMode: 'soft' | 'hard'; deleteLabel: string; deleteMessage: string; hardDeleteOption?: boolean; defaults: Record<string, unknown>;
}

const opts = (values: string[]): CrudOption[] => values.map((v) => ({ value: v, label: v }));
const DAYS = opts(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
const MODES = opts(['Online', 'Offline', 'Hybrid']);

export const CRUD_CONFIGS = {
  courses: {
    title: 'Courses', singular: 'Course', subtitle: 'Create and edit courses, fees, syllabus and enrollment availability.', endpoint: '/courses', listParams: { all: 'true', sort: 'title' },
    columns: [
      { key: 'title', label: 'Course', secondary: 'category' }, { key: 'level', label: 'Level' }, { key: 'mode', label: 'Mode' },
      { key: 'effectiveFee', label: 'Fee', type: 'currency' }, { key: 'trainerName', label: 'Trainer' }, { key: 'enrollmentOpen', label: 'Open', type: 'bool' }, { key: 'status', label: 'Status', type: 'status' },
    ],
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true, full: true },
      { key: 'category', label: 'Category', type: 'text', required: true, hint: 'e.g. Web Development, Data & AI' },
      { key: 'slug', label: 'URL slug', type: 'text', hint: 'Leave empty to generate from the title' },
      { key: 'shortDescription', label: 'Short description', type: 'text', required: true, full: true },
      { key: 'description', label: 'Detailed description', type: 'textarea', required: true, full: true },
      { key: 'duration', label: 'Duration', type: 'text', required: true, placeholder: '12 weeks' },
      { key: 'level', label: 'Level', type: 'select', required: true, options: opts(['Beginner', 'Intermediate', 'Advanced']) },
      { key: 'fee', label: 'Fee (INR)', type: 'number', required: true, min: 0 },
      { key: 'discountedFee', label: 'Discounted fee (INR)', type: 'number', min: 0, hint: 'Optional' },
      { key: 'mode', label: 'Learning mode', type: 'select', required: true, options: MODES },
      { key: 'trainerId', label: 'Lead trainer', type: 'select', optionsSource: 'trainers' },
      { key: 'imageUrl', label: 'Image URL', type: 'url', hint: 'Optional. A themed thumbnail is used otherwise.', full: true },
      { key: 'syllabus', label: 'Syllabus (one module per line)', type: 'lines', full: true },
      { key: 'prerequisites', label: 'Prerequisites (one per line)', type: 'lines' },
      { key: 'outcomes', label: 'Learning outcomes (one per line)', type: 'lines' },
      { key: 'status', label: 'Status', type: 'select', options: [{ value: 'active', label: 'Active' }, { value: 'draft', label: 'Draft' }, { value: 'archived', label: 'Archived' }] },
      { key: 'enrollmentOpen', label: 'Enrollment open', type: 'checkbox' },
      { key: 'featured', label: 'Featured on home page', type: 'checkbox' },
    ],
    searchKeys: ['title', 'category', 'trainerName'], deleteMode: 'soft', deleteLabel: 'Archive', hardDeleteOption: true,
    deleteMessage: 'Archiving hides the course from the public catalogue and closes enrollment. Existing records are kept.',
    defaults: { level: 'Beginner', mode: 'Online', status: 'active', enrollmentOpen: true, featured: false },
  },
  trainers: {
    title: 'Trainers', singular: 'Trainer', subtitle: 'Trainer profiles, course assignments and availability.', endpoint: '/trainers', listParams: { includeInactive: 'true' },
    columns: [
      { key: 'name', label: 'Trainer', secondary: 'designation' }, { key: 'specialization', label: 'Specialization' }, { key: 'experienceYears', label: 'Years' },
      { key: 'availabilityDays', label: 'Available', type: 'list' }, { key: 'userId', label: 'Login', type: 'bool' }, { key: 'isActive', label: 'Active', type: 'bool' },
    ],
    fields: [
      { key: 'name', label: 'Full name', type: 'text', required: true },
      { key: 'designation', label: 'Designation', type: 'text', required: true },
      { key: 'specialization', label: 'Specialization', type: 'text', required: true, full: true },
      { key: 'experienceYears', label: 'Years of experience', type: 'number', required: true, min: 0, max: 60 },
      { key: 'email', label: 'Contact email (private)', type: 'email' },
      { key: 'bio', label: 'Biography', type: 'textarea', required: true, full: true },
      { key: 'certifications', label: 'Certifications (one per line)', type: 'lines', full: true },
      { key: 'courseIds', label: 'Courses taught', type: 'multiselect', optionsSource: 'courses', full: true },
      { key: 'availabilityDays', label: 'Available days', type: 'multiselect', options: DAYS, full: true },
      { key: 'availableFrom', label: 'Available from', type: 'time' },
      { key: 'availableTo', label: 'Available until', type: 'time' },
      { key: 'photoUrl', label: 'Photo URL', type: 'url' },
      { key: 'isActive', label: 'Active', type: 'checkbox' },
    ],
    searchKeys: ['name', 'specialization', 'designation'], deleteMode: 'soft', deleteLabel: 'Deactivate', hardDeleteOption: true,
    deleteMessage: 'Deactivating hides the trainer from the website, prevents new bookings and disables any linked login.',
    defaults: { availabilityDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], availableFrom: '10:00', availableTo: '18:00', isActive: true, experienceYears: 1 },
  },
  batches: {
    title: 'Batches', singular: 'Batch', subtitle: 'Schedule batches, assign trainers and manage capacity.', endpoint: '/batches', listParams: { all: 'true' },
    columns: [
      { key: 'name', label: 'Batch', secondary: 'courseTitle' }, { key: 'trainerName', label: 'Trainer' }, { key: 'startDate', label: 'Starts' },
      { key: 'days', label: 'Days', type: 'list' }, { key: 'mode', label: 'Mode' }, { key: 'availableSeats', label: 'Seats', type: 'seats' }, { key: 'status', label: 'Status', type: 'status' },
    ],
    fields: [
      { key: 'name', label: 'Batch name', type: 'text', required: true },
      { key: 'courseId', label: 'Course', type: 'select', required: true, optionsSource: 'courses' },
      { key: 'trainerId', label: 'Trainer', type: 'select', optionsSource: 'trainers' },
      { key: 'mode', label: 'Mode', type: 'select', required: true, options: MODES },
      { key: 'startDate', label: 'Start date', type: 'date', required: true },
      { key: 'endDate', label: 'End date', type: 'date', required: true },
      { key: 'startTime', label: 'Class starts', type: 'time', required: true },
      { key: 'endTime', label: 'Class ends', type: 'time', required: true },
      { key: 'days', label: 'Weekly schedule', type: 'multiselect', required: true, options: DAYS, full: true },
      { key: 'capacity', label: 'Capacity', type: 'number', required: true, min: 1, max: 500 },
      { key: 'status', label: 'Status', type: 'select', options: opts(['upcoming', 'ongoing', 'completed', 'cancelled']) },
      { key: 'location', label: 'Location / link info', type: 'text', full: true },
      { key: 'notes', label: 'Notes', type: 'textarea', full: true },
    ],
    searchKeys: ['name', 'courseTitle', 'trainerName'], deleteMode: 'hard', deleteLabel: 'Delete',
    deleteMessage: 'Batches with assigned students cannot be deleted; set their status to "cancelled" instead.',
    defaults: { mode: 'Online', status: 'upcoming', capacity: 30, days: ['Mon', 'Wed', 'Fri'], startTime: '10:00', endTime: '12:00' },
  },
  services: {
    title: 'Services', singular: 'Service', subtitle: 'Services shown on the website. Lower order numbers appear first.', endpoint: '/services', listParams: { all: 'true' },
    columns: [{ key: 'order', label: '#' }, { key: 'title', label: 'Service', secondary: 'deliveryMode' }, { key: 'ctaLabel', label: 'Button' }, { key: 'ctaType', label: 'Links to' }, { key: 'isEnabled', label: 'Enabled', type: 'bool' }],
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'icon', label: 'Icon', type: 'select', options: opts(['classroom', 'monitor', 'building', 'user', 'calendar', 'zap', 'briefcase', 'layers', 'compass', 'file', 'message', 'mic', 'target', 'award', 'tool', 'sliders', 'spark']) },
      { key: 'description', label: 'Description', type: 'textarea', required: true, full: true },
      { key: 'benefits', label: 'Benefits (one per line)', type: 'lines', full: true },
      { key: 'deliveryMode', label: 'Delivery mode', type: 'text', required: true },
      { key: 'order', label: 'Display order', type: 'number', min: 0, max: 1000 },
      { key: 'ctaLabel', label: 'Button label', type: 'text' },
      { key: 'ctaType', label: 'Button destination', type: 'select', options: [{ value: 'appointment', label: 'Appointment booking' }, { value: 'courses', label: 'Courses' }, { value: 'contact', label: 'Inquiry form' }, { value: 'batches', label: 'Batches' }, { value: 'placements', label: 'Placements' }] },
      { key: 'isEnabled', label: 'Enabled (visible on website)', type: 'checkbox' },
    ],
    searchKeys: ['title', 'description'], deleteMode: 'hard', deleteLabel: 'Delete', deleteMessage: 'Tip: untick "Enabled" to hide a service without deleting it.',
    defaults: { icon: 'spark', ctaType: 'appointment', ctaLabel: 'Book a Consultation', order: 100, isEnabled: true },
  },
  testimonials: {
    title: 'Testimonials', singular: 'Testimonial', subtitle: 'Quotes shown on the home page. Mark demo content as sample.', endpoint: '/testimonials', listParams: { all: 'true' },
    columns: [{ key: 'name', label: 'Name', secondary: 'course' }, { key: 'rating', label: 'Rating' }, { key: 'isSample', label: 'Sample', type: 'bool' }, { key: 'isPublished', label: 'Published', type: 'bool' }],
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true }, { key: 'course', label: 'Course', type: 'text', required: true },
      { key: 'role', label: 'Role / caption', type: 'text' }, { key: 'rating', label: 'Rating (1-5)', type: 'number', min: 1, max: 5 },
      { key: 'quote', label: 'Quote', type: 'textarea', required: true, full: true },
      { key: 'isPublished', label: 'Published', type: 'checkbox' }, { key: 'isSample', label: 'Sample / demo content (labelled on site)', type: 'checkbox' },
    ],
    searchKeys: ['name', 'course', 'quote'], deleteMode: 'hard', deleteLabel: 'Delete', deleteMessage: 'This testimonial will be removed permanently.',
    defaults: { rating: 5, isPublished: true, isSample: false },
  },
  faqs: {
    title: 'FAQs', singular: 'FAQ', subtitle: 'Questions grouped by category on the FAQ page.', endpoint: '/faqs', listParams: { all: 'true' },
    columns: [{ key: 'question', label: 'Question', secondary: 'category' }, { key: 'order', label: 'Order' }, { key: 'isPublished', label: 'Published', type: 'bool' }],
    fields: [
      { key: 'category', label: 'Category', type: 'select', required: true, options: opts(['Course Enrollment', 'Fees and Payment', 'Class Schedules', 'Certificates', 'Online Training', 'Offline Training', 'Placement Assistance', 'Appointment Booking', 'Cancellation Policies', 'General']) },
      { key: 'order', label: 'Order', type: 'number', min: 0, max: 1000 },
      { key: 'question', label: 'Question', type: 'text', required: true, full: true },
      { key: 'answer', label: 'Answer', type: 'textarea', required: true, full: true },
      { key: 'isPublished', label: 'Published', type: 'checkbox' },
    ],
    searchKeys: ['question', 'answer', 'category'], deleteMode: 'hard', deleteLabel: 'Delete', deleteMessage: 'This FAQ will be removed permanently.',
    defaults: { category: 'General', order: 100, isPublished: true },
  },
  events: {
    title: 'Workshops & events', singular: 'Event', subtitle: 'Upcoming workshops, webinars and events shown on the home page.', endpoint: '/events', listParams: { all: 'true' },
    columns: [{ key: 'title', label: 'Event', secondary: 'type' }, { key: 'date', label: 'Date' }, { key: 'startTime', label: 'Time' }, { key: 'mode', label: 'Mode' }, { key: 'isPublished', label: 'Published', type: 'bool' }],
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true, full: true },
      { key: 'type', label: 'Type', type: 'select', required: true, options: opts(['Workshop', 'Webinar', 'Seminar', 'Hackathon', 'Career Fair']) },
      { key: 'mode', label: 'Mode', type: 'select', required: true, options: MODES },
      { key: 'date', label: 'Date', type: 'date', required: true }, { key: 'startTime', label: 'Start time', type: 'time', required: true },
      { key: 'endTime', label: 'End time', type: 'time' }, { key: 'location', label: 'Location', type: 'text' },
      { key: 'description', label: 'Description', type: 'textarea', required: true, full: true },
      { key: 'isPublished', label: 'Published', type: 'checkbox' },
    ],
    searchKeys: ['title', 'type', 'description'], deleteMode: 'hard', deleteLabel: 'Delete', deleteMessage: 'This event will be removed permanently.',
    defaults: { type: 'Workshop', mode: 'Online', isPublished: true },
  },
} satisfies Record<string, CrudConfig>;
