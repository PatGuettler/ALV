export function contactMailtoHref({ name, email, message, contact }) {
  const subject = encodeURIComponent(`${contact.subject} ${name}`);
  const body = encodeURIComponent(`From: ${name} (${email})\n\n${message}`);
  return `mailto:${contact.email}?subject=${subject}&body=${body}`;
}

const defaultContact = {
  email: 'info@alabamaveteran.org',
  title: 'Contact Alabama Veteran',
  subject: 'Website Contact from',
};

let currentContact = { ...defaultContact };
let previousFocus = null;

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
  modal.querySelector('input')?.focus();
}

function closeContact() {
  const modal = document.getElementById('contact-modal');
  if (!modal?.classList.contains('open')) return;

  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
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

    document.querySelector('[data-contact-close]')?.addEventListener('click', closeContact);
    document.querySelector('[data-contact-overlay]')?.addEventListener('click', (event) => {
      if (event.target === event.currentTarget) closeContact();
    });
    document.querySelector('[data-contact-form]')?.addEventListener('submit', (event) => {
      event.preventDefault();
      sendContact(event.currentTarget);
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeContact();
  });
}
