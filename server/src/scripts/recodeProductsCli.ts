/** CLI: npm run recode:products [-- --dry-run | -- --apply <file>] — xem src/scripts/recodeProducts.ts */
import { runRecodeCli } from './recodeProducts';

runRecodeCli().catch((err) => {
  console.error('✖ recodeProducts lỗi:', err?.message || err);
  process.exit(1);
});
