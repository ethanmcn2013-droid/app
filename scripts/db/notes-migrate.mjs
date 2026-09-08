import {moduleCli} from './notes-signal-migrate.mjs';
moduleCli('notes').catch(error => { console.error(error.message); process.exitCode = 1; });
