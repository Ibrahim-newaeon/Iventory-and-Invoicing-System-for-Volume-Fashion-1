import { db } from "./db";
import { users } from "@shared/schema";
import { hashPassword } from "./customAuth";
import { eq } from "drizzle-orm";

async function seed() {
  // Check if any admin user exists
  const existingAdmins = await db
    .select()
    .from(users)
    .where(eq(users.role, "Admin"))
    .limit(1);

  if (existingAdmins.length > 0) {
    console.log("Admin user already exists, skipping seed.");
    return;
  }

  const hashedPassword = await hashPassword("admin123");

  await db.insert(users).values({
    username: "admin",
    password: hashedPassword,
    email: "admin@volumefashion.com",
    firstName: "System",
    lastName: "Admin",
    role: "Admin",
    isActive: true,
  });

  console.log("Default admin user created.");
  console.log("  Username: admin");
  console.log("  Password: admin123");
  console.log("  ⚠️  Change this password immediately after first login!");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
