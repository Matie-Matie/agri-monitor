/** Applies schema + runs seed. Convenience runner for `npm run db:init`. */
import('./seed.js').catch((e) => {
  console.error('Seed failed:', e.message);
  process.exit(1);
});