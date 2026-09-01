export function applicationPayloadFromFormData(data) {
  return {
    fullName: String(data.get('fullName') || ''),
    email: String(data.get('email') || ''),
    phone: String(data.get('phone') || ''),
    program: String(data.get('program') || ''),
    message: String(data.get('message') || ''),
    consent: data.get('consent') === 'on',
  };
}

if (typeof document !== 'undefined') {
  const form = document.getElementById('retreat-application-form');
  const status = document.getElementById('retreat-application-status');
  const apiUrl = window.__RETREAT_API_URL__;

  if (!(form instanceof HTMLFormElement) || !(status instanceof HTMLElement) || !apiUrl) {
    throw new Error('Retreat application form is not connected.');
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    status.textContent = 'Sending…';
    const payload = applicationPayloadFromFormData(new FormData(form));

    try {
      const response = await fetch(`${apiUrl}/v1/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        status.textContent =
          'The application could not be sent. Check the required fields and try again.';
        return;
      }
      form.reset();
      status.textContent = 'Application received. A staff member will follow up by email.';
    } catch {
      status.textContent =
        'The application service could not be reached. Try again in a few minutes.';
    }
  });
}
