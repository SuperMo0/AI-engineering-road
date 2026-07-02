/* checklist.js — localStorage-backed clickable checklists.
   Turns any Markdown task list (`- [ ] ...`) rendered inside .lesson-content
   into a clickable, persisted checklist. Used by both lesson and project
   pages so any "Completion checklist" (or similar) works the same way
   everywhere. */

const STORAGE_KEY = 'ai-curriculum-checklists';

function getChecklistState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function setChecklistItem(pageId, itemKey, checked) {
  const state = getChecklistState();
  const page = state[pageId] || {};
  if (checked) {
    page[itemKey] = true;
  } else {
    delete page[itemKey];
  }
  if (Object.keys(page).length) {
    state[pageId] = page;
  } else {
    delete state[pageId];
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/* Initialises every task-list checkbox inside .lesson-content on the page.
   Call with the page's unique id (e.g. "P001") so state doesn't collide
   across pages. */
function initChecklists(pageId) {
  const boxes = document.querySelectorAll('.lesson-content ul li input[type="checkbox"]');
  if (!boxes.length) return;

  const saved = getChecklistState()[pageId] || {};

  boxes.forEach((box) => {
    const li = box.closest('li');
    const list = li.parentElement;
    list.classList.add('checklist');
    li.classList.add('checklist-item');

    const key = li.textContent.trim();
    box.disabled = false;

    if (key in saved) {
      box.checked = saved[key];
    }
    li.classList.toggle('checked', box.checked);

    box.addEventListener('change', () => {
      setChecklistItem(pageId, key, box.checked);
      li.classList.toggle('checked', box.checked);
    });

    li.addEventListener('click', (e) => {
      if (e.target === box) return;
      box.checked = !box.checked;
      box.dispatchEvent(new Event('change'));
    });
  });
}

export { initChecklists };
