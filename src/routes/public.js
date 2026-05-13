import { Router } from "express";
import * as mupdf from "mupdf";
import slugify from "slugify";

import { env } from "../config/env.js";
import {
  getDocumentById,
  getDocumentsForPrint,
  listDocuments,
  listLabs
} from "../services/documentService.js";
import { getPdfBuffer, getPdfUrl } from "../services/storage.js";

const publicRouter = Router();

publicRouter.get("/", (_request, response) => {
  response.redirect("/sds");
});

publicRouter.get("/sds", async (request, response, next) => {
  try {
    const search = asSingle(request.query.search);
    const sort = asSingle(request.query.sort) ?? "product_asc";
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

    response.render("public-list", {
      documents,
      labs,
      search,
      sort,
      selectedLabs,
      tagSearch,
      publicNotes: env.PUBLIC_NOTES
    });
  } catch (error) {
    next(error);
  }
});

publicRouter.get("/sds/print", async (request, response, next) => {
  try {
    const ids = getRequestedIds(request.query.ids);

    const documents = ids.length
      ? sortDocumentsByIds(await getDocumentsForPrint(ids), ids)
      : [];
    const files = await Promise.all(
      documents.map(async (document) => ({
        ...document,
        fileUrl: await getPdfUrl(document.bucketKey)
      }))
    );

    response.render("print-selected", {
      documents: files,
      mergedPrintUrl: ids.length ? `/sds/print/file?ids=${ids.join(",")}` : null
    });
  } catch (error) {
    next(error);
  }
});

publicRouter.get("/sds/print/file", async (request, response, next) => {
  try {
    const ids = getRequestedIds(request.query.ids);

    if (!ids.length) {
      return response.status(400).render("error", {
        message: "No SDS documents were selected for printing."
      });
    }

    const documents = sortDocumentsByIds(await getDocumentsForPrint(ids), ids);
    const mergedBytes = await mergePdfDocuments(documents);

    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("Content-Disposition", 'inline; filename="selected-sds.pdf"');
    response.send(mergedBytes);
  } catch (error) {
    next(error);
  }
});

publicRouter.get("/sds/:id/file", async (request, response, next) => {
  try {
    const document = await getDocumentById(Number(request.params.id));

    if (!document) {
      return response.status(404).render("error", {
        message: "The PDF for that SDS record was not found."
      });
    }

    const url = await getPdfUrl(document.bucketKey);
    response.redirect(url);
  } catch (error) {
    next(error);
  }
});

publicRouter.get("/sds/:id", async (request, response, next) => {
  try {
    const document = await getDocumentById(Number(request.params.id));

    if (!document) {
      return response.status(404).render("error", {
        message: "That SDS record was not found."
      });
    }

    const fileUrl = await getPdfUrl(document.bucketKey);

    response.render("document-detail", {
      document,
      fileUrl,
      publicNotes: env.PUBLIC_NOTES
    });
  } catch (error) {
    next(error);
  }
});

function asSingle(value) {
  return typeof value === "string" ? value : undefined;
}

function asArray(value) {
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === "string");
  }

  return typeof value === "string" ? [value] : [];
}

function getRequestedIds(value) {
  return asSingle(value)
    ?.split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item > 0) ?? [];
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

function sortDocumentsByIds(documents, ids) {
  const documentsById = new Map(documents.map((document) => [document.id, document]));

  return ids.map((id) => documentsById.get(id)).filter(Boolean);
}

async function mergePdfDocuments(documents) {
  const mergedPdf = new mupdf.PDFDocument();
  let targetPageIndex = 0;

  try {
    for (const document of documents) {
      const buffer = await getPdfBuffer(document.bucketKey);
      const sourcePdf = mupdf.Document
        .openDocument(new Uint8Array(buffer), "application/pdf")
        .asPDF();

      if (!sourcePdf) {
        throw new Error(`${document.product} is not a valid PDF document.`);
      }

      try {
        for (
          let sourcePageIndex = 0;
          sourcePageIndex < sourcePdf.countPages();
          sourcePageIndex += 1
        ) {
          mergedPdf.graftPage(targetPageIndex, sourcePdf, sourcePageIndex);
          targetPageIndex += 1;
        }
      } finally {
        sourcePdf.destroy();
      }
    }

    const mergedBuffer = mergedPdf.saveToBuffer("garbage=4,compress");

    try {
      return Buffer.from(mergedBuffer.asUint8Array());
    } finally {
      mergedBuffer.destroy();
    }
  } finally {
    mergedPdf.destroy();
  }
}

export { publicRouter };
