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
    btn.textContent = dark ? '☀' : '☾';
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
