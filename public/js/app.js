const printTrigger = document.querySelector("[data-print-selected]");
const selectionForm = document.querySelector("[data-selection-form]");
const selectAll = document.querySelector("[data-select-all]");
const pdfPreview = document.querySelector("[data-pdf-preview]");
const storageKey = "lab-sds-selected-ids";

if (printTrigger && selectionForm) {
  const selectedInputs = Array.from(
    selectionForm.querySelectorAll('input[name="selectedIds"]')
  );
  const remembered = new Set(
    JSON.parse(window.sessionStorage.getItem(storageKey) ?? "[]")
  );

  function rememberSelection() {
    const current = new Set(
      selectedInputs.filter((box) => box.checked).map((box) => box.value)
    );

    window.sessionStorage.setItem(
      storageKey,
      JSON.stringify(Array.from(current))
    );
  }

  function updateSelectAllState() {
    if (!selectAll) {
      return;
    }

    const checkedCount = selectedInputs.filter((box) => box.checked).length;
    selectAll.checked =
      selectedInputs.length > 0 && checkedCount === selectedInputs.length;
    selectAll.indeterminate =
      checkedCount > 0 && checkedCount < selectedInputs.length;
  }

  selectedInputs.forEach((input) => {
    if (remembered.has(input.value)) {
      input.checked = true;
    }

    input.addEventListener("change", () => {
      rememberSelection();
      updateSelectAllState();
    });
  });

  if (selectAll) {
    selectAll.addEventListener("change", () => {
      selectedInputs.forEach((input) => {
        input.checked = selectAll.checked;
      });

      rememberSelection();
      updateSelectAllState();
    });
  }

  updateSelectAllState();

  printTrigger.addEventListener("click", () => {
    const selected = selectedInputs
      .filter((input) => input.checked)
      .map((input) => input.value);

    if (!selected.length) {
      window.alert("Select at least one SDS row before printing.");
      return;
    }

    const params = new URLSearchParams({ ids: selected.join(",") });
    window.sessionStorage.removeItem(storageKey);
    window.open(`/sds/print/file?${params.toString()}`, "_blank", "noopener");
  });
}

if (pdfPreview) {
  const mobileViewer = window.matchMedia("(max-width: 860px)");

  async function loadMobilePdfPreview() {
    if (!mobileViewer.matches || pdfPreview.dataset.loaded) {
      return;
    }

    pdfPreview.dataset.loaded = "true";

    try {
      const documentId = pdfPreview.dataset.documentId;
      const documentTitle = pdfPreview.dataset.documentTitle ?? "PDF";
      const response = await window.fetch(`/sds/${documentId}/pages`);

      if (!response.ok) {
        throw new Error("Unable to load PDF page count.");
      }

      const { pageCount } = await response.json();
      const fragment = document.createDocumentFragment();

      for (let page = 1; page <= pageCount; page += 1) {
        const image = document.createElement("img");

        image.src = `/sds/${documentId}/page/${page}.png`;
        image.alt = `${documentTitle} page ${page}`;
        image.loading = page === 1 ? "eager" : "lazy";
        image.decoding = "async";
        image.className = "pdf-page-image";
        fragment.append(image);
      }

      pdfPreview.append(fragment);
    } catch (_error) {
      pdfPreview.dataset.loaded = "";
      pdfPreview.hidden = true;
    }
  }

  loadMobilePdfPreview();
  mobileViewer.addEventListener("change", loadMobilePdfPreview);
}
