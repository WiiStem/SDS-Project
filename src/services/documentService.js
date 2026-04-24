import slugify from "slugify";

import { configuredLabs } from "../config/env.js";
import { prisma } from "../lib/prisma.js";

async function listLabs() {
  await ensureConfiguredLabs();

  const labs = await prisma.lab.findMany(
    configuredLabs.length
      ? {
          where: {
            slug: {
              in: configuredLabs.map((lab) => lab.slug)
            }
          }
        }
      : {
          orderBy: { name: "asc" }
        }
  );

  if (!configuredLabs.length) {
    return labs;
  }

  const labsBySlug = new Map(labs.map((lab) => [lab.slug, lab]));

  return configuredLabs
    .map((lab) => labsBySlug.get(lab.slug))
    .filter(Boolean);
}

async function listTags() {
  return prisma.tag.findMany({
    orderBy: { name: "asc" }
  });
}

async function listDocuments(params = {}) {
  const search = params.search?.trim();
  const labSlugs = params.labSlugs?.filter(Boolean) ?? [];
  const tagSlugs = params.tagSlugs?.filter(Boolean) ?? [];

  return prisma.document.findMany({
    where: {
      AND: [
        search
          ? {
              OR: [
                { product: { contains: search } },
                { description: { contains: search } },
                { notes: { contains: search } },
                {
                  tags: {
                    some: {
                      tag: {
                        OR: [
                          { name: { contains: search } },
                          { slug: { contains: toSlug(search) } }
                        ]
                      }
                    }
                  }
                }
              ]
            }
          : {},
        labSlugs.length
          ? {
              labs: {
                some: {
                  lab: {
                    slug: {
                      in: labSlugs
                    }
                  }
                }
              }
            }
          : {},
        tagSlugs.length
          ? {
              tags: {
                some: {
                  tag: {
                    slug: {
                      in: tagSlugs
                    }
                  }
                }
              }
            }
          : {}
      ]
    },
    include: baseInclude,
    orderBy: getSort(params.sort)
  });
}

async function getDocumentById(id) {
  return prisma.document.findUnique({
    where: { id },
    include: baseInclude
  });
}

async function getDocumentsForPrint(ids) {
  return prisma.document.findMany({
    where: { id: { in: ids } },
    include: baseInclude
  });
}

async function createDocument(input) {
  const normalizedTags = normalizeValues(input.tags);

  return prisma.$transaction(async (transaction) => {
    const tags = await Promise.all(
      normalizedTags.map((tag) =>
        transaction.tag.upsert({
          where: { slug: toSlug(tag) },
          update: { name: tag },
          create: {
            name: tag,
            slug: toSlug(tag)
          }
        })
      )
    );

    return transaction.document.create({
      data: {
        product: input.product,
        description: input.description,
        notes: input.notes,
        bucketKey: input.bucketKey,
        originalFilename: input.originalFilename,
        createdById: input.userId,
        updatedById: input.userId,
        labs: {
          create: input.labIds.map((labId) => ({
            lab: { connect: { id: labId } }
          }))
        },
        tags: {
          create: tags.map((tag) => ({
            tag: { connect: { id: tag.id } }
          }))
        }
      },
      include: baseInclude
    });
  });
}

async function updateDocument(id, input) {
  const normalizedTags = normalizeValues(input.tags);

  return prisma.$transaction(async (transaction) => {
    const tags = await Promise.all(
      normalizedTags.map((tag) =>
        transaction.tag.upsert({
          where: { slug: toSlug(tag) },
          update: { name: tag },
          create: {
            name: tag,
            slug: toSlug(tag)
          }
        })
      )
    );

    await transaction.documentLab.deleteMany({
      where: { documentId: id }
    });

    await transaction.documentTag.deleteMany({
      where: { documentId: id }
    });

    return transaction.document.update({
      where: { id },
      data: {
        product: input.product,
        description: input.description,
        notes: input.notes,
        bucketKey: input.bucketKey,
        originalFilename: input.originalFilename,
        updatedById: input.userId,
        labs: {
          create: input.labIds.map((labId) => ({
            lab: { connect: { id: labId } }
          }))
        },
        tags: {
          create: tags.map((tag) => ({
            tag: { connect: { id: tag.id } }
          }))
        }
      },
      include: baseInclude
    });
  });
}

async function deleteDocumentRecord(id) {
  return prisma.document.delete({
    where: { id }
  });
}

const baseInclude = {
  labs: {
    include: { lab: true }
  },
  tags: {
    include: { tag: true }
  },
  createdBy: true,
  updatedBy: true
};

let configuredLabsPromise;

function ensureConfiguredLabs() {
  if (!configuredLabs.length) {
    return Promise.resolve();
  }

  if (!configuredLabsPromise) {
    configuredLabsPromise = prisma.$transaction(
      configuredLabs.map((lab) =>
        prisma.lab.upsert({
          where: { slug: lab.slug },
          update: { name: lab.name },
          create: lab
        })
      )
    );
  }

  return configuredLabsPromise;
}

function getSort(sort) {
  switch (sort) {
    case "updated_desc":
      return { updatedAt: "desc" };
    case "created_desc":
      return { createdAt: "desc" };
    case "product_desc":
      return { product: "desc" };
    case "product_asc":
    default:
      return { product: "asc" };
  }
}

function normalizeValues(values) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function toSlug(value) {
  return slugify(value, { lower: true, strict: true, trim: true });
}

export {
  createDocument,
  deleteDocumentRecord,
  getDocumentById,
  getDocumentsForPrint,
  listDocuments,
  listLabs,
  listTags,
  updateDocument
};
