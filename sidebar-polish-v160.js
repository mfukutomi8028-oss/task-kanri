// Ver.160: remove decorative pin emoji; the pin control is intentionally text-only.
(function refineDesktopSidebarPinV160() {
  function apply() {
    const button = document.querySelector('.desktop-sidebar-pin-v158');
    if (!button) return;

    button.querySelectorAll('.desktop-sidebar-pin-icon-v158').forEach(node => node.remove());
    button.classList.add('desktop-sidebar-pin-text-only-v160');
  }

  const observer = new MutationObserver(() => apply());

  function start() {
    apply();
    if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  window.addEventListener('pageshow', apply);
})();
