/**
 * Database Seed Script
 *
 * Creates an initial admin user so you can log in after first setup.
 * Run with: npm run db:seed
 *
 * Default admin credentials:
 *   Email:    admin@acoms.local
 *   Password: admin123
 *
 * IMPORTANT: Change this password immediately in a real deployment.
 */

import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const existingAdmin = await prisma.user.findUnique({
    where: { email: "admin@acoms.local" },
  });

  if (existingAdmin) {
    console.log("Admin user already exists. Skipping seed.");
    return;
  }

  const passwordHash = await hash("admin123", 12);

  await prisma.user.create({
    data: {
      email: "admin@acoms.local",
      passwordHash,
      name: "Admin",
      role: "ADMIN",
      isActive: true,
    },
  });

  console.log("Seed complete. Admin user created:");
  console.log("  Email:    admin@acoms.local");
  console.log("  Password: admin123");
  console.log("");
  console.log("IMPORTANT: Change this password in a real deployment.");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
