// Ver.164: keep the desktop auto-collapse behavior active through the 861-980px compact-desktop range.
(function installDesktopSidebarCompatibilityV159() {
  const mobile = window.matchMedia("(max-width: 860px)");
  const CLASS_NAME = "desktop-sidebar-v158";
  const EXPANDED_CLASS = "desktop-sidebar-expanded";
  const PINNED_CLASS = "desktop-sidebar-pinned";

  function apply() {
    if (!document.body) return;
    if (mobile.matches) {
      document.body.classList.remove(CLASS_NAME, EXPANDED_CLASS, PINNED_CLASS);
      document.body.removeAttribute("data-desktop-sidebar-state");
    }
  }

  if (typeof mobile.addEventListener === "function") mobile.addEventListener("change", () => setTimeout(apply, 0));
  else if (typeof mobile.addListener === "function") mobile.addListener(() => setTimeout(apply, 0));

  window.addEventListener("resize", () => setTimeout(apply, 0));
  window.addEventListener("orientationchange", () => setTimeout(apply, 0));
  window.addEventListener("pageshow", apply);

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply, { once: true });
  else apply();
})();
