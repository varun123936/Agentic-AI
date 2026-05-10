// env.js — Must be the FIRST file Node loads.
// In ESM, static `import` statements in app.js are hoisted and all
// imported modules execute BEFORE any code in app.js runs.
// This means calling dotenv.config() inside app.js is always too late
// for modules like ai.config.js that read process.env at module-load time.
//
// Solution: use Node's --import flag to load this file before everything else.
// See package.json: "dev": "node --watch --import ./src/env.js src/app.js"

import { config } from 'dotenv';
config();
