'use strict';
const { repos } = require('../storage');
const ApiError = require('../utils/ApiError');
const { cleanQueryString } = require('../utils/query');
const notifications = require('./notificationService');
const activity = require('./activityService');

function displayName(fullName) {
  const parts = String(fullName || 'Student').trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
}

async function create(user, { courseId, rating, comment }) {
  const course = await repos.courses.findById(courseId);
  if (!course) throw ApiError.notFound('Course not found');
  const eligible = await repos.enrollments.findOne((e) => e.studentId === user.id && e.courseId === courseId && ['approved', 'completed'].includes(e.status));
  if (!eligible) throw ApiError.forbidden('You can review a course once your enrollment has been approved', 'NOT_ENROLLED');
  const record = await repos.reviews.mutate((rows) => {
    if (rows.some((r) => r.studentId === user.id && r.courseId === courseId && r.status !== 'rejected')) {
      throw ApiError.conflict('You have already reviewed this course', 'DUPLICATE_REVIEW');
    }
    const review = repos.reviews.build({ studentId: user.id, studentName: user.fullName, courseId, rating, comment, status: 'pending' });
    rows.push(review);
    return structuredClone(review);
  });
  await notifications.notifyAdmins({ title: 'Review awaiting approval', message: `${user.fullName} reviewed ${course.title}.`, type: 'info', link: '/admin/reviews' });
  return record;
}

async function listPublic(query = {}) {
  const courseId = cleanQueryString(query.courseId);
  const rows = await repos.reviews.find((r) => r.status === 'approved' && (!courseId || r.courseId === courseId));
  return rows
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((r) => ({ id: r.id, courseId: r.courseId, rating: r.rating, comment: r.comment, studentName: displayName(r.studentName), createdAt: r.createdAt }));
}

async function listMine(user) {
  const [rows, courses] = await Promise.all([repos.reviews.find((r) => r.studentId === user.id), repos.courses.all()]);
  return rows.map((r) => ({ ...r, courseTitle: (courses.find((c) => c.id === r.courseId) || {}).title || null }));
}

async function adminList(query = {}) {
  const status = cleanQueryString(query.status);
  const [rows, courses] = await Promise.all([repos.reviews.all(), repos.courses.all()]);
  return rows
    .filter((r) => !status || r.status === status)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((r) => ({ ...r, courseTitle: (courses.find((c) => c.id === r.courseId) || {}).title || null }));
}

async function moderate(id, { status, publishAsTestimonial }, actor) {
  const review = await repos.reviews.findById(id);
  if (!review) throw ApiError.notFound('Review not found');
  const updated = await repos.reviews.update(id, { status, moderatedBy: actor.fullName, moderatedAt: new Date().toISOString() });
  if (status === 'approved' && publishAsTestimonial && !review.testimonialId) {
    const course = await repos.courses.findById(review.courseId);
    const testimonial = await repos.testimonials.create({
      name: displayName(review.studentName), course: course ? course.title : 'Course', quote: review.comment,
      rating: review.rating, role: 'Student', isPublished: true, isSample: false, source: 'review', reviewId: review.id,
    });
    await repos.reviews.update(id, { testimonialId: testimonial.id });
  }
  await notifications.notify(review.studentId, {
    title: `Review ${status}`,
    message: status === 'approved' ? 'Thanks! Your course review is now published.' : status === 'rejected' ? 'Your review was not published. It may not meet our guidelines.' : 'Your review is under moderation.',
    type: status === 'rejected' ? 'warning' : 'success',
  });
  await activity.log(actor, `review_${status}`, 'review', id, `Review ${status}`);
  return updated;
}

async function remove(id, actor) {
  const removed = await repos.reviews.remove(id);
  if (!removed) throw ApiError.notFound('Review not found');
  await activity.log(actor, 'deleted', 'review', id, 'Review deleted');
  return { deleted: true };
}

module.exports = { create, listPublic, listMine, adminList, moderate, remove };
