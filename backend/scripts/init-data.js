'use strict';
/** Creates any missing JSON data files with valid empty structures (never overwrites data). */
const { store } = require('../src/storage');

store
  .init()
  .then((report) => {
    console.log(`Data directory: ${store.dataDir}`);
    console.log(report.created.length ? `Created: ${report.created.join(', ')}` : 'All data files already exist.');
    if (report.recovered.length) console.log('Recovered:', report.recovered);
  })
  .catch((err) => {
    console.error('Failed to initialise data files:', err.message);
    process.exit(1);
  });
