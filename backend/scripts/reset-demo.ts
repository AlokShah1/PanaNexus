import { resetDemoData } from '../src/lib/demoData.js';
import { demoMode } from '../src/config/env.js';

async function main() {
  if (!demoMode) {
    console.error(
      'Refusing to reset demo data: DEMO_MODE is not enabled. ' +
        'Set DEMO_MODE=true (dev/demo environments only) and retry.',
    );
    process.exit(1);
  }
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