'use strict';
const { repos } = require('../storage');
const ApiError = require('../utils/ApiError');

async function notify(userId, { title, message, type = 'info', link = null }) {
  if (!userId) return null;
  try {
    return await repos.notifications.create({ userId, title, message, type, link, isRead: false });
  } catch (err) {
    console.error('[notifications] failed:', err.message);
    return null;
  }
}

async function notifyMany(userIds, payload) {
  for (const id of [...new Set(userIds.filter(Boolean))]) await notify(id, payload);
}

async function notifyAdmins(payload) {
  const admins = await repos.users.find((u) => u.role === 'admin' && u.isActive);
  await notifyMany(admins.map((a) => a.id), payload);
}

async function listMine(user, { unreadOnly = false } = {}) {
  let rows = await repos.notifications.find((n) => n.userId === user.id);
  if (unreadOnly) rows = rows.filter((n) => !n.isRead);
  rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { items: rows.slice(0, 100), unread: rows.filter((n) => !n.isRead).length };
}

async function markRead(user, id) {
  const result = await repos.notifications.mutate((rows) => {
    const row = rows.find((n) => n.id === id && n.userId === user.id);
    if (!row) return null;
    row.isRead = true;
    row.updatedAt = new Date().toISOString();
    return structuredClone(row);
  });
  if (!result) throw ApiError.notFound('Notification not found');
  return result;
}

async function markAllRead(user) {
  return repos.notifications.mutate((rows) => {
    let count = 0;
    for (const row of rows) {
      if (row.userId === user.id && !row.isRead) {
        row.isRead = true;
        row.updatedAt = new Date().toISOString();
        count++;
      }
    }
    return { updated: count };
  });
}

module.exports = { notify, notifyMany, notifyAdmins, listMine, markRead, markAllRead };
