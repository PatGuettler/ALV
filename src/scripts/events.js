(function () {
  var AV_EVENTS = [
    {
      date: '2026-06-27',
      title: 'Liberty Day at Magnolia Manor',
      time: '11:00 AM – 2:00 PM',
      loc: 'Magnolia Manor · Columbiana, AL',
      desc: 'Join us for “Salute at the Manor” — a Liberty Day Appreciation Lunch honoring veterans and their families at Magnolia Manor in Columbiana.',
      url: 'https://alabamaveteran.org/event/liberty-day-at-magnolia-manor/',
    },
    {
      date: '2026-07-10',
      title: "Men's Fishing Warrior Retreat",
      time: 'July 10–12 · 12:00 PM Start',
      loc: 'Iron Horse Farms · Marion, AL',
      desc: 'An unforgettable retreat for veterans seeking camaraderie, healing, and the peace of fishing in a stunning natural setting.',
      url: 'https://alabamaveteran.org/event/mens-fishing-warrior-retreat/',
    },
    {
      date: '2026-07-16',
      title: "Men's Warrior Retreat",
      time: 'July 16–19 · 3:00 PM Start',
      loc: 'Soggy Bottom Lodge · Linden, AL',
      desc: 'A four-day retreat guiding veterans through Post-Traumatic Growth with structured programming and peer connection.',
      url: 'https://alabamaveteran.org/event/mens-warrior-retreat/',
    },
    {
      date: '2026-08-13',
      title: "Men's Warrior Retreat",
      time: 'August 13–16 · 3:00 PM Start',
      loc: 'Soggy Bottom Lodge · Linden, AL',
      desc: 'A second session of our signature four-day retreat — same powerful programming, same commitment to healing and PTG.',
      url: 'https://alabamaveteran.org/event/mens-warrior-retreat-2/',
    },
    {
      date: '2026-08-20',
      title: 'Marriage Warrior Retreat',
      time: 'August 20–23 · 5:00 PM Start',
      loc: 'Dream Big · Gulf Shores, AL',
      desc: 'A transformative weekend for veterans, active-duty service members, and first responders with their spouses — to heal, reconnect, and strengthen the bond that has weathered service.',
      url: 'https://alabamaveteran.org/event/alabama-veterans-marriage-warrior-retreat/',
    },
    {
      date: '2026-09-25',
      title: 'Motors on Main',
      time: '5:30 – 8:30 PM',
      loc: 'Historic Downtown Leeds · Leeds, AL',
      desc: 'Powered by Mob Inc. — a community car show featuring exotic, classic, and collectible vehicles in historic downtown Leeds.',
      url: 'https://alabamaveteran.org/event/motors-on-main-powered-by-mob-inc/',
    },
    {
      date: '2026-10-19',
      title: 'War on the Greens – Birmingham',
      time: '7:30 AM – 3:30 PM',
      loc: 'Inverness Country Club · Birmingham, AL',
      desc: 'Great golf, strong community, and a powerful mission. Veterans, supporters, and community leaders gather to honor the sacrifice of those who served.',
      url: 'https://alabamaveteran.org/event/war-on-the-greens-birmingham-2/',
    },
  ];
  var MONTHS = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  var today = new Date();
  var curYear = 2026,
    curMonth = 5;
  function eventsOnDate(y, m, d) {
    var ds = y + '-' + (m < 9 ? '0' + (m + 1) : m + 1) + '-' + (d < 10 ? '0' + d : d);
    return AV_EVENTS.filter(function (e) {
      return e.date === ds;
    });
  }
  function renderCal() {
    document.getElementById('av-cal-month-label').textContent = MONTHS[curMonth] + ' ' + curYear;
    var grid = document.getElementById('av-cal-grid');
    grid.innerHTML = '';
    var first = new Date(curYear, curMonth, 1).getDay();
    var days = new Date(curYear, curMonth + 1, 0).getDate();
    var prevDays = new Date(curYear, curMonth, 0).getDate();
    for (var i = first - 1; i >= 0; i--) {
      var d = document.createElement('div');
      d.className = 'evp-day other-month';
      d.innerHTML = '<div class="evp-day-num">' + (prevDays - i) + '</div>';
      grid.appendChild(d);
    }
    for (var day = 1; day <= days; day++) {
      var evs = eventsOnDate(curYear, curMonth, day);
      var d = document.createElement('div');
      d.className = 'evp-day' + (evs.length ? ' has-event' : '');
      if (
        today.getFullYear() === curYear &&
        today.getMonth() === curMonth &&
        today.getDate() === day
      )
        d.className += ' today';
      d.innerHTML =
        '<div class="evp-day-num">' +
        day +
        '</div>' +
        (evs.length ? '<div class="evp-day-dot"></div>' : '');
      if (evs.length) {
        (function (evList, el) {
          el.addEventListener('click', function () {
            document.querySelectorAll('.evp-day.selected').forEach(function (x) {
              x.classList.remove('selected');
            });
            el.classList.add('selected');
            showDetail(evList[0]);
          });
        })(evs, d);
      }
      grid.appendChild(d);
    }
    var total = first + days;
    var rem = total % 7 === 0 ? 0 : 7 - (total % 7);
    for (var n = 1; n <= rem; n++) {
      var d = document.createElement('div');
      d.className = 'evp-day other-month';
      d.innerHTML = '<div class="evp-day-num">' + n + '</div>';
      grid.appendChild(d);
    }
  }
  function showDetail(ev) {
    document.getElementById('av-ev-detail').innerHTML =
      '<div class="evp-detail-date">' +
      ev.time +
      '</div>' +
      '<div class="evp-detail-title">' +
      ev.title +
      '</div>' +
      '<div class="evp-detail-loc">' +
      ev.loc +
      '</div>' +
      '<p class="evp-detail-desc">' +
      ev.desc +
      '</p>' +
      '<a href="' +
      ev.url +
      '" class="btn-r evp-detail-link" target="_blank" rel="noopener noreferrer" style="font-size:11px;padding:10px 20px">Learn More &amp; Register</a>';
  }
  window._avSetMonth = function (y, m) {
    curYear = y;
    curMonth = m;
    renderCal();
    document.getElementById('av-ev-detail').innerHTML =
      '<div class="evp-detail-empty"><p>Click a highlighted date to see event details.</p></div>';
  };
  window.avCalPrev = function () {
    if (curMonth === 0) {
      curMonth = 11;
      curYear--;
    } else {
      curMonth--;
    }
    renderCal();
    document.getElementById('av-ev-detail').innerHTML =
      '<div class="evp-detail-empty"><p>Click a highlighted date to see event details.</p></div>';
  };
  window.avCalNext = function () {
    if (curMonth === 11) {
      curMonth = 0;
      curYear++;
    } else {
      curMonth++;
    }
    renderCal();
    document.getElementById('av-ev-detail').innerHTML =
      '<div class="evp-detail-empty"><p>Click a highlighted date to see event details.</p></div>';
  };
  window._avRenderCal = renderCal;
  (function () {
    function buildStrip() {
      var strip = document.getElementById('ev-month-strip');
      if (!strip) return;
      var byMonth = {};
      AV_EVENTS.forEach(function (e) {
        var parts = e.date.split('-');
        var key = parts[0] + '-' + parts[1];
        if (!byMonth[key]) byMonth[key] = [];
        byMonth[key].push(e);
      });
      var keys = Object.keys(byMonth).sort();
      keys.forEach(function (key) {
        var parts = key.split('-');
        var yr = parseInt(parts[0]),
          mo = parseInt(parts[1]) - 1;
        var card = document.createElement('div');
        card.className = 'evp-month-card';
        card.onclick = function () {
          window._avCalYear = yr;
          window._avCalMonth = mo;
          if (window._avSetMonth) window._avSetMonth(yr, mo);
          document.getElementById('calendar').scrollIntoView({ behavior: 'smooth' });
        };
        var ul = byMonth[key]
          .map(function (e) {
            var title = e.title.length > 28 ? e.title.slice(0, 26) + '…' : e.title;
            return '<li>' + title + '</li>';
          })
          .join('');
        card.innerHTML =
          '<div class="evp-month-card-month">' +
          MONTHS[mo] +
          ' ' +
          yr +
          '</div><ul class="evp-month-card-events">' +
          ul +
          '</ul>';
        strip.appendChild(card);
      });
    }
    if (document.readyState === 'loading')
      document.addEventListener('DOMContentLoaded', buildStrip);
    else buildStrip();
    window._avBuildStrip = buildStrip;
  })();
  document.addEventListener('DOMContentLoaded', renderCal);
  if (document.readyState !== 'loading') renderCal();
})();
