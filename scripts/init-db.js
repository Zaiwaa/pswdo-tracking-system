require('dotenv').config();
const { initDb, pool } = require('../src/db');
initDb().then(() => { console.log('Database initialized.'); return pool.end(); }).catch(err => { console.error(err); process.exit(1); });
