'use strict';
const { repos } = require('../storage');

const MAX_ENTRIES = 500;

/** Records an audit/activity entry (never include secrets in summary). */
async function log(actor, action, entity, entityId, summary) {
  try {
    await repos.activity.mutate((rows) => {
      rows.push(
        repos.activity.build({
          actorId: actor ? actor.id : null,
          actorName: actor ? actor.fullName : 'Visitor',
          actorRole: actor ? actor.role : 'public',
          action,
          entity,
          entityId: entityId || null,
          summary: String(summary || '').slice(0, 300),
        })
      );
      if (rows.length > MAX_ENTRIES) rows.splice(0, rows.length - MAX_ENTRIES);
    });
  } catch (err) {
    console.error('[activity] failed to record entry:', err.message);
  }
}

async function recent(limit = 15) {
  const rows = await repos.activity.all();
  return rows.slice(-limit).reverse();
}

module.exports = { log, recent };
