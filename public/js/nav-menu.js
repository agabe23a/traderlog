(() => {
  'use strict';
  const toggle = document.getElementById('tlMenuToggle');
  const menu = document.getElementById('tlMenu');
  const overlay = document.getElementById('tlMenuOverlay');
  const close = document.getElementById('tlMenuClose');
  if (!toggle || !menu || !overlay) return;

  let savedScrollY = 0;

  const setOpen = (open) => {
    if (open) {
      savedScrollY = window.scrollY || window.pageYOffset || 0;
      document.documentElement.classList.add('tl-menu-open');
      document.body.classList.add('tl-menu-open');
      document.body.style.top = `-${savedScrollY}px`;
    } else {
      document.documentElement.classList.remove('tl-menu-open');
      document.body.classList.remove('tl-menu-open');
      document.body.style.top = '';
      window.scrollTo(0, savedScrollY);
    }
    toggle.classList.toggle('is-active', open);
    toggle.setAttribute('aria-expanded', String(open));
    menu.classList.toggle('is-open', open);
    menu.setAttribute('aria-hidden', String(!open));
    overlay.hidden = !open;
  };

  toggle.addEventListener('click', () => setOpen(!menu.classList.contains('is-open')));
  close?.addEventListener('click', () => setOpen(false));
  overlay.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
  menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
})();
