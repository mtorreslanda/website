/* Project pages: steps of "How it works" light up as they cross the middle of the screen, and the
   figure beside them changes to that step's image. */
(function () {
  'use strict';
  var steps = document.querySelectorAll('.p-steps li'), img = document.querySelector('[data-how-img]');
  var cap = document.querySelector('[data-how-cap]'), num = document.querySelector('[data-how-n]');
  if (!steps.length || !img || !('IntersectionObserver' in window)) return;
  steps.forEach(function (li) { var i = new Image(); i.src = '../assets/img/' + li.dataset.img; });   // preload
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      steps.forEach(function (s) { s.classList.toggle('on', s === e.target); });
      var src = '../assets/img/' + e.target.dataset.img;
      if (img.getAttribute('src') === src) return;
      img.style.opacity = 0;
      setTimeout(function () {
        img.src = src; cap.textContent = e.target.querySelector('h3').textContent;
        num.textContent = 'Fig. ' + (3 + Array.prototype.indexOf.call(steps, e.target)); img.style.opacity = 1;
      }, 200);
    });
  }, { rootMargin: '-45% 0px -45% 0px' });
  steps.forEach(function (s) { io.observe(s); });
  steps[0].classList.add('on');
})();
