'use strict';
/**
 * Generic repository on top of JsonStore. Services depend on this interface only,
 * so the storage layer can later be swapped for a real database (see README).
 */
const { newId } = require('../utils/ids');

const clone = (v) => structuredClone(v);

class Repository {
  constructor(store, collection, prefix) {
    this.store = store;
    this.collection = collection;
    this.prefix = prefix;
  }

  all() {
    return this.store.read(this.collection);
  }

  async find(predicate) {
    return (await this.all()).filter(predicate);
  }

  async findOne(predicate) {
    return (await this.all()).find(predicate) || null;
  }

  async findById(id) {
    if (!id) return null;
    return this.findOne((r) => r.id === id);
  }

  /** Builds a new record with id + timestamps (does not persist). */
  build(data) {
    const now = new Date().toISOString();
    return { id: newId(this.prefix), ...data, createdAt: now, updatedAt: now };
  }

  create(data) {
    return this.store.mutate(this.collection, (rows) => {
      const record = this.build(data);
      rows.push(record);
      return clone(record);
    });
  }

  /** Shallow-merges patch into the record; id and createdAt are immutable. */
  update(id, patch) {
    return this.store.mutate(this.collection, (rows) => {
      const index = rows.findIndex((r) => r.id === id);
      if (index === -1) return null;
      const { id: _ignoredId, createdAt: _ignoredCreated, ...rest } = patch;
      rows[index] = { ...rows[index], ...rest, updatedAt: new Date().toISOString() };
      return clone(rows[index]);
    });
  }

  remove(id) {
    return this.store.mutate(this.collection, (rows) => {
      const index = rows.findIndex((r) => r.id === id);
      if (index === -1) return null;
      const [removed] = rows.splice(index, 1);
      return removed;
    });
  }

  /** Custom critical section over the whole collection. */
  mutate(fn) {
    return this.store.mutate(this.collection, fn);
  }
}

module.exports = Repository;
