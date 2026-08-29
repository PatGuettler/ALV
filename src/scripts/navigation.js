const PAGE_ROUTES = Object.freeze({
  home: '',
  news: 'news/',
  warrior: 'warrior-retreat/',
  circle: 'av-circle/',
  about: 'about/',
  active: 'av-active/',
  topgolf: 'topgolf/',
  events: 'events/',
  resources: 'resources/',
});

function getBasePath() {
  return document.documentElement.dataset.basePath || '/';
}

function closeMenu() {
  const navigation = document.querySelector('body > nav');
  const menuButton = navigation?.querySelector('.nav-burger');
  navigation?.classList.remove('menu-open');
  menuButton?.setAttribute('aria-expanded', 'false');
}

function showPage(pageId) {
  if (!(pageId in PAGE_ROUTES)) return;

  if (document.documentElement.dataset.page === pageId) {
    closeMenu();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  window.location.assign(`${getBasePath()}${PAGE_ROUTES[pageId]}`);
}

function toggleMenu() {
  const navigation = document.querySelector('body > nav');
  const menuButton = navigation?.querySelector('.nav-burger');
  if (!navigation || !menuButton) return;

  const isOpen = navigation.classList.toggle('menu-open');
  menuButton.setAttribute('aria-expanded', String(isOpen));
}

function toggleFaq(trigger) {
  const item = trigger.closest('.faq-item');
  if (!item) return;

  const wasOpen = item.classList.contains('open');
  document.querySelectorAll('.faq-item.open').forEach((openItem) => {
    openItem.classList.remove('open');
  });
  if (!wasOpen) item.classList.add('open');
}

document.addEventListener('DOMContentLoaded', () => {
  const pageId = document.documentElement.dataset.page;
  const activeItem = document.getElementById(`nb-${pageId}`);
  activeItem?.setAttribute('aria-current', 'page');

  document
    .querySelectorAll('body > nav .nav-links a, body > nav .nav-links button')
    .forEach((control) => {
      control.addEventListener('click', () => closeMenu());
    });
});

window.addEventListener('scroll', () => {
  const ticker = document.getElementById('ticker');
  if (ticker && window.matchMedia('(min-width: 901px)').matches) {
    ticker.style.opacity = window.scrollY > 80 ? '0' : '1';
  }
});

window.showPage = showPage;
window.toggleMenu = toggleMenu;
window.toggleFaq = toggleFaq;
