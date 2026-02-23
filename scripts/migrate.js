import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { pool } from '../src/db/db.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.join(__dirname, '../src/db/migrations');

async function ensureMigrationsTable() {
	await pool.query(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			id BIGSERIAL PRIMARY KEY,
			name TEXT NOT NULL UNIQUE,
			executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`);
}

async function getExecuted() {
	const res = await pool.query('SELECT name FROM schema_migrations');
	return new Set(res.rows.map((r) => r.name));
}

async function run() {
	await ensureMigrationsTable();
	const executed = await getExecuted();
	const files = (await fs.readdir(migrationsDir))
		.filter((f) => f.endsWith('.sql'))
		.sort();

	for (const file of files) {
		if (executed.has(file)) {
			console.log(`↷ skip ${file}`);
			continue;
		}

		const fullPath = path.join(migrationsDir, file);
		const sql = await fs.readFile(fullPath, 'utf8');

		const client = await pool.connect();
		try {
			await client.query('BEGIN');
			await client.query(sql);
			await client.query('INSERT INTO schema_migrations(name) VALUES ($1)', [file]);
			await client.query('COMMIT');
			console.log(`✓ migrated ${file}`);
		} catch (error) {
			await client.query('ROLLBACK');
			console.error(`✗ failed ${file}:`, error.message);
			throw error;
		} finally {
			client.release();
		}
	}
}

run()
	.then(async () => {
		await pool.end();
		process.exit(0);
	})
	.catch(async () => {
		await pool.end();
		process.exit(1);
	});
