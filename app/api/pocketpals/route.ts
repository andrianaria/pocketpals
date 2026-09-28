import { auth, currentUser } from "@clerk/nextjs/server";
import { env } from "cloudflare:workers";
import { createConnection, type Connection } from "mysql2/promise";

type HyperdriveBinding = { connectionString: string };
type DbEnv = { HYPERDRIVE?: HyperdriveBinding };

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS users (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    clerk_user_id VARCHAR(191) NOT NULL,
    email VARCHAR(255) NULL,
    display_name VARCHAR(191) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id), UNIQUE KEY users_clerk_user_id_unique (clerk_user_id)
  ) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS statement_uploads (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    bank_key VARCHAR(80) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(20) NOT NULL,
    file_size_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'processed',
    parsed_rows INT UNSIGNED NOT NULL DEFAULT 0,
    warning_count INT UNSIGNED NOT NULL DEFAULT 0,
    statement_period VARCHAR(80) NULL,
    space_key VARCHAR(20) NOT NULL DEFAULT 'personal',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id), KEY uploads_user_created (user_id, created_at),
    CONSTRAINT uploads_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS wallets (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    statement_upload_id BIGINT UNSIGNED NULL,
    bank_key VARCHAR(80) NOT NULL,
    account_name VARCHAR(191) NOT NULL,
    account_number VARCHAR(80) NULL,
    currency CHAR(3) NOT NULL DEFAULT 'IDR',
    ending_balance DECIMAL(19,2) NOT NULL DEFAULT 0,
    space_key VARCHAR(20) NOT NULL DEFAULT 'personal',
    statement_date DATE NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id), KEY wallets_user_account (user_id, bank_key, account_number),
    CONSTRAINT wallets_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT wallets_upload_fk FOREIGN KEY (statement_upload_id) REFERENCES statement_uploads(id) ON DELETE SET NULL
  ) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS transactions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    statement_upload_id BIGINT UNSIGNED NULL,
    wallet_id BIGINT UNSIGNED NULL,
    external_id VARCHAR(191) NULL,
    bank_key VARCHAR(80) NULL,
    transaction_date DATE NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NULL,
    remarks TEXT NULL,
    meta VARCHAR(255) NULL,
    amount DECIMAL(19,2) NOT NULL,
    direction VARCHAR(10) NOT NULL DEFAULT 'debit',
    category VARCHAR(80) NOT NULL DEFAULT 'Lainnya',
    icon VARCHAR(16) NULL,
    color VARCHAR(24) NULL,
    auto_tagged TINYINT(1) NOT NULL DEFAULT 0,
    source_file VARCHAR(255) NULL,
    space_key VARCHAR(20) NOT NULL DEFAULT 'personal',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id), KEY transactions_user_date (user_id, transaction_date),
    KEY transactions_user_category (user_id, category), KEY transactions_upload (statement_upload_id),
    CONSTRAINT transactions_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT transactions_upload_fk FOREIGN KEY (statement_upload_id) REFERENCES statement_uploads(id) ON DELETE SET NULL,
    CONSTRAINT transactions_wallet_fk FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE SET NULL
  ) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS auto_tag_rules (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    rule_name VARCHAR(191) NOT NULL,
    match_pattern VARCHAR(255) NOT NULL,
    category VARCHAR(80) NOT NULL,
    icon VARCHAR(16) NULL,
    color VARCHAR(24) NULL,
    is_enabled TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id), KEY auto_rules_user_enabled (user_id, is_enabled),
    CONSTRAINT auto_rules_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB`,
];

function getHyperdrive() {
  return (env as unknown as DbEnv).HYPERDRIVE;
}

async function connect() {
  const hyperdrive = getHyperdrive();
  if (!hyperdrive?.connectionString) throw new Error("Hyperdrive is not configured");
  return createConnection(hyperdrive.connectionString);
}

async function ensureSchema(connection: Connection) {
  for (const statement of schemaStatements) await connection.query(statement);
  for (const table of ["statement_uploads", "wallets", "transactions"]) {
    try { await connection.query(`ALTER TABLE ${table} ADD COLUMN space_key VARCHAR(20) NOT NULL DEFAULT 'personal'`); } catch { /* already present */ }
  }
}

async function requireUser() {
  const { userId } = await auth();
  if (!userId) return null;
  const user = await currentUser();
  return {
    clerkId: userId,
    email: user?.primaryEmailAddress?.emailAddress ?? null,
    displayName: user?.fullName ?? user?.firstName ?? null,
  };
}

async function getDbUser(connection: Connection, identity: NonNullable<Awaited<ReturnType<typeof requireUser>>>) {
  await connection.execute(
    `INSERT INTO users (clerk_user_id, email, display_name) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE email = VALUES(email), display_name = VALUES(display_name)`,
    [identity.clerkId, identity.email, identity.displayName],
  );
  const [rows] = await connection.execute(
    `SELECT id FROM users WHERE clerk_user_id = ? LIMIT 1`,
    [identity.clerkId],
  );
  const id = (rows as Array<{ id: number }>)[0]?.id;
  if (!id) throw new Error("User record could not be created");
  return id;
}

const cleanDate = (value?: string) => {
  if (!value) return null;
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : value.slice(0, 10);
};

function asTransaction(row: Record<string, unknown>) {
  const value = Number(row.amount ?? 0);
  const direction = row.direction === "credit" ? "credit" : "debit";
  return {
    id: String(row.external_id ?? row.id),
    icon: String(row.icon ?? "📄"),
    title: String(row.title ?? "Imported transaction"),
    meta: String(row.meta ?? ""),
    amount: `${direction === "credit" ? "+" : "−"} Rp ${new Intl.NumberFormat("id-ID").format(value)}`,
    amountValue: value,
    direction,
    color: String(row.color ?? "purple"),
    category: String(row.category ?? "Lainnya"),
    note: row.remarks ? String(row.remarks) : undefined,
    date: row.transaction_date ? String(row.transaction_date).slice(0, 10) : undefined,
    bank: row.bank_key ? String(row.bank_key) : undefined,
    source: row.source_file ? String(row.source_file) : undefined,
    accountNumber: row.account_number ? String(row.account_number) : undefined,
    accountName: row.account_name ? String(row.account_name) : undefined,
    currency: row.currency ? String(row.currency) : undefined,
    space: row.space_key === "business" ? "business" : "personal",
  };
}

export async function GET() {
  const identity = await requireUser();
  if (!identity) return Response.json({ error: "Unauthorized" }, { status: 401 });
  let connection: Connection | undefined;
  try {
    connection = await connect();
    await ensureSchema(connection);
    const userId = await getDbUser(connection, identity);
    const [transactions] = await connection.execute(
      `SELECT t.*, w.account_name, w.account_number, w.currency
       FROM transactions t LEFT JOIN wallets w ON w.id = t.wallet_id
       WHERE t.user_id = ? ORDER BY t.transaction_date DESC, t.id DESC`,
      [userId],
    );
    const [uploads] = await connection.execute(
      `SELECT id, file_name AS name, bank_key AS bank, status, file_size_bytes, parsed_rows, warning_count, statement_period, space_key, created_at
       FROM statement_uploads WHERE user_id = ? ORDER BY created_at DESC`,
      [userId],
    );
    const [wallets] = await connection.execute(
      `SELECT bank_key AS bank, account_name AS accountName, account_number AS accountNumber,
       currency, ending_balance AS endingBalance, statement_upload_id AS statementUploadId, space_key AS space
       FROM wallets WHERE user_id = ? ORDER BY created_at DESC`,
      [userId],
    );
    const [rules] = await connection.execute(
      `SELECT id, rule_name AS name, match_pattern AS matchPattern, category, icon, color, is_enabled AS enabled
       FROM auto_tag_rules WHERE user_id = ? ORDER BY created_at ASC, id ASC`,
      [userId],
    );
    return Response.json({
      uploads: (uploads as Array<Record<string, unknown>>).map((row) => ({
        id: Number(row.id), name: row.name, bank: row.bank, status: row.status,
        size: `${Math.max(1, Math.round(Number(row.file_size_bytes ?? 0) / 1024))} KB`,
        parsedRows: Number(row.parsed_rows ?? 0), warningCount: Number(row.warning_count ?? 0),
        statementPeriod: row.statement_period ?? undefined, space: row.space_key === "business" ? "business" : "personal",
      })),
      transactions: (transactions as Array<Record<string, unknown>>).map(asTransaction),
      wallets: (wallets as Array<Record<string, unknown>>).map((row) => ({
        bank: row.bank, accountName: row.accountName, accountNumber: row.accountNumber ?? undefined,
        currency: row.currency, endingBalance: Number(row.endingBalance ?? 0), source: "database", space: row.space === "business" ? "business" : "personal",
      })),
      rules: (rules as Array<Record<string, unknown>>).map((row) => ({
        id: Number(row.id), name: String(row.name ?? ""), matchPattern: String(row.matchPattern ?? ""),
        category: String(row.category ?? "Lainnya"), icon: String(row.icon ?? "📄"),
        color: String(row.color ?? "purple"), enabled: Boolean(row.enabled),
      })),
    });
  } catch (error) {
    console.error("Pocketpals data read failed", error);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  } finally {
    await connection?.end().catch(() => undefined);
  }
}

export async function POST(request: Request) {
  const identity = await requireUser();
  if (!identity) return Response.json({ error: "Unauthorized" }, { status: 401 });
  let connection: Connection | undefined;
  try {
    const body = await request.json() as {
      action?: string;
      upload?: { name: string; bank: string; size?: string; parsedRows?: number; warningCount?: number; statementPeriod?: string; space?: "personal" | "business" };
      transactions?: Array<Record<string, unknown>>;
      wallets?: Array<Record<string, unknown>>;
      rule?: { id?: number; name: string; matchPattern: string; category: string; icon?: string; color?: string; enabled?: boolean };
    };
    connection = await connect();
    await ensureSchema(connection);
    const userId = await getDbUser(connection, identity);
    if (body.action === "reset-financial-data") {
      await connection.execute(`DELETE FROM transactions WHERE user_id = ?`, [userId]);
      await connection.execute(`DELETE FROM wallets WHERE user_id = ?`, [userId]);
      await connection.execute(`DELETE FROM statement_uploads WHERE user_id = ?`, [userId]);
      await connection.execute(`DELETE FROM auto_tag_rules WHERE user_id = ?`, [userId]);
      return Response.json({ ok: true, reset: true });
    }
    if (body.action === "rule-create" && body.rule) {
      const [result] = await connection.execute(
        `INSERT INTO auto_tag_rules (user_id, rule_name, match_pattern, category, icon, color, is_enabled) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, body.rule.name, body.rule.matchPattern, body.rule.category, body.rule.icon ?? "📄", body.rule.color ?? "purple", body.rule.enabled === false ? 0 : 1],
      );
      return Response.json({ ok: true, id: Number((result as { insertId: number }).insertId) });
    }
    if (body.action !== "import" || !body.upload) return Response.json({ error: "Invalid import payload" }, { status: 400 });
    const upload = body.upload;
    const sizeBytes = Number(String(upload.size ?? "0").replace(/[^0-9]/g, "")) * 1024;
    const [existing] = await connection.execute(
      `SELECT id FROM statement_uploads WHERE user_id = ? AND bank_key = ? AND file_name = ? ORDER BY id DESC LIMIT 1`,
      [userId, upload.bank, upload.name],
    );
    const existingId = (existing as Array<{ id: number }>)[0]?.id;
    if (existingId) {
      await connection.execute(`DELETE FROM transactions WHERE statement_upload_id = ?`, [existingId]);
      await connection.execute(`DELETE FROM wallets WHERE statement_upload_id = ?`, [existingId]);
      await connection.execute(`DELETE FROM statement_uploads WHERE id = ?`, [existingId]);
    }
    const [uploadResult] = await connection.execute(
      `INSERT INTO statement_uploads (user_id, bank_key, file_name, file_type, file_size_bytes, parsed_rows, warning_count, statement_period, space_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, upload.bank, upload.name, upload.name.split(".").pop() ?? "unknown", sizeBytes,
        upload.parsedRows ?? 0, upload.warningCount ?? 0, upload.statementPeriod ?? null, upload.space === "business" ? "business" : "personal"],
    );
    const uploadId = Number((uploadResult as { insertId: number }).insertId);
    const walletIds = new Map<string, number>();
    for (const wallet of body.wallets ?? []) {
      const [result] = await connection.execute(
        `INSERT INTO wallets (user_id, statement_upload_id, bank_key, account_name, account_number, currency, ending_balance, space_key)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, uploadId, wallet.bank ?? upload.bank, wallet.accountName ?? "Statement account", wallet.accountNumber ?? null,
          wallet.currency ?? "IDR", Number(wallet.endingBalance ?? 0), wallet.space === "business" ? "business" : (upload.space === "business" ? "business" : "personal")],
      );
      walletIds.set(`${wallet.accountNumber ?? wallet.accountName}`, Number((result as { insertId: number }).insertId));
    }
    for (const transaction of body.transactions ?? []) {
      const externalId = String(transaction.id ?? crypto.randomUUID());
      const walletId = walletIds.get(String(transaction.accountNumber ?? transaction.accountName));
      await connection.execute(
        `INSERT INTO transactions (user_id, statement_upload_id, wallet_id, external_id, bank_key, transaction_date, title, description, remarks, meta, amount, direction, category, icon, color, source_file, space_key)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, uploadId, walletId ?? null, externalId, transaction.bank ?? upload.bank, cleanDate(String(transaction.date ?? "")),
          transaction.title ?? "Imported transaction", transaction.title ?? null, transaction.note ?? null, transaction.meta ?? null,
          Number(transaction.amountValue ?? 0), transaction.direction ?? "debit", transaction.category ?? "Lainnya",
          transaction.icon ?? "📄", transaction.color ?? "purple", transaction.source ?? upload.name, transaction.space === "business" ? "business" : (upload.space === "business" ? "business" : "personal")],
      );
    }
    return Response.json({ ok: true, uploadId });
  } catch (error) {
    console.error("Pocketpals import failed", error);
    return Response.json({ error: "Import could not be saved" }, { status: 503 });
  } finally {
    await connection?.end().catch(() => undefined);
  }
}

export async function PATCH(request: Request) {
  const identity = await requireUser();
  if (!identity) return Response.json({ error: "Unauthorized" }, { status: 401 });
  let connection: Connection | undefined;
  try {
    const body = await request.json() as { id?: string; changes?: Record<string, unknown>; ruleId?: number; rule?: Record<string, unknown> };
    connection = await connect();
    await ensureSchema(connection);
    const userId = await getDbUser(connection, identity);
    if (body.ruleId && body.rule) {
      await connection.execute(
        `UPDATE auto_tag_rules SET rule_name = COALESCE(?, rule_name), match_pattern = COALESCE(?, match_pattern), category = COALESCE(?, category), icon = COALESCE(?, icon), color = COALESCE(?, color), is_enabled = COALESCE(?, is_enabled) WHERE id = ? AND user_id = ?`,
        [body.rule.name ?? null, body.rule.matchPattern ?? null, body.rule.category ?? null, body.rule.icon ?? null, body.rule.color ?? null, typeof body.rule.enabled === "boolean" ? (body.rule.enabled ? 1 : 0) : null, body.ruleId, userId],
      );
      return Response.json({ ok: true });
    }
    if (!body.id || !body.changes) return Response.json({ error: "Invalid update payload" }, { status: 400 });
    const changes = body.changes;
    await connection.execute(
      `UPDATE transactions SET category = COALESCE(?, category), remarks = COALESCE(?, remarks), title = COALESCE(?, title), amount = COALESCE(?, amount), transaction_date = COALESCE(?, transaction_date), space_key = COALESCE(?, space_key)
       WHERE user_id = ? AND (external_id = ? OR CAST(id AS CHAR) = ?)`,
      [changes.category ?? null, changes.note ?? null, changes.title ?? null, changes.amountValue ?? null,
        cleanDate(changes.date ? String(changes.date) : undefined), changes.space === "business" ? "business" : (changes.space === "personal" ? "personal" : null), userId, body.id, body.id],
    );
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Pocketpals transaction update failed", error);
    return Response.json({ error: "Transaction could not be updated" }, { status: 503 });
  } finally { await connection?.end().catch(() => undefined); }
}

export async function DELETE(request: Request) {
  const identity = await requireUser();
  if (!identity) return Response.json({ error: "Unauthorized" }, { status: 401 });
  let connection: Connection | undefined;
  try {
    const body = await request.json() as { id?: string; ruleId?: number };
    connection = await connect();
    await ensureSchema(connection);
    const userId = await getDbUser(connection, identity);
    if (body.ruleId) {
      await connection.execute(`DELETE FROM auto_tag_rules WHERE id = ? AND user_id = ?`, [body.ruleId, userId]);
      return Response.json({ ok: true });
    }
    if (!body.id) return Response.json({ error: "Missing transaction id" }, { status: 400 });
    await connection.execute(`DELETE FROM transactions WHERE user_id = ? AND (external_id = ? OR CAST(id AS CHAR) = ?)`, [userId, body.id, body.id]);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Pocketpals transaction delete failed", error);
    return Response.json({ error: "Transaction could not be deleted" }, { status: 503 });
  } finally { await connection?.end().catch(() => undefined); }
}
