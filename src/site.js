(function () {
  'use strict';

  const THEME_KEY = 'microsoftx-theme';
  const root = document.documentElement;

  function preferredTheme() {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {}
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function setTheme(theme) {
    root.dataset.theme = theme;
    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
      button.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`);
      button.setAttribute('title', `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`);
    });
  }

  setTheme(preferredTheme());
  document.querySelectorAll('[data-theme-toggle]').forEach(button => button.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(THEME_KEY, next); } catch {}
    setTheme(next);
  }));

  const menuButton = document.querySelector('[data-menu-toggle]');
  const menu = document.querySelector('[data-site-nav]');
  menuButton?.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!open));
    menu?.classList.toggle('open', !open);
  });

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
    menuButton?.setAttribute('aria-expanded', 'false');
    menu?.classList.remove('open');
  });
}());
