import { env } from "cloudflare:workers";
import { createConnection } from "mysql2/promise";

type HyperdriveBinding = {
  connectionString: string;
};

export async function GET() {
  const hyperdrive = (env as unknown as { HYPERDRIVE?: HyperdriveBinding })
    .HYPERDRIVE;

  if (!hyperdrive?.connectionString) {
    return Response.json(
      { ok: false, error: "Hyperdrive binding is not configured" },
      { status: 503 },
    );
  }

  let connection: Awaited<ReturnType<typeof createConnection>> | undefined;
  try {
    connection = await createConnection(hyperdrive.connectionString);
    const [rows] = await connection.query(
      "SELECT 1 AS connected, DATABASE() AS database_name, VERSION() AS mysql_version",
    );
    return Response.json({ ok: true, result: rows });
  } catch (error) {
    console.error("Pocketpals database health check failed", error);
    return Response.json(
      { ok: false, error: "Database connection failed" },
      { status: 502 },
    );
  } finally {
    await connection?.end().catch(() => undefined);
  }
}
