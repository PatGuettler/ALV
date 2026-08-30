function closeMenu() {
  const navigation = document.querySelector('body > nav');
  const menuButton = navigation?.querySelector('.nav-burger');
  navigation?.classList.remove('menu-open');
  menuButton?.setAttribute('aria-expanded', 'false');
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

window.toggleMenu = toggleMenu;
window.toggleFaq = toggleFaq;
