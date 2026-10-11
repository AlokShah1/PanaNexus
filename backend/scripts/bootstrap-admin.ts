import { ensureAdmin } from '../src/lib/bootstrap.js';

/**
 * Idempotently creates (or repairs) the configured platform admin. The server
 * does this on boot, but CI and freshly-migrated test databases need it before
 * the integration suite can exercise admin-gated routes.
 */
async function main() {
  await ensureAdmin();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
