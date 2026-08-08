(function () {
  'use strict';

  const THEME_KEY = 'microsoftx-theme';
  const GITHUB_TOKEN_STORAGE_KEY = 'microsoftx-github-token';
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

  const githubTokenDrawer = document.querySelector('[data-github-token-drawer]');
  const githubTokenBackdrop = document.querySelector('[data-github-token-backdrop]');
  const githubTokenInput = document.querySelector('[data-github-token-input]');
  const githubTokenStatus = document.querySelector('[data-github-token-status]');
  const githubTokenAlert = document.querySelector('[data-github-token-alert]');
  let githubTokenReturnFocus = null;

  function storedGithubToken() {
    try { return localStorage.getItem(GITHUB_TOKEN_STORAGE_KEY) || ''; } catch { return ''; }
  }

  function syncGithubTokenDrawer() {
    if (!githubTokenInput) return;
    const value = storedGithubToken();
    githubTokenInput.value = value;
    const forget = document.querySelector('[data-github-token-forget]');
    if (forget) forget.hidden = !value;
  }

  function openGithubTokenDrawer(options = {}) {
    if (!githubTokenDrawer) return;
    githubTokenReturnFocus = document.activeElement;
    syncGithubTokenDrawer();
    if (githubTokenStatus) githubTokenStatus.textContent = '';
    if (githubTokenAlert) {
      githubTokenAlert.hidden = !options.message;
      const title = githubTokenAlert.querySelector('strong');
      const detail = githubTokenAlert.querySelector('p');
      if (title) title.textContent = options.invalid ? 'GitHub rejected the saved token' : 'GitHub’s API limit was reached';
      if (detail && options.message) detail.textContent = options.message;
    }
    githubTokenDrawer.hidden = false;
    githubTokenBackdrop.hidden = false;
    githubTokenDrawer.scrollTop = 0;
    document.body.classList.add('token-drawer-open');
    document.querySelectorAll('[data-github-token-open]').forEach(button => button.setAttribute('aria-expanded', 'true'));
    setTimeout(() => {
      githubTokenDrawer.scrollTop = 0;
      githubTokenDrawer.querySelector('[data-github-token-close]')?.focus({ preventScroll: true });
    }, 0);
  }

  function closeGithubTokenDrawer() {
    if (!githubTokenDrawer || githubTokenDrawer.hidden) return;
    githubTokenDrawer.hidden = true;
    githubTokenBackdrop.hidden = true;
    document.body.classList.remove('token-drawer-open');
    document.querySelectorAll('[data-github-token-open]').forEach(button => button.setAttribute('aria-expanded', 'false'));
    githubTokenReturnFocus?.focus?.();
    githubTokenReturnFocus = null;
  }

  document.querySelectorAll('[data-github-token-open]').forEach(button => button.addEventListener('click', () => openGithubTokenDrawer()));
  document.querySelectorAll('[data-github-token-close]').forEach(button => button.addEventListener('click', closeGithubTokenDrawer));
  githubTokenBackdrop?.addEventListener('click', closeGithubTokenDrawer);
  document.querySelector('[data-github-token-save]')?.addEventListener('click', () => {
    const value = githubTokenInput.value.trim();
    if (!value) {
      githubTokenStatus.textContent = 'Paste a GitHub token before saving.';
      githubTokenInput.focus();
      return;
    }
    try { localStorage.setItem(GITHUB_TOKEN_STORAGE_KEY, value); } catch {
      githubTokenStatus.textContent = 'This browser did not allow the token to be saved.';
      return;
    }
    githubTokenStatus.textContent = 'Token saved in this browser.';
    syncGithubTokenDrawer();
    document.dispatchEvent(new CustomEvent('github-token-changed', { detail: { hasToken: true } }));
    setTimeout(closeGithubTokenDrawer, 250);
  });
  document.querySelector('[data-github-token-forget]')?.addEventListener('click', () => {
    try { localStorage.removeItem(GITHUB_TOKEN_STORAGE_KEY); } catch {}
    syncGithubTokenDrawer();
    githubTokenStatus.textContent = 'Saved GitHub token removed from this browser.';
    document.dispatchEvent(new CustomEvent('github-token-changed', { detail: { hasToken: false } }));
  });
  document.addEventListener('github-token-required', event => openGithubTokenDrawer({
    message: event.detail?.message,
    invalid: event.detail?.invalid
  }));

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !githubTokenDrawer?.hidden) {
      event.preventDefault();
      closeGithubTokenDrawer();
      return;
    }
    if (event.key === 'Escape') {
      menuButton?.setAttribute('aria-expanded', 'false');
      menu?.classList.remove('open');
      return;
    }
    if (event.key !== 'Tab' || githubTokenDrawer?.hidden) return;
    const focusable = [...githubTokenDrawer.querySelectorAll('a[href],button:not([disabled]):not([hidden]),input:not([disabled])')];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
}());
