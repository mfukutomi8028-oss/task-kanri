// Ver.185: force the refreshed work-board brand into browser tabs, sidebar branding and system notifications.
(function installBrandV185() {
  'use strict';

  const VERSION = '185';
  const SVG_ICON = `assets/brand-v184.svg?v=${VERSION}`;
  const PNG_ICON = `assets/brand-v184.png?v=${VERSION}`;

  function patchBrandMark() {
    document.querySelectorAll('.brand-mark img').forEach(img => {
      if (img.getAttribute('src') !== SVG_ICON) img.setAttribute('src', SVG_ICON);
    });
  }

  function appendIconLink(rel, href, type, sizes) {
    const link = document.createElement('link');
    link.rel = rel;
    link.href = href;
    if (type) link.type = type;
    if (sizes) link.sizes = sizes;
    document.head.appendChild(link);
  }

  function patchBrowserIcons() {
    if (!document.head) return;

    // Chrome can keep showing the first favicon it parsed even when only href is
    // mutated later. Remove every legacy icon link and append fresh links with a
    // new release URL so the current tab is forced onto the new brand asset.
    document.head
      .querySelectorAll('link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]')
      .forEach(link => link.remove());

    appendIconLink('icon', SVG_ICON, 'image/svg+xml');
    appendIconLink('icon', PNG_ICON, 'image/png', '512x512');
    appendIconLink('shortcut icon', PNG_ICON, 'image/png');
    appendIconLink('apple-touch-icon', PNG_ICON);
  }

  function resolveNativeNotification(current) {
    const ctor = current?.prototype?.constructor;
    return typeof ctor === 'function' && ctor !== current ? ctor : current;
  }

  function patchNotifications() {
    if (!('Notification' in window)) return;
    const current = window.Notification;
    if (!current || current.__workBoardBrandVersion === VERSION) return;

    const NativeNotification = resolveNativeNotification(current);
    if (typeof NativeNotification !== 'function') return;

    function WorkBoardNotification(title, options) {
      const nextOptions = options && typeof options === 'object'
        ? { ...options, icon: PNG_ICON }
        : { icon: PNG_ICON };
      return new NativeNotification(title, nextOptions);
    }

    const requestPermission = NativeNotification.requestPermission || current.requestPermission;
    if (typeof requestPermission === 'function') {
      WorkBoardNotification.requestPermission = requestPermission.bind(NativeNotification);
    }

    Object.defineProperty(WorkBoardNotification, 'permission', {
      configurable: true,
      get() {
        return NativeNotification.permission ?? current.permission;
      }
    });

    WorkBoardNotification.prototype = NativeNotification.prototype;
    Object.defineProperty(WorkBoardNotification, '__workBoardBrandVersion', {
      value: VERSION,
      configurable: false,
      enumerable: false
    });
    window.Notification = WorkBoardNotification;
  }

  function apply() {
    patchBrandMark();
    patchBrowserIcons();
    patchNotifications();
    document.documentElement.dataset.brandVersion = VERSION;
  }

  // Favicon replacement can happen as soon as the dynamic patch is evaluated.
  patchBrowserIcons();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply, { once: true });
  } else {
    apply();
  }

  window.addEventListener('pageshow', apply);
})();
