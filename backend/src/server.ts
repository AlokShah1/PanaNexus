import { createServer } from 'node:http';
import app from './app.js';
import { env } from './config/env.js';
import { ensureAdmin } from './lib/bootstrap.js';
import { attachRealtime } from './lib/socket.js';
import { assertSchemaReady } from './lib/readiness.js';
import { startDispatchLoop } from './lib/dispatch.js';

async function main(): Promise<void> {
  await assertSchemaReady();
  await ensureAdmin();
  const server = createServer(app);
  attachRealtime(server);
  if (env.NODE_ENV !== 'test') startDispatchLoop();
  server.listen(env.PORT, () => {
    console.log(`Backend listening on :${env.PORT}`);
  });
}

main().catch((err) => {
  console.error('Backend startup failed', err);
  process.exit(1);
});
