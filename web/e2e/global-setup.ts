// Starts the built-site server (e2e/server.ts) once for the run and stops it at the end.
import { startServer } from "./server";
import { PORT } from "./config";

export default async function globalSetup() {
  const server = await startServer(PORT);
  return async () => { await new Promise((ok) => server.close(ok)); };
}
