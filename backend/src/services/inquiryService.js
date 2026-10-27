'use strict';
const { repos } = require('../storage');
const ApiError = require('../utils/ApiError');
const { referenceCode } = require('../utils/ids');
const { cleanQueryString, matchesSearch, pageParams, paginate } = require('../utils/query');
const notifications = require('./notificationService');
const activity = require('./activityService');

async function create(input, user) {
  const record = await repos.inquiries.mutate((rows) => {
    let ticketNo;
    do ticketNo = referenceCode('INQ', new Date(), 5);
    while (rows.some((r) => r.ticketNo === ticketNo));
    const inquiry = repos.inquiries.build({
      ticketNo, ...input, mobile: input.mobile || null, userId: user ? user.id : null, status: 'new', notes: [],
      history: [{ status: 'new', at: new Date().toISOString(), by: input.name }],
    });
    rows.push(inquiry);
    return structuredClone(inquiry);
  });
  await notifications.notifyAdmins({ title: 'New inquiry', message: `${record.name}: ${record.subject} (${record.ticketNo})`, type: 'info', link: '/admin/inquiries' });
  await activity.log(user || null, 'submitted', 'inquiry', record.id, `Inquiry ${record.ticketNo} from ${record.name}`);
  return { id: record.id, ticketNo: record.ticketNo, status: record.status, createdAt: record.createdAt };
}

async function adminList(query = {}) {
  let rows = await repos.inquiries.all();
  const status = cleanQueryString(query.status);
  const category = cleanQueryString(query.category);
  if (status) rows = rows.filter((r) => r.status === status);
  if (category) rows = rows.filter((r) => r.category === category);
  if (query.from) rows = rows.filter((r) => r.createdAt.slice(0, 10) >= cleanQueryString(query.from));
  if (query.to) rows = rows.filter((r) => r.createdAt.slice(0, 10) <= cleanQueryString(query.to));
  rows = rows.filter((r) => matchesSearch(r, cleanQueryString(query.q), ['ticketNo', 'name', 'email', 'subject', 'message']));
  rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return paginate(rows, pageParams(query));
}

async function get(id) {
  const row = await repos.inquiries.findById(id);
  if (!row) throw ApiError.notFound('Inquiry not found');
  return row;
}

async function updateStatus(id, { status, note }, actor) {
  const updated = await repos.inquiries.mutate((rows) => {
    const row = rows.find((r) => r.id === id);
    if (!row) throw ApiError.notFound('Inquiry not found');
    const now = new Date().toISOString();
    row.status = status;
    row.history = [...(row.history || []), { status, at: now, by: actor.fullName }];
    if (note) row.notes = [...(row.notes || []), { text: note, by: actor.fullName, at: now }];
    if (status === 'resolved') row.resolvedAt = now;
    row.updatedAt = now;
    return structuredClone(row);
  });
  await activity.log(actor, 'inquiry_status', 'inquiry', id, `Inquiry ${updated.ticketNo} marked ${status}`);
  return updated;
}

async function addNote(id, { note }, actor) {
  return repos.inquiries.mutate((rows) => {
    const row = rows.find((r) => r.id === id);
    if (!row) throw ApiError.notFound('Inquiry not found');
    const now = new Date().toISOString();
    row.notes = [...(row.notes || []), { text: note, by: actor.fullName, at: now }];
    if (row.status === 'new') row.status = 'in_progress';
    row.updatedAt = now;
    return structuredClone(row);
  });
}

async function listMine(user) {
  const rows = await repos.inquiries.find((r) => r.userId === user.id || r.email === user.email);
  return rows.map(({ notes, history, ...rest }) => rest).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

module.exports = { create, adminList, get, updateStatus, addNote, listMine };
