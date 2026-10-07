import { db } from '../../prisma/db.js';

export async function assertSchemaReady(): Promise<void> {
  try {
    await db.orm.public.User.where({}).first();
  } catch (err) {
    const cause = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Database schema is not initialized — refusing to start (${cause}). ` +
        'Run the database migration before starting the server (npm run db:migrate, ' +
        'or the render.yaml preDeployCommand for deployed services).',
      { cause: err },
    );
  }
}