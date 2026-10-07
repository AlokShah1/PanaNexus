import { resetDemoData } from '../src/lib/demoData.js';

async function main() {
  const result = await resetDemoData();
  console.log('Demo dataset reset (synthetic only).');
  console.log('Created:', result.created);
  console.log('Demo password:', result.password);
  console.log('Demo logins:', result.credentials);
}

main()
  .catch((err) => {
    console.error('Reset failed', err);
    process.exit(1);
  })
  .finally(() => process.exit(0));