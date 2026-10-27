'use strict';
const { repos } = require('../storage');
const ApiError = require('../utils/ApiError');
const { createContentService } = require('./contentService');
const { nowInZone } = require('../utils/dates');

const byOrder = (a, b) => (a.order ?? 100) - (b.order ?? 100) || String(a.title || a.question).localeCompare(String(b.title || b.question));

const services = createContentService({
  repo: repos.services, entity: 'Service', publicFilter: (s) => s.isEnabled !== false, sort: byOrder,
  searchFields: ['title', 'description', 'deliveryMode'],
});

/** Persists a new display order: ids listed first in the given order. */
services.reorder = async (ids, actor) => {
  if (!Array.isArray(ids) || !ids.every((id) => typeof id === 'string')) throw ApiError.badRequest('ids must be an array of service ids');
  await repos.services.mutate((rows) => {
    ids.forEach((id, index) => {
      const row = rows.find((r) => r.id === id);
      if (row) {
        row.order = (index + 1) * 10;
        row.updatedAt = new Date().toISOString();
      }
    });
  });
  return services.list({ all: 'true' }, { isAdmin: true, actor });
};

const testimonials = createContentService({
  repo: repos.testimonials, entity: 'Testimonial', publicFilter: (t) => t.isPublished !== false,
  sort: (a, b) => b.createdAt.localeCompare(a.createdAt), searchFields: ['name', 'course', 'quote'],
});

const faqs = createContentService({
  repo: repos.faqs, entity: 'FAQ', publicFilter: (f) => f.isPublished !== false,
  sort: (a, b) => a.category.localeCompare(b.category) || byOrder(a, b), searchFields: ['question', 'answer', 'category'],
});

const events = createContentService({
  repo: repos.events, entity: 'Event',
  publicFilter: (e) => e.isPublished !== false && e.date >= nowInZone().date,
  sort: (a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`), searchFields: ['title', 'description', 'type'],
});

module.exports = { services, testimonials, faqs, events };
