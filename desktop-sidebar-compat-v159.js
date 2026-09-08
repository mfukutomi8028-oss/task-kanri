// Ver.159: keep the desktop auto-collapse behavior out of the existing <=980px compact layout.
(function installDesktopSidebarCompatibilityV159() {
  const compact = window.matchMedia("(max-width: 980px)");
  const CLASS_NAME = "desktop-sidebar-v158";
  const EXPANDED_CLASS = "desktop-sidebar-expanded";
  const PINNED_CLASS = "desktop-sidebar-pinned";

  function apply() {
    if (!document.body) return;
    if (compact.matches) {
      document.body.classList.remove(CLASS_NAME, EXPANDED_CLASS, PINNED_CLASS);
      document.body.removeAttribute("data-desktop-sidebar-state");
    }
  }

  if (typeof compact.addEventListener === "function") compact.addEventListener("change", () => setTimeout(apply, 0));
  else if (typeof compact.addListener === "function") compact.addListener(() => setTimeout(apply, 0));

  window.addEventListener("resize", () => setTimeout(apply, 0));
  window.addEventListener("orientationchange", () => setTimeout(apply, 0));
  window.addEventListener("pageshow", apply);

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply, { once: true });
  else apply();
})();
