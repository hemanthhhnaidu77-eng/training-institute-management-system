'use strict';
/** Copies every JSON data file into data/backups/<timestamp>/ */
const { store } = require('../src/storage');

store
  .backup(process.argv[2] || 'manual')
  .then((dir) => console.log(`Backup written to ${dir}`))
  .catch((err) => {
    console.error('Backup failed:', err.message);
    process.exit(1);
  });
