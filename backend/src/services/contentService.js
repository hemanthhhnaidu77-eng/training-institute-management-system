'use strict';
/**
 * Generic CRUD service for simple admin-managed content collections
 * (services, testimonials, FAQs, events).
 */
const ApiError = require('../utils/ApiError');
const { matchesSearch, cleanQueryString } = require('../utils/query');
const activity = require('./activityService');

function createContentService({ repo, entity, publicFilter, sort, searchFields = ['title'] }) {
  return {
    async list(query = {}, { isAdmin = false } = {}) {
      let rows = await repo.all();
      if (!(isAdmin && query.all === 'true')) rows = rows.filter(publicFilter);
      rows = rows.filter((r) => matchesSearch(r, cleanQueryString(query.q), searchFields));
      if (query.category) rows = rows.filter((r) => r.category === cleanQueryString(query.category));
      return rows.sort(sort);
    },
    async get(id, { isAdmin = false } = {}) {
      const row = await repo.findById(id);
      if (!row || (!isAdmin && !publicFilter(row))) throw ApiError.notFound(`${entity} not found`);
      return row;
    },
    async create(data, actor) {
      const row = await repo.create(data);
      await activity.log(actor, 'created', entity.toLowerCase(), row.id, `${entity} "${row.title || row.question || row.name}" created`);
      return row;
    },
    async update(id, data, actor) {
      const row = await repo.update(id, data);
      if (!row) throw ApiError.notFound(`${entity} not found`);
      await activity.log(actor, 'updated', entity.toLowerCase(), id, `${entity} "${row.title || row.question || row.name}" updated`);
      return row;
    },
    async remove(id, actor) {
      const row = await repo.remove(id);
      if (!row) throw ApiError.notFound(`${entity} not found`);
      await activity.log(actor, 'deleted', entity.toLowerCase(), id, `${entity} "${row.title || row.question || row.name}" deleted`);
      return { deleted: true };
    },
  };
}

module.exports = { createContentService };
