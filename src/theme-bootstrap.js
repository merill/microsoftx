(function () {
  try {
    const saved = localStorage.getItem('microsoftx-theme');
    document.documentElement.dataset.theme = saved === 'light' || saved === 'dark'
      ? saved
      : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  } catch {
    document.documentElement.dataset.theme = 'light';
  }
}());
