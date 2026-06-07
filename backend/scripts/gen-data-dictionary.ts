/**
 * Generates docs/data-dictionary.md from Prisma DMMF.
 * Run: pnpm -C backend schema:docs
 *
 * The output is consumed by AI agents at design time to understand
 * the data model without reading source code.
 */
import { Prisma } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { models, enums } = Prisma.dmmf.datamodel as any;

const lines: string[] = [];
const push = (...args: string[]) => lines.push(...args);

/** Normalise multi-line /// comments into a single clean string. */
const doc = (s: string | undefined): string =>
  (s ?? '').replace(/\\n/g, ' ').replace(/\n/g, ' ').trim();

// ── Header ──────────────────────────────────────────────────────────────────

push(
  '# Data Dictionary',
  '',
  `> Auto-generated from Prisma schema on ${new Date().toISOString().slice(0, 10)}.`,
  '> Do not edit manually — run `pnpm -C backend schema:docs` to regenerate.',
  '',
  '---',
  '',
);

// ── Enums ────────────────────────────────────────────────────────────────────

push('## Enums', '');

for (const e of enums) {
  push(`### ${e.name}`, '');
  if (e.documentation) push(`> ${doc(e.documentation)}`, '');
  push('| Value | Description |', '|-------|-------------|');
  for (const v of e.values) {
    push(`| \`${v.name}\` | ${doc(v.documentation)} |`);
  }
  push('');
}

// ── Models ───────────────────────────────────────────────────────────────────

push('## Models', '');

for (const m of models) {
  push(`### ${m.name}`, '');
  if (m.documentation) push(`> ${doc(m.documentation)}`, '');
  push(
    `**DB table:** \`${m.dbName ?? m.name.toLowerCase()}\``,
    '',
    '| Field | Type | Required | Unique | Description |',
    '|-------|------|----------|--------|-------------|',
  );

  for (const f of m.fields) {
    if (f.kind === 'object') continue;

    const required = f.isRequired ? '✓' : '';
    const unique = f.isUnique || f.isId ? '✓' : '';
    const type = f.isList ? `${f.type}[]` : f.type;
    push(`| \`${f.name}\` | ${type} | ${required} | ${unique} | ${doc(f.documentation)} |`);
  }
  push('');
}

// ── Write ─────────────────────────────────────────────────────────────────────

const outPath = path.resolve(__dirname, '../../docs/data-dictionary.md');
fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
console.log(`✔ Written to ${outPath}`);
