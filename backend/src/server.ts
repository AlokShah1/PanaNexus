import { createServer } from 'node:http';
import app from './app.js';
import { env } from './config/env.js';
import { ensureAdmin } from './lib/bootstrap.js';
import { attachRealtime } from './lib/socket.js';
import { assertSchemaReady } from './lib/readiness.js';
import { startDispatchLoop, stopDispatchLoop } from './lib/dispatch.js';
import { stopAllSimulations } from './lib/demoSimulation.js';

async function main(): Promise<void> {
  await assertSchemaReady();
  await ensureAdmin();
  const server = createServer(app);
  attachRealtime(server);
  if (env.NODE_ENV !== 'test') startDispatchLoop();

  const shutdown = (signal: NodeJS.Signals) => {
    console.log(`Received ${signal}, shutting down gracefully…`);
    stopDispatchLoop();
    stopAllSimulations();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 10_000).unref();
  };
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => {
    stopDispatchLoop();
    stopAllSimulations();
    process.exit(0);
  });

  server.listen(env.PORT, () => {
    console.log(`Backend listening on :${env.PORT}`);
  });
}

main().catch((err) => {
  console.error('Backend startup failed', err);
  process.exit(1);
});
