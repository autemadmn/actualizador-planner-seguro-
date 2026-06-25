import { copyFile, cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(rootDir, 'dist');
const distAssetsDir = path.join(distDir, 'assets');
const rootAssetsDir = path.join(rootDir, 'assets');

await copyFile(path.join(distDir, 'build.html'), path.join(distDir, 'index.html'));

await rm(rootAssetsDir, { recursive: true, force: true });
await mkdir(rootAssetsDir, { recursive: true });
await cp(distAssetsDir, rootAssetsDir, { recursive: true });
