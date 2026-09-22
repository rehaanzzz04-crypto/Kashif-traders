'use strict';
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(registration => registration.update())
      .catch(error => console.warn('Offline shell setup failed', error));
  }, { once: true });
}
