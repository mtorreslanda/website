// nav background + reveal on scroll. Content is fully visible without this script.
(function () {
  var doc = document.documentElement;
  doc.classList.add('js');
  var nav = document.querySelector('.nav');
  function onScroll() { if (nav) nav.classList.toggle('solid', window.scrollY > 40); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  var items = document.querySelectorAll('.rv');
  if (!('IntersectionObserver' in window)) { items.forEach(function (el) { el.classList.add('in'); }); return; }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -8% 0px' });
  items.forEach(function (el) { io.observe(el); });
  // safety: never leave anything hidden
  setTimeout(function () { items.forEach(function (el) { el.classList.add('in'); }); }, 4000);
})();
