import {moduleCli} from './notes-signal-migrate.mjs';
moduleCli('signal').catch(error => { console.error(error.message); process.exitCode = 1; });
