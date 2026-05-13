const printTrigger = document.querySelector("[data-print-selected]");
const selectionForm = document.querySelector("[data-selection-form]");
const selectAll = document.querySelector("[data-select-all]");
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
