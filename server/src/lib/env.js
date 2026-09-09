/**
 * Side-effect module: loads `server/.env` into process.env.
 *
 * Import this FIRST in any entrypoint (`import './lib/env.js'`). ESM imports are
 * hoisted, so calling `dotenv.config()` inline in index.js runs *after* every
 * imported module has already evaluated — this file guarantees ordering instead.
 */
import dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../../.env') });
