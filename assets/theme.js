/* theme.js — dark/light toggle with localStorage persistence.
   Apply the saved theme before first paint by loading this in <head>:
     <script type="module" src="../assets/theme.js"></script>
   Then call initThemeToggle() after the DOM is ready. */

const STORAGE_KEY = 'ai-curriculum-theme';

function applyTheme(dark) {
  document.documentElement.classList.toggle('dark', dark);
  window.dispatchEvent(new CustomEvent('theme-change', { detail: { dark } }));
}

/* Apply immediately on load to avoid flash of wrong theme. */
applyTheme(localStorage.getItem(STORAGE_KEY) === 'dark');

function initThemeToggle() {
  const btn = document.createElement('button');
  btn.className = 'theme-toggle';
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Toggle dark mode');
  document.body.appendChild(btn);

  function render() {
    const dark = document.documentElement.classList.contains('dark');
    btn.innerHTML = dark
      ? `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="3.5" stroke="currentColor" stroke-width="1.5"/><path d="M8 1.5V3M8 13V14.5M1.5 8H3M13 8h1.5M3.64 3.64l1.06 1.06M11.3 11.3l1.06 1.06M3.64 12.36l1.06-1.06M11.3 4.7l1.06-1.06" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`
      : `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M14 10.5A6.5 6.5 0 015.5 2a6.5 6.5 0 108.5 8.5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    btn.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
  }

  btn.addEventListener('click', () => {
    const dark = !document.documentElement.classList.contains('dark');
    applyTheme(dark);
    localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light');
    render();
  });

  render();
}

export { initThemeToggle };
