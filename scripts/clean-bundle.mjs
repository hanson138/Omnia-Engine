import { readFileSync, writeFileSync } from 'node:fs';

// esbuild preserves whitespace-only lines inside Zod's generated template literals.
// Removing that indentation keeps the committed browser bundle free of trailing spaces.
const path = new URL('../index.js', import.meta.url);
const bundle = readFileSync(path, 'utf8');
writeFileSync(path, bundle.replace(/^[ \t]+(?=\r?$)/gm, ''));
