import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Monotonic id so multiple pop-outs (e.g. Settings + Categories) never collide
// on the window name — reusing a name would target the same OS window.
let popoutSeq = 0;

/**
 * Renders `children` into a real, separate browser window (via window.open +
 * React portal). Because it's a portal, the popped-out content stays part of
 * the same React tree — its state is shared with the opener, so toggling a
 * setting in the detached window updates the main calendar live, and vice
 * versa. Verified: React 19 delivers synthetic events across the window
 * boundary, so clicks/inputs inside the pop-out work normally.
 *
 * Styling: the app's stylesheets are cloned into the new window and the
 * dark/theme state (classes on the app root + CSS custom properties on <html>)
 * is mirrored and kept in sync via a MutationObserver, so the pop-out matches
 * the app's current appearance — including live theme/dark-mode changes.
 */
export default function PopoutWindow({
  title = 'PLS Calendar',
  width = 460,
  height = 820,
  onClose,
  children,
}) {
  const [container, setContainer] = useState(null);
  // Keep the latest onClose without re-running the open effect.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const name = `pls-popout-${++popoutSeq}`;
    // Roughly center the new window over the opener.
    const left = Math.round(window.screenX + Math.max(0, (window.outerWidth - width) / 2));
    const top = Math.round(window.screenY + Math.max(0, (window.outerHeight - height) / 3));
    const features = `popup=yes,width=${width},height=${height},left=${left},top=${top}`;
    const win = window.open('', name, features);

    if (!win) {
      // Popup blocked by the browser — bail back to the docked view.
      console.warn('[PopoutWindow] window.open was blocked');
      onCloseRef.current?.();
      return;
    }

    const doc = win.document;
    doc.title = title;

    // Resolve relative asset/font URLs (cloned inline styles) against the opener.
    const base = doc.createElement('base');
    base.href = document.baseURI;
    doc.head.appendChild(base);

    const charset = doc.createElement('meta');
    charset.setAttribute('charset', 'utf-8');
    doc.head.appendChild(charset);

    const viewport = doc.createElement('meta');
    viewport.name = 'viewport';
    viewport.content = 'width=device-width, initial-scale=1, viewport-fit=cover';
    doc.head.appendChild(viewport);

    // Clone the app's styles. Vite injects <style> tags in dev; a production
    // build links a compiled stylesheet. Links are recreated with their fully
    // resolved (absolute) href so they load in the about:blank document.
    document.querySelectorAll('style, link[rel="stylesheet"]').forEach(node => {
      try {
        if (node.tagName === 'LINK') {
          const link = doc.createElement('link');
          link.rel = 'stylesheet';
          link.href = node.href;
          if (node.media) link.media = node.media;
          doc.head.appendChild(link);
        } else {
          doc.head.appendChild(node.cloneNode(true));
        }
      } catch { /* ignore a style we can't clone */ }
    });

    doc.body.style.margin = '0';

    const wrapper = doc.createElement('div');
    wrapper.setAttribute('data-popout-root', '');
    doc.body.appendChild(wrapper);

    syncAppearance(doc, wrapper);
    setContainer(wrapper);

    // Mirror live appearance changes (dark mode, theme colors, custom font).
    const appRoot = document.querySelector('[data-app-root]');
    const observer = new MutationObserver(() => syncAppearance(doc, wrapper));
    if (appRoot) observer.observe(appRoot, { attributes: true, attributeFilter: ['class', 'style'] });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class'] });

    // The window can be closed by the OS chrome, which fires no React event —
    // poll for it so we can reset the opener's state.
    const poll = setInterval(() => {
      if (win.closed) { cleanup(); onCloseRef.current?.(); }
    }, 400);
    // If the opener navigates away, take the pop-out with it.
    const closePopout = () => { try { win.close(); } catch { /* already gone */ } };
    window.addEventListener('beforeunload', closePopout);

    let cleanedUp = false;
    function cleanup() {
      if (cleanedUp) return;
      cleanedUp = true;
      clearInterval(poll);
      observer.disconnect();
      window.removeEventListener('beforeunload', closePopout);
    }

    return () => {
      cleanup();
      closePopout();
    };
    // Open exactly once per mount; width/height/title are read at open time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!container) return null;
  return createPortal(children, container);
}

// Copy the opener's dark/theme state into the pop-out so it looks identical.
function syncAppearance(doc, wrapper) {
  const appRoot = document.querySelector('[data-app-root]');
  // `has-app-bg` expects the <AppBackground> layer behind it (which the pop-out
  // doesn't render), so drop it to avoid a see-through panel.
  const cls = (appRoot?.className || '').replace(/\bhas-app-bg\b/g, '').trim();
  wrapper.className = cls;
  wrapper.style.cssText = appRoot?.style.cssText || '';
  wrapper.style.minHeight = '100vh';

  // Theme presets set --color-* / --lc-font custom properties on <html>.
  try { doc.documentElement.style.cssText = document.documentElement.style.cssText; } catch { /* noop */ }

  const isDark = appRoot
    ? appRoot.classList.contains('dark')
    : document.documentElement.classList.contains('dark');
  doc.documentElement.classList.toggle('dark', isDark);
  doc.body.style.backgroundColor = isDark ? '#0b0f19' : '#ffffff';
}
