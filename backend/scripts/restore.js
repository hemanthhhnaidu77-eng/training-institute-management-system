'use strict';
/**
 * Restores data files from a backup. Stop the API server first.
 *   npm run restore              -> lists available backups
 *   npm run restore -- <name>    -> restores that backup (a safety backup is taken first)
 */
const { store } = require('../src/storage');

async function main() {
  const name = process.argv[2];
  const backups = await store.listBackups();
  if (!name) {
    console.log(backups.length ? `Available backups (newest first):\n  ${backups.join('\n  ')}` : 'No backups found.');
    console.log('\nUsage: npm run restore -- <backup-name>');
    return;
  }
  if (!backups.includes(name)) throw new Error(`Backup "${name}" not found`);
  const safety = await store.backup('pre-restore');
  const restored = await store.restore(name);
  console.log(`Safety backup: ${safety}`);
  console.log(`Restored ${restored.length} collection(s) from ${name}: ${restored.join(', ')}`);
}

main().catch((err) => {
  console.error('Restore failed:', err.message);
  process.exit(1);
});
