import { PrismaClient } from "@prisma/client";

import { configuredLabs } from "../src/config/env.js";

const prisma = new PrismaClient();

async function main() {
  for (const lab of configuredLabs) {
    await prisma.lab.upsert({
      where: { slug: lab.slug },
      update: { name: lab.name },
      create: lab
    });
  }

  const tags = [
    { name: "Flammable", slug: "flammable" },
    { name: "Solvent", slug: "solvent" },
    { name: "Corrosive", slug: "corrosive" }
  ];

  for (const tag of tags) {
    await prisma.tag.upsert({
      where: { slug: tag.slug },
      update: { name: tag.name },
      create: tag
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
