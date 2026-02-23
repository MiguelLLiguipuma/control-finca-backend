import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

async function collect(dir) {
	const out = [];
	const entries = await fs.readdir(dir, { withFileTypes: true });
	for (const entry of entries) {
		if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			out.push(...(await collect(full)));
			continue;
		}
		if (full.endsWith('.js')) out.push(full);
	}
	return out;
}

const files = await collect(root);
let hasError = false;
for (const file of files) {
	const res = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
	if (res.status !== 0) hasError = true;
}

if (hasError) process.exit(1);
console.log(`Lint OK: ${files.length} archivos`);
