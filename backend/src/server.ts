import { createServer } from 'node:http';
import app from './app.js';
import { env } from './config/env.js';
import { ensureAdmin } from './lib/bootstrap.js';
import { attachRealtime } from './lib/socket.js';

async function main(): Promise<void> {
  await ensureAdmin();
  const server = createServer(app);
  attachRealtime(server);
  server.listen(env.PORT, () => {
    console.log(`Backend listening on :${env.PORT}`);
  });
}

main().catch((err) => {
  console.error('Backend startup failed', err);
  process.exit(1);
});
