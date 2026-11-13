import '@testing-library/jest-dom';

if (typeof globalThis.localStorage === 'undefined' || typeof globalThis.localStorage?.clear !== 'function') {
  const store = new Map();
  const memoryStorage = {
    getItem: (key) => (store.has(String(key)) ? store.get(String(key)) : null),
    setItem: (key, value) => { store.set(String(key), String(value)); },
    removeItem: (key) => { store.delete(String(key)); },
    clear: () => { store.clear(); },
    key: (index) => Array.from(store.keys())[index] ?? null,
    get length() { return store.size; },
  };
  Object.defineProperty(globalThis, 'localStorage', {
    value: memoryStorage,
    configurable: true,
    writable: true,
  });
}

// i18next is only initialized as a side effect of importing './i18n' (see
// src/i18n/index.js's top-level i18n.init() call). In the app this happens
// implicitly because src/main.jsx imports it before anything renders, but
// in isolated component tests whether that happens at all depends on
// whether the component under test happens to pull in something that
// imports '../i18n' transitively (e.g. LanguageSwitcher does, most pages
// don't) - so some test files got a fully-translated tree and others got
// raw "namespace.key" strings with a console warning, by accident of
// import order. Initializing it here once, for every test file, makes
// every component under test render real (English, since jsdom has no
// browser language to detect) translated copy deterministically.
import './src/i18n';
