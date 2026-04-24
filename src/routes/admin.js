import { Router } from "express";
import multer from "multer";
import slugify from "slugify";
import { z } from "zod";

import { env } from "../config/env.js";
import { requireAdmin } from "../middleware/auth.js";
import {
  createDocument,
  deleteDocumentRecord,
  getDocumentById,
  listDocuments,
  listLabs,
  listTags,
  updateDocument
} from "../services/documentService.js";
import { deletePdf, uploadPdf } from "../services/storage.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024
  },
  fileFilter: (_request, file, callback) => {
    if (file.mimetype !== "application/pdf") {
      return callback(new Error("Only PDF uploads are supported."));
    }

    callback(null, true);
  }
});

const adminRouter = Router();

adminRouter.use(requireAdmin);

adminRouter.get("/sds", async (request, response, next) => {
  try {
    const search = asSingle(request.query.search);
    const sort = asSingle(request.query.sort) ?? "updated_desc";
    const selectedLabs = asArray(request.query.lab);
    const tagSearch = asSingle(request.query.tag)?.trim() ?? "";

    const [documents, labs] = await Promise.all([
      listDocuments({
        search,
        sort,
        labSlugs: selectedLabs,
        tagSlugs: parseTagFilter(tagSearch)
      }),
      listLabs()
    ]);

    response.render("admin-list", {
      documents,
      labs,
      search,
      sort,
      selectedLabs,
      tagSearch
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/sds/new", async (_request, response, next) => {
  try {
    const [labs, tags] = await Promise.all([listLabs(), listTags()]);

    response.render("document-form", {
      mode: "create",
      document: null,
      labs,
      tags,
      selectedLabIds: [],
      selectedTagNames: [],
      formError: null
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/sds", upload.single("pdf"), async (request, response, next) => {
  let uploadedKey = null;

  try {
    const parsed = parseDocumentPayload(request.body);

    if (!request.file) {
      throw new Error("A PDF is required when creating an SDS record.");
    }

    const bucketKey = buildBucketKey(parsed.product, request.file.originalname);
    uploadedKey = bucketKey;
    await uploadPdf(request.file.buffer, bucketKey);

    await createDocument({
      product: parsed.product,
      description: parsed.description,
      notes: parsed.notes,
      bucketKey,
      originalFilename: request.file.originalname,
      labIds: parsed.labIds,
      tags: parsed.tags,
      userId: request.user?.id
    });

    response.redirect("/admin/sds");
  } catch (error) {
    if (uploadedKey) {
      await deletePdf(uploadedKey).catch(() => undefined);
    }
    next(error);
  }
});

adminRouter.get("/sds/:id/edit", async (request, response, next) => {
  try {
    const [document, labs, tags] = await Promise.all([
      getDocumentById(Number(request.params.id)),
      listLabs(),
      listTags()
    ]);

    if (!document) {
      return response.status(404).render("error", {
        message: "That SDS record was not found."
      });
    }

    response.render("document-form", {
      mode: "edit",
      document,
      labs,
      tags,
      selectedLabIds: document.labs.map((item) => item.labId),
      selectedTagNames: document.tags.map((item) => item.tag.name),
      formError: null
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/sds/:id", upload.single("pdf"), async (request, response, next) => {
  let uploadedKey = null;

  try {
    const document = await getDocumentById(Number(request.params.id));

    if (!document) {
      return response.status(404).render("error", {
        message: "That SDS record was not found."
      });
    }

    const parsed = parseDocumentPayload(request.body);
    let nextBucketKey;
    let nextOriginalFilename;

    if (request.file) {
      nextBucketKey = buildBucketKey(parsed.product, request.file.originalname);
      nextOriginalFilename = request.file.originalname;
      uploadedKey = nextBucketKey;
      await uploadPdf(request.file.buffer, nextBucketKey);
    }

    await updateDocument(document.id, {
      product: parsed.product,
      description: parsed.description,
      notes: parsed.notes,
      labIds: parsed.labIds,
      tags: parsed.tags,
      bucketKey: nextBucketKey ?? document.bucketKey,
      originalFilename: nextOriginalFilename ?? document.originalFilename,
      userId: request.user?.id
    });

    if (nextBucketKey && nextBucketKey !== document.bucketKey) {
      await deletePdf(document.bucketKey);
    }

    response.redirect(`/sds/${document.id}`);
  } catch (error) {
    if (uploadedKey) {
      await deletePdf(uploadedKey).catch(() => undefined);
    }
    next(error);
  }
});

adminRouter.post("/sds/:id/delete", async (request, response, next) => {
  try {
    const document = await getDocumentById(Number(request.params.id));

    if (!document) {
      return response.status(404).render("error", {
        message: "That SDS record was not found."
      });
    }

    await deletePdf(document.bucketKey);
    await deleteDocumentRecord(document.id);

    response.redirect("/admin/sds");
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/health", (_request, response) => {
  response.json({
    ok: true,
    bucketConfigured: Boolean(env.S3_BUCKET),
    timestamp: new Date().toISOString()
  });
});

const payloadSchema = z.object({
  product: z.string().trim().min(1, "Product is required."),
  description: z.string().trim().min(1, "Description is required."),
  notes: z.string().optional(),
  labs: z.union([z.string(), z.array(z.string())]).optional(),
  tags: z.string().optional()
});

function parseDocumentPayload(payload) {
  const parsed = payloadSchema.parse(payload);
  const labIds = asArray(parsed.labs).map((value) => Number(value));
  const tags =
    parsed.tags
      ?.split(",")
      .map((value) => value.trim())
      .filter(Boolean) ?? [];

  return {
    product: parsed.product,
    description: parsed.description,
    notes: parsed.notes?.trim() || undefined,
    labIds: labIds.filter((value) => Number.isInteger(value) && value > 0),
    tags
  };
}

function buildBucketKey(product, filename) {
  const extension = filename.toLowerCase().endsWith(".pdf") ? ".pdf" : "";
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const base = slugify(product, { lower: true, strict: true, trim: true });
  return `pdfs/sds/${base}-${stamp}${extension || ".pdf"}`;
}

function asSingle(value) {
  return typeof value === "string" ? value : undefined;
}

function asArray(value) {
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === "string");
  }

  return typeof value === "string" ? [value] : [];
}

function parseTagFilter(value) {
  return value
    .split(",")
    .map((item) =>
      slugify(item.trim(), {
        lower: true,
        strict: true,
        trim: true
      })
    )
    .filter(Boolean);
}

export { adminRouter };
