'use strict';
const { store } = require('../storage');

const DEFAULT_SETTINGS = Object.freeze({
  instituteName: 'Navigate Tech Academy',
  tagline: 'Learn Today. Build Tomorrow. Achieve Your Career Goals.',
  email: 'hello@navigatetech.example',
  phone: '+91 00000 00000',
  whatsapp: '',
  address: 'Floor 3, Sample Business Park, Madhapur, Hyderabad, Telangana 500081 (placeholder address)',
  workingHours: 'Mon - Sat: 9:00 AM - 7:00 PM',
  mapEmbedUrl: null,
  timezone: 'Asia/Kolkata',
  socials: {
    facebook: 'https://facebook.com/',
    instagram: 'https://instagram.com/',
    linkedin: 'https://linkedin.com/',
    youtube: 'https://youtube.com/',
    x: 'https://x.com/',
  },
  branding: { logoText: 'NTA', primaryColor: '#0B2545', accentColor: '#F2A541' },
  appointment: {
    slots: ['10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00'],
    workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    slotMinutes: 45,
    counselorsPerSlot: 2,
    bookingWindowDays: 60,
  },
});

function merge(base, patch) {
  const out = structuredClone(base);
  for (const [key, value] of Object.entries(patch || {})) {
    if (value && typeof value === 'object' && !Array.isArray(value) && out[key] && typeof out[key] === 'object' && !Array.isArray(out[key])) {
      out[key] = merge(out[key], value);
    } else if (value !== undefined) {
      out[key] = value;
    }
  }
  return out;
}

async function get() {
  const stored = await store.read('settings');
  return merge(DEFAULT_SETTINGS, stored);
}

async function update(patch) {
  return store.mutate('settings', (data) => {
    const next = merge(merge(DEFAULT_SETTINGS, data), patch);
    next.updatedAt = new Date().toISOString();
    for (const key of Object.keys(data)) delete data[key];
    Object.assign(data, next);
    return structuredClone(next);
  });
}

module.exports = { DEFAULT_SETTINGS, get, update };
