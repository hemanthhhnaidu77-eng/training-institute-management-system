'use strict';
/**
 * File-backed JSON store.
 *
 * - One JSON file per collection, whitelisted below (clients can never pick a file path).
 * - All operations on a collection run through a per-collection promise queue, so
 *   read-modify-write cycles inside this process are serialised and cannot interleave.
 * - Writes are atomic: data is written to a temp file and then renamed over the target.
 * - Missing files are created with valid defaults; malformed files are quarantined and
 *   restored from the most recent backup (or reset to the default) during init().
 *
 * Limitation: the queue only protects a single Node.js process. Run exactly one API
 * instance against a data directory. See README "Known limitations".
 */
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const COLLECTION_DEFAULTS = Object.freeze({
  users: [],
  courses: [],
  trainers: [],
  services: [],
  batches: [],
  enrollments: [],
  appointments: [],
  inquiries: [],
  testimonials: [],
  faqs: [],
  notifications: [],
  reviews: [],
  events: [],
  newsletter: [],
  activity: [],
  session_records: [],
  revoked_tokens: [],
  password_resets: [],
  outbox: [],
  settings: {},
});

class StoreError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StoreError';
  }
}

const clone = (v) => structuredClone(v);
const BACKUP_NAME_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9-]+Z(?:-[a-z0-9-]+)?$/;

class JsonStore {
  constructor(dataDir) {
    this.dataDir = path.resolve(dataDir);
    this.backupDir = path.join(this.dataDir, 'backups');
    this._queues = new Map();
  }

  static get collections() {
    return Object.keys(COLLECTION_DEFAULTS);
  }

  _file(name) {
    if (typeof name !== 'string' || !Object.prototype.hasOwnProperty.call(COLLECTION_DEFAULTS, name)) {
      throw new StoreError(`Unknown collection "${name}"`);
    }
    return path.join(this.dataDir, `${name}.json`);
  }

  /** Runs task after every previously queued task for this collection has settled. */
  _serial(name, task) {
    try {
      this._file(name);
    } catch (err) {
      return Promise.reject(err);
    }
    const previous = this._queues.get(name) || Promise.resolve();
    const run = previous.then(() => task());
    this._queues.set(name, run.catch(() => undefined));
    return run;
  }

  _parse(name, raw) {
    const data = JSON.parse(String(raw).replace(/^\uFEFF/, ''));
    const expectArray = Array.isArray(COLLECTION_DEFAULTS[name]);
    const valid = expectArray ? Array.isArray(data) : data !== null && typeof data === 'object' && !Array.isArray(data);
    if (!valid) throw new StoreError(`${name}.json has an invalid top-level structure`);
    return data;
  }

  async _readUnlocked(name) {
    try {
      const raw = await fs.readFile(this._file(name), 'utf8');
      return this._parse(name, raw);
    } catch (err) {
      if (err.code === 'ENOENT') return clone(COLLECTION_DEFAULTS[name]);
      if (err instanceof SyntaxError || err instanceof StoreError) {
        throw new StoreError(
          `${name}.json is malformed. Restart the server to auto-recover, run "npm run restore", or fix the file manually.`
        );
      }
      throw err;
    }
  }

  async _atomicWrite(file, data) {
    const tmp = `${file}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
    await fs.writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    for (let attempt = 0; ; attempt++) {
      try {
        await fs.rename(tmp, file);
        return;
      } catch (err) {
        // Windows can briefly lock files (antivirus/indexer); retry a few times.
        if (['EPERM', 'EBUSY', 'EACCES'].includes(err.code) && attempt < 5) {
          await new Promise((r) => setTimeout(r, 50 * (attempt + 1)));
          continue;
        }
        await fs.rm(tmp, { force: true });
        throw err;
      }
    }
  }

  /** Creates missing files and recovers malformed ones. Safe to call repeatedly. */
  async init({ logger = console } = {}) {
    await fs.mkdir(this.dataDir, { recursive: true });
    const report = { created: [], recovered: [] };
    for (const name of JsonStore.collections) {
      await this._serial(name, async () => {
        const file = this._file(name);
        let raw;
        try {
          raw = await fs.readFile(file, 'utf8');
        } catch (err) {
          if (err.code !== 'ENOENT') throw err;
          await this._atomicWrite(file, clone(COLLECTION_DEFAULTS[name]));
          report.created.push(name);
          return;
        }
        try {
          this._parse(name, raw);
        } catch {
          const quarantine = `${file}.corrupt-${Date.now()}`;
          await fs.copyFile(file, quarantine);
          const restored = await this._restoreCollectionFromLatestBackup(name);
          if (!restored) await this._atomicWrite(file, clone(COLLECTION_DEFAULTS[name]));
          report.recovered.push({ name, quarantine: path.basename(quarantine), source: restored ? 'backup' : 'default' });
          logger.warn(
            `[store] ${name}.json was malformed. Original kept as ${path.basename(quarantine)}; restored from ${
              restored ? 'the latest backup' : 'an empty default'
            }.`
          );
        }
      });
    }
    return report;
  }

  /** Returns a deep copy of the collection. */
  read(name) {
    return this._serial(name, () => this._readUnlocked(name));
  }

  /**
   * Serialised read-modify-write. `fn` receives the live data and may mutate it in place;
   * when it resolves, the data is written atomically and fn's return value is returned.
   * If fn throws, nothing is written. Never call read()/mutate() on the SAME collection
   * from inside fn (that would wait on itself).
   */
  mutate(name, fn) {
    return this._serial(name, async () => {
      const data = await this._readUnlocked(name);
      const result = await fn(data);
      await this._atomicWrite(this._file(name), data);
      return result;
    });
  }

  /** Replaces a whole collection (used by seed/restore scripts). */
  replace(name, data) {
    return this._serial(name, async () => {
      this._parse(name, JSON.stringify(data));
      await this._atomicWrite(this._file(name), data);
    });
  }

  async backup(label = '') {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeLabel = String(label).toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 30);
    const dir = path.join(this.backupDir, safeLabel ? `${stamp}-${safeLabel}` : stamp);
    await fs.mkdir(dir, { recursive: true });
    for (const name of JsonStore.collections) {
      await this._serial(name, async () => {
        try {
          await fs.copyFile(this._file(name), path.join(dir, `${name}.json`));
        } catch (err) {
          if (err.code !== 'ENOENT') throw err;
        }
      });
    }
    return dir;
  }

  async listBackups() {
    try {
      const entries = await fs.readdir(this.backupDir, { withFileTypes: true });
      return entries.filter((e) => e.isDirectory() && BACKUP_NAME_RE.test(e.name)).map((e) => e.name).sort().reverse();
    } catch (err) {
      if (err.code === 'ENOENT') return [];
      throw err;
    }
  }

  /** Restores every collection from a named backup folder (validated, no path traversal). */
  async restore(backupName) {
    if (!BACKUP_NAME_RE.test(String(backupName))) throw new StoreError('Invalid backup name');
    const dir = path.join(this.backupDir, backupName);
    const restored = [];
    for (const name of JsonStore.collections) {
      let raw;
      try {
        raw = await fs.readFile(path.join(dir, `${name}.json`), 'utf8');
      } catch (err) {
        if (err.code === 'ENOENT') continue;
        throw err;
      }
      const data = this._parse(name, raw);
      await this._serial(name, () => this._atomicWrite(this._file(name), data));
      restored.push(name);
    }
    return restored;
  }

  async _restoreCollectionFromLatestBackup(name) {
    for (const dir of await this.listBackups()) {
      try {
        const raw = await fs.readFile(path.join(this.backupDir, dir, `${name}.json`), 'utf8');
        const data = this._parse(name, raw);
        await this._atomicWrite(this._file(name), data);
        return true;
      } catch {
        /* try the next older backup */
      }
    }
    return false;
  }
}

module.exports = { JsonStore, StoreError, COLLECTION_DEFAULTS };
