// Ver.185: force the refreshed work-board brand into browser tabs, sidebar branding and system notifications.
(function installBrandV185() {
  'use strict';

  const VERSION = '185';
  const SVG_ICON = `assets/brand-v184.svg?v=${VERSION}`;
  const PNG_ICON = `assets/brand-v184.png?v=${VERSION}`;
  const ICON_SELECTOR = 'link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]';
  const EXPECTED_ICONS = [
    { rel: 'icon', href: SVG_ICON, type: 'image/svg+xml', sizes: '' },
    { rel: 'icon', href: PNG_ICON, type: 'image/png', sizes: '512x512' },
    { rel: 'shortcut icon', href: PNG_ICON, type: 'image/png', sizes: '' },
    { rel: 'apple-touch-icon', href: PNG_ICON, type: '', sizes: '' }
  ];

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

  function iconLinkMatches(link, expected) {
    return link.getAttribute('rel') === expected.rel
      && link.getAttribute('href') === expected.href
      && (link.getAttribute('type') || '') === expected.type
      && (link.getAttribute('sizes') || '') === expected.sizes;
  }

  function browserIconsAreCurrent() {
    if (!document.head) return false;
    const links = [...document.head.querySelectorAll(ICON_SELECTOR)];
    if (links.length !== EXPECTED_ICONS.length) return false;
    return EXPECTED_ICONS.every(expected => links.some(link => iconLinkMatches(link, expected)));
  }

  function patchBrowserIcons() {
    if (!document.head || browserIconsAreCurrent()) return;

    // Chrome can keep showing the first favicon it parsed when only href is
    // mutated. Rebuild the set only when an icon is missing, stale or malformed.
    document.head.querySelectorAll(ICON_SELECTOR).forEach(link => link.remove());
    EXPECTED_ICONS.forEach(({ rel, href, type, sizes }) => {
      appendIconLink(rel, href, type, sizes);
    });
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

  // Correct the loader's compatibility favicon as soon as this runtime arrives.
  patchBrowserIcons();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply, { once: true });
  } else {
    apply();
  }

  // BFCache / resume may restore stale browser-level brand state. apply() is
  // idempotent when the current set is already intact and repairs real drift.
  window.addEventListener('pageshow', apply);
})();
