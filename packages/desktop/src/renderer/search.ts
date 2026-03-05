const input = document.querySelector<HTMLInputElement>("#search-input");

if (input) {
  input.focus();
  input.select();

  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      window.close();
      return;
    }

    if (event.key === "Enter") {
      const query = input.value.trim();
      void window.okkDesktop.search.focusMainWindow(query);
      window.close();
    }
  });
}
