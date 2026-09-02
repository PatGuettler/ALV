export function contactMailtoHref({ name, email, message, contact }) {
  const subject = encodeURIComponent(`${contact.subject} ${name}`);
  const body = encodeURIComponent(`From: ${name} (${email})\n\n${message}`);
  return `mailto:${contact.email}?subject=${subject}&body=${body}`;
}

export function shouldOpenSubscribeModal(hash) {
  return hash === '#subscribe' || hash === '#footer-signup';
}

const defaultContact = {
  email: 'info@alabamaveteran.org',
  title: 'Contact Alabama Veteran',
  subject: 'Website Contact from',
};

let currentContact = { ...defaultContact };
let previousFocus = null;

function isModalOpen(id) {
  return Boolean(document.getElementById(id)?.classList.contains('open'));
}

function lockBody() {
  document.body.classList.add('modal-open');
}

function unlockBody() {
  if (!isModalOpen('contact-modal') && !isModalOpen('subscribe-modal')) {
    document.body.classList.remove('modal-open');
  }
}

function openContact(trigger) {
  const modal = document.getElementById('contact-modal');
  if (!modal) return;

  currentContact = {
    email: trigger.dataset.contactEmail || defaultContact.email,
    title: trigger.dataset.contactTitle || defaultContact.title,
    subject: trigger.dataset.contactSubject || defaultContact.subject,
  };

  const title = document.getElementById('cm-title');
  const email = document.getElementById('cm-email');
  if (title) title.textContent = currentContact.title;
  if (email) {
    email.textContent = currentContact.email;
    email.href = `mailto:${currentContact.email}`;
  }

  previousFocus = document.activeElement;
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  lockBody();
  modal.querySelector('input')?.focus();
}

function closeContact() {
  const modal = document.getElementById('contact-modal');
  if (!modal?.classList.contains('open')) return;

  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  unlockBody();
  previousFocus?.focus?.();
}

function openSubscribe(trigger) {
  const modal = document.getElementById('subscribe-modal');
  const iframe = document.getElementById('subscribe-embed');
  if (!modal || !(iframe instanceof HTMLIFrameElement)) return;

  const src = iframe.getAttribute('data-src');
  if (src && iframe.getAttribute('src') !== src) iframe.src = src;

  previousFocus = trigger instanceof HTMLElement ? trigger : document.activeElement;
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  lockBody();
  modal.querySelector('[data-subscribe-close]')?.focus();
}

function closeSubscribe() {
  const modal = document.getElementById('subscribe-modal');
  if (!modal?.classList.contains('open')) return;

  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  unlockBody();
  previousFocus?.focus?.();
}

function sendContact(form) {
  const data = new FormData(form);
  const name = String(data.get('cname') || '');
  const email = String(data.get('cemail') || '');
  const message = String(data.get('cmsg') || '');
  window.location.href = contactMailtoHref({
    name,
    email,
    message,
    contact: currentContact,
  });
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-contact]').forEach((trigger) => {
      trigger.addEventListener('click', (event) => {
        event.preventDefault();
        openContact(trigger);
      });
    });

    document.querySelectorAll('[data-subscribe]').forEach((trigger) => {
      trigger.addEventListener('click', (event) => {
        event.preventDefault();
        openSubscribe(trigger);
      });
    });

    document.querySelector('[data-contact-close]')?.addEventListener('click', closeContact);
    document.querySelector('[data-contact-overlay]')?.addEventListener('click', (event) => {
      if (event.target === event.currentTarget) closeContact();
    });
    document.querySelector('[data-contact-form]')?.addEventListener('submit', (event) => {
      event.preventDefault();
      sendContact(event.currentTarget);
    });

    document.querySelector('[data-subscribe-close]')?.addEventListener('click', closeSubscribe);
    document.querySelector('[data-subscribe-overlay]')?.addEventListener('click', (event) => {
      if (event.target === event.currentTarget) closeSubscribe();
    });

    if (shouldOpenSubscribeModal(window.location.hash)) openSubscribe();
  });

  window.addEventListener('hashchange', () => {
    if (shouldOpenSubscribeModal(window.location.hash)) openSubscribe();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (isModalOpen('subscribe-modal')) closeSubscribe();
    else closeContact();
  });
}
