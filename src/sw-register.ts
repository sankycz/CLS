// Registrace service workeru. Novou verzi nenačítáme automaticky – reload uprostřed ošetření by rušil.

const listeners = new Set<() => void>();
let waiting: ServiceWorker | null = null;

const announce = (worker: ServiceWorker | null) => {
  if (!worker) return;
  waiting = worker;
  listeners.forEach((listener) => listener());
};

export const registerServiceWorker = (): void => {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').then((registration) => {
      if (registration.waiting && navigator.serviceWorker.controller) announce(registration.waiting);
      registration.addEventListener('updatefound', () => {
        const installing = registration.installing;
        installing?.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) announce(installing);
        });
      });
    });
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
  });
};

export const onServiceWorkerUpdate = (listener: () => void): (() => void) => {
  listeners.add(listener);
  if (waiting) listener();
  return () => listeners.delete(listener);
};

export const applyServiceWorkerUpdate = (): void => {
  waiting?.postMessage({ type: 'SKIP_WAITING' });
};
