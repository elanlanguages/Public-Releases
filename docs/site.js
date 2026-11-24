// Copy-link buttons, and the visitor's own browser store first.
(() => {
  const toast = document.getElementById("toast");
  let timer;
  const show = (text) => {
    toast.textContent = text;
    toast.classList.add("is-shown");
    clearTimeout(timer);
    timer = setTimeout(() => toast.classList.remove("is-shown"), 2400);
  };

  document.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-copy]");
    if (!btn) return;
    const url = new URL(btn.dataset.copy, location.href).href;
    try {
      await navigator.clipboard.writeText(url);
      show("Link copied. It always points to the latest version.");
    } catch {
      prompt("Copy this link:", url);
    }
  });

  if (/firefox/i.test(navigator.userAgent)) {
    document.querySelectorAll('[data-store="firefox"]').forEach((ff) => {
      const group = ff.parentElement;
      group.querySelectorAll("[data-store]").forEach((b) => b.classList.replace("btn--ink", "btn--card"));
      ff.classList.replace("btn--card", "btn--ink");
      group.prepend(ff);
    });
  }
})();
