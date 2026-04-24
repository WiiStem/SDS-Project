import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.__prisma ??
  new PrismaClient({
    log: ["warn", "error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__prisma = prisma;
}

export { prisma };
