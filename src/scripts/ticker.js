(function () {
  var AV_FUNDRAISERS = [
    {
      date: '2026-10-19',
      label: 'War on the Greens — Birmingham',
      detail: 'Oct 19 @ 7:30 AM · Inverness CC, Birmingham AL',
      url: 'https://onecau.se/wog',
    },
  ];
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var next = AV_FUNDRAISERS.filter(function (f) {
    return new Date(f.date + 'T00:00:00') >= today;
  }).sort(function (a, b) {
    return a.date > b.date ? 1 : -1;
  })[0];
  var t = document.getElementById('ticker');
  if (t && next) {
    t.innerHTML =
      '★ UPCOMING: ' +
      next.detail +
      ' — ' +
      next.label +
      '&nbsp;&nbsp;<a href="' +
      next.url +
      '" target="_blank" rel="noopener noreferrer">MORE INFO →</a>';
  } else if (t) {
    t.style.display = 'none';
  }
})();
