const { seed } = require('./seed.cjs');

seed({ reset: true }).catch(() => {
  console.error('Demo reset failed. Check the reset guard, migrations, and database connection.');
  process.exitCode = 1;
});
