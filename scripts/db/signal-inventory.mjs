import {moduleCli} from './notes-signal-migrate.mjs';
moduleCli('signal', process.argv.slice(2), true).catch(error => { console.error(error.message); process.exitCode = 1; });
