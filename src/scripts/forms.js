function avSignup(fm) {
  fm.style.display = 'none';
  var w = fm.parentNode;
  var ok = w.querySelector('.su-ok');
  if (ok) ok.style.display = 'block';
  var nt = w.querySelector('.su-note');
  if (nt) nt.style.display = 'none';
  return false;
}
var _cTo = 'info@alabamaveteran.org',
  _cSubj = 'Website Contact from';
function openContact(email, title, subj) {
  _cTo = email || 'info@alabamaveteran.org';
  _cSubj = subj || 'Website Contact from';
  var t = document.getElementById('cm-title');
  if (t) t.textContent = title || 'Contact Alabama Veteran';
  var em = document.getElementById('cm-email');
  if (em) {
    em.textContent = _cTo;
    em.href = 'mailto:' + _cTo;
  }
  document.getElementById('contact-modal').classList.add('open');
}
function closeContact() {
  document.getElementById('contact-modal').classList.remove('open');
}
function sendContact(f) {
  var subj = encodeURIComponent(_cSubj + ' ' + f.cname.value);
  var body = encodeURIComponent(
    'From: ' + f.cname.value + ' (' + f.cemail.value + ')\n\n' + f.cmsg.value,
  );
  window.location.href = 'mailto:' + _cTo + '?subject=' + subj + '&body=' + body;
  return false;
}
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') closeContact();
});
