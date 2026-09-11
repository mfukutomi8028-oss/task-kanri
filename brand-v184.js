// Ver.184: modern work-board brand mark for sidebar, browser icons and system notifications.
(function installBrandV184() {
  'use strict';

  const VERSION = '184';
  const SVG_ICON = `assets/brand-v184.svg?v=${VERSION}`;
  const PNG_ICON = `assets/brand-v184.png?v=${VERSION}`;

  function patchBrandMark() {
    document.querySelectorAll('.brand-mark img').forEach(img => {
      if (img.getAttribute('src') !== SVG_ICON) img.setAttribute('src', SVG_ICON);
    });
  }

  function patchBrowserIcons() {
    document.querySelectorAll('link[rel~="icon"], link[rel="shortcut icon"]').forEach(link => {
      link.setAttribute('href', PNG_ICON);
      link.setAttribute('type', 'image/png');
    });
    document.querySelectorAll('link[rel="apple-touch-icon"]').forEach(link => {
      link.setAttribute('href', PNG_ICON);
    });
  }

  function resolveNativeNotification(current) {
    const ctor = current?.prototype?.constructor;
    return typeof ctor === 'function' && ctor !== current ? ctor : current;
  }

  function patchNotifications() {
    if (!("Notification" in window)) return;
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply, { once: true });
  } else {
    apply();
  }
  window.addEventListener('pageshow', apply);
})();
