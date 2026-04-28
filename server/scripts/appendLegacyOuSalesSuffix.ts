/**
 * One-time data fix: append " - Sales" to User.ou when it exactly matches a legacy geographic OU.
 *
 * Usage (from repo root, with DATABASE_URL set):
 *   npx tsx server/scripts/appendLegacyOuSalesSuffix.ts
 *
 * Dry-run (default): prints counts only.
 *   npx tsx server/scripts/appendLegacyOuSalesSuffix.ts --apply
 *
 * Idempotent: after first apply, no rows match legacy exact strings.
 */
import { PrismaClient } from "@prisma/client";
import { LEGACY_GEO_OU_VALUES } from "../src/constants/departmentOuOptions";

const prisma = new PrismaClient();

const SUFFIX = " - Sales";

async function main() {
  const apply = process.argv.includes("--apply");
  const legacy = [...LEGACY_GEO_OU_VALUES];

  let totalWouldUpdate = 0;
  for (const ou of legacy) {
    const count = await prisma.user.count({ where: { ou } });
    if (count > 0) {
      console.log(`[legacy-ou] "${ou}" → "${ou}${SUFFIX}"  users: ${count}`);
      totalWouldUpdate += count;
    }
  }

  console.log(`[legacy-ou] total users to update: ${totalWouldUpdate}`);
  if (!apply) {
    console.log("[legacy-ou] dry-run only. Re-run with --apply to write.");
    await prisma.$disconnect();
    return;
  }

  for (const ou of legacy) {
    const result = await prisma.user.updateMany({
      where: { ou },
      data: { ou: `${ou}${SUFFIX}` },
    });
    if (result.count > 0) {
      console.log(`[legacy-ou] updated ${result.count} row(s) from "${ou}"`);
    }
  }

  console.log("[legacy-ou] done.");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
