document.addEventListener("DOMContentLoaded", () => {
  const sidebar = document.getElementById("tsd-nav-container");
  if (!sidebar) return;
  const observer = new MutationObserver(() => {
    const accordions = sidebar.querySelectorAll("details.tsd-accordion");
    const onToggle = (event) => {
      if (!event.target.open) return;
      accordions.forEach((accordion) => {
        if (accordion !== event.target) accordion.removeAttribute("open");
      });
    };
    accordions.forEach((accordion) => {
      accordion.addEventListener("toggle", onToggle);
    });
    observer.disconnect();
  });
  observer.observe(sidebar, { childList: true });
});
