function showPanel(n, b) {
  document.querySelectorAll('.tier-panel').forEach((p) => p.classList.remove('active'));
  document.querySelectorAll('.tbtn').forEach((x) => x.classList.remove('active'));
  document.getElementById('panel-' + n)?.classList.add('active');
  if (b) b.classList.add('active');
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-panel]').forEach((button) => {
    button.addEventListener('click', () => showPanel(button.dataset.panel, button));
  });
});
