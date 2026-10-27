'use strict';
const { dataDir, cleanup } = require('./helpers/env');
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs/promises');
const path = require('path');
const { JsonStore } = require('../src/storage/jsonStore');
const Repository = require('../src/storage/repository');

after(cleanup);

test('init creates every collection file with a valid default structure', async () => {
  const store = new JsonStore(path.join(dataDir, 'init'));
  const report = await store.init({ logger: { warn() {} } });
  assert.ok(report.created.includes('users'));
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(store.dataDir, 'users.json'), 'utf8')), []);
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(store.dataDir, 'settings.json'), 'utf8')), {});
  const again = await store.init({ logger: { warn() {} } });
  assert.equal(again.created.length, 0, 'second init must not recreate files');
});

test('repository create/update/remove maintain ids and timestamps', async () => {
  const store = new JsonStore(path.join(dataDir, 'repo'));
  await store.init();
  const repo = new Repository(store, 'courses', 'crs');
  const created = await repo.create({ title: 'Java' });
  assert.match(created.id, /^crs_[0-9a-f-]{36}$/);
  assert.ok(created.createdAt && created.updatedAt);
  await new Promise((r) => setTimeout(r, 5));
  const updated = await repo.update(created.id, { title: 'Java 21', id: 'hacked', createdAt: 'x' });
  assert.equal(updated.id, created.id, 'id is immutable');
  assert.equal(updated.createdAt, created.createdAt, 'createdAt is immutable');
  assert.notEqual(updated.updatedAt, created.updatedAt);
  await repo.create({ title: 'Python' });
  assert.equal((await repo.all()).length, 2);
  await repo.remove(created.id);
  const rest = await repo.all();
  assert.equal(rest.length, 1);
  assert.equal(rest[0].title, 'Python', 'unrelated records survive');
});

test('data persists across store instances (JSON file persistence)', async () => {
  const dir = path.join(dataDir, 'persist');
  const a = new JsonStore(dir);
  await a.init();
  await new Repository(a, 'faqs', 'faq').create({ question: 'Q?' });
  const b = new JsonStore(dir);
  const rows = await b.read('faqs');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].question, 'Q?');
});

test('concurrent mutations are serialised (no lost updates)', async () => {
  const store = new JsonStore(path.join(dataDir, 'concurrency'));
  await store.init();
  await store.replace('settings', { counter: 0 });
  await Promise.all(Array.from({ length: 50 }, () => store.mutate('settings', async (s) => {
    const current = s.counter;
    await new Promise((r) => setImmediate(r));
    s.counter = current + 1;
  })));
  assert.equal((await store.read('settings')).counter, 50);
});

test('a throwing mutation writes nothing', async () => {
  const store = new JsonStore(path.join(dataDir, 'rollback'));
  await store.init();
  await store.replace('faqs', [{ id: 'a' }]);
  await assert.rejects(store.mutate('faqs', (rows) => {
    rows.push({ id: 'b' });
    throw new Error('validation failed');
  }));
  assert.deepEqual(await store.read('faqs'), [{ id: 'a' }]);
});

test('unknown collection names (path traversal) are rejected', async () => {
  const store = new JsonStore(path.join(dataDir, 'traversal'));
  await assert.rejects(store.read('../../etc/passwd'), /Unknown collection/);
  await assert.rejects(store.read('constructor'), /Unknown collection/);
  await assert.rejects(store.restore('../../evil'), /Invalid backup name/);
});

test('malformed JSON is quarantined and restored from the latest backup', async () => {
  const store = new JsonStore(path.join(dataDir, 'corrupt'));
  await store.init();
  await store.replace('courses', [{ id: 'crs_1', title: 'Saved' }]);
  await store.backup('test');
  await fs.writeFile(path.join(store.dataDir, 'courses.json'), '{ not json', 'utf8');
  await assert.rejects(store.read('courses'), /malformed/);
  const report = await store.init({ logger: { warn() {} } });
  assert.equal(report.recovered[0].source, 'backup');
  assert.deepEqual(await store.read('courses'), [{ id: 'crs_1', title: 'Saved' }]);
  const files = await fs.readdir(store.dataDir);
  assert.ok(files.some((f) => f.startsWith('courses.json.corrupt-')), 'original corrupt file is kept');
});

test('wrong top-level type is treated as malformed and reset when no backup exists', async () => {
  const store = new JsonStore(path.join(dataDir, 'wrongtype'));
  await store.init();
  await fs.writeFile(path.join(store.dataDir, 'users.json'), '{"oops":true}', 'utf8');
  const report = await store.init({ logger: { warn() {} } });
  assert.equal(report.recovered[0].source, 'default');
  assert.deepEqual(await store.read('users'), []);
});

test('backup and restore round-trip', async () => {
  const store = new JsonStore(path.join(dataDir, 'backup'));
  await store.init();
  await store.replace('faqs', [{ id: 'one' }]);
  const dir = await store.backup('demo');
  await store.replace('faqs', []);
  const name = path.basename(dir);
  assert.ok((await store.listBackups()).includes(name));
  await store.restore(name);
  assert.deepEqual(await store.read('faqs'), [{ id: 'one' }]);
});

test('UTF-8 BOM written by Windows editors is tolerated', async () => {
  const store = new JsonStore(path.join(dataDir, 'bom'));
  await store.init();
  await fs.writeFile(path.join(store.dataDir, 'faqs.json'), '\uFEFF[{"id":"x"}]', 'utf8');
  assert.deepEqual(await store.read('faqs'), [{ id: 'x' }]);
});
