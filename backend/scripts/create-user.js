'use strict';
/**
 * Trusted provisioning of admin / trainer accounts from the server console.
 *   npm run create-user -- --role admin --name "Jane Admin" --email jane@example.com --mobile 9876543210
 *   npm run create-user -- --role trainer --trainer-id trn_xxx --name "..." --email ... --mobile ...
 * The password is read from the CREATE_USER_PASSWORD env var or prompted interactively (hidden).
 */
const readline = require('readline');
const { store } = require('../src/storage');
const { validate } = require('../src/utils/validate');
const S = require('../src/validation/schemas');
const authService = require('../src/services/authService');

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl.stdoutMuted = true;
    rl._writeToOutput = function write(s) {
      if (rl.stdoutMuted && !s.startsWith(question)) rl.output.write('*');
      else rl.output.write(s);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

async function main() {
  await store.init();
  const password = process.env.CREATE_USER_PASSWORD || (await askHidden('Password (min 8 chars, letters + numbers): '));
  const input = validate(S.staffUser, { role: arg('role'), fullName: arg('name'), email: arg('email'), mobile: arg('mobile'), password, trainerId: arg('trainer-id') });
  const user = await authService.createStaffUser(input);
  console.log(`Created ${user.role} account for ${user.email} (id ${user.id}).`);
}

main().catch((err) => {
  console.error('Could not create user:', err.details ? err.details.map((d) => `${d.field}: ${d.message}`).join('; ') : err.message);
  process.exit(1);
});
