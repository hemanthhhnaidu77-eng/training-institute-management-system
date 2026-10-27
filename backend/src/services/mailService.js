'use strict';
/**
 * No real email provider is configured in this project.
 * In development, messages are written to data/outbox.json (a private, server-side
 * "dev mailbox") so the password-reset flow can be exercised end to end.
 * To go live, replace deliver() with a real transport (SMTP, SES, SendGrid...).
 */
const { config } = require('../config');
const { repos } = require('../storage');

async function deliver({ to, subject, text }) {
  if (!config.devMailOutbox) {
    console.warn('[mail] No email transport configured; message to a user was NOT sent (subject: %s).', subject);
    return { delivered: false };
  }
  await repos.outbox.mutate((rows) => {
    rows.push(repos.outbox.build({ to, subject, text, transport: 'dev-outbox' }));
    if (rows.length > 200) rows.splice(0, rows.length - 200);
  });
  console.log('[mail] Dev outbox: message "%s" stored in data/outbox.json', subject);
  return { delivered: true, transport: 'dev-outbox' };
}

module.exports = { deliver };
