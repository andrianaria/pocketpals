import fs from "node:fs/promises";
import mysql from "mysql2/promise";

const env = process.env;
const connection = await mysql.createConnection({
  host: env.POCKETPALS_DB_HOST || "127.0.0.1",
  port: Number(env.POCKETPALS_DB_PORT || 3307),
  user: env.POCKETPALS_DB_USER || "root",
  password: env.POCKETPALS_DB_PASSWORD || "",
  multipleStatements: true,
});

const schema = await fs.readFile(new URL("../db/mysql-schema.sql", import.meta.url), "utf8");
await connection.query(schema);
await connection.end();
console.log("Pocketpals local MySQL schema is ready: pocketpals_dev");
