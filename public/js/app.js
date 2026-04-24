const printTrigger = document.querySelector("[data-print-selected]");
const selectionForm = document.querySelector("[data-selection-form]");
const storageKey = "lab-sds-selected-ids";

if (printTrigger && selectionForm) {
  const remembered = new Set(
    JSON.parse(window.sessionStorage.getItem(storageKey) ?? "[]")
  );

  selectionForm
    .querySelectorAll('input[name="selectedIds"]')
    .forEach((input) => {
      if (remembered.has(input.value)) {
        input.checked = true;
      }

      input.addEventListener("change", () => {
        const current = new Set(
          Array.from(
            selectionForm.querySelectorAll('input[name="selectedIds"]:checked')
          ).map((box) => box.value)
        );

        window.sessionStorage.setItem(
          storageKey,
          JSON.stringify(Array.from(current))
        );
      });
    });

  printTrigger.addEventListener("click", () => {
    const selected = Array.from(
      selectionForm.querySelectorAll('input[name="selectedIds"]:checked')
    ).map((input) => input.value);

    if (!selected.length) {
      window.alert("Select at least one SDS row before printing.");
      return;
    }

    const params = new URLSearchParams({ ids: selected.join(",") });
    window.sessionStorage.removeItem(storageKey);
    window.open(`/sds/print/file?${params.toString()}`, "_blank", "noopener");
  });
}
