/* The robot seen from the side, facing right, on the same 16 x 17 grid as robot.js.
   For running, walking, carrying and diving. Colours: x ink, a accent, e eye, k mask grey, s helmet shell,
   d helmet shadow, h ear hole, b ball, l lace. */
(function () {
  'use strict';
  function side(o) {
    o = o || {};
    var g = {};
    function set(x, y, c) { g[x + ',' + y] = { x: x, y: y, c: c }; }
    function row(y, x0, x1, c) { for (var x = x0; x <= x1; x++) set(x, y, c); }
    var X = 'x';
    // head (profile)
    row(3, 6, 10, X); row(4, 5, 11, X); row(5, 5, 11, X); row(6, 5, 11, X); row(7, 6, 10, X);
    set(o.lookBack ? 6 : 10, 5, o.blink ? X : 'e');
    if (o.helmet) {
      row(1, 6, 9, 's'); row(2, 5, 10, 's'); row(3, 4, 10, 's'); row(4, 4, 6, 's'); row(5, 4, 5, 's'); set(4, 6, 'd');
      set(7, 4, 'h'); set(8, 1, 'd');
      set(12, 5, 'k'); set(12, 6, 'k'); set(12, 7, 'k'); set(11, 7, 'k');            // face mask in front
    }
    set(8, 8, X);                                                                    // neck
    for (var y = 9; y <= 13; y++) row(y, 6, 10, X);                                  // body
    set(9, 10, 'a'); set(10, 10, 'a'); set(9, 11, 'a'); set(10, 11, 'a');           // chest panel, on the front
    // arms
    var arm = o.arm || 'swing0';
    if (arm === 'swing0') { set(11, 10, X); set(12, 11, X); set(12, 12, 'a'); set(5, 10, X); set(4, 11, X); set(4, 12, X); }
    if (arm === 'swing1') { set(5, 10, X); set(4, 11, X); set(3, 12, 'a'); set(11, 10, X); set(12, 11, X); }
    // both arms high above the helmet, waving for the ball (two frames, hands swaying out and in)
    if (arm === 'up0') { set(11, 9, X); set(12, 8, X); set(13, 7, X); set(13, 6, X); set(13, 5, X); set(13, 4, X); set(13, 3, 'a');
                         set(5, 9, X); set(4, 8, X); set(3, 7, X); set(3, 6, X); set(3, 5, X); set(3, 4, X); set(3, 3, 'a'); }
    if (arm === 'up1') { set(11, 9, X); set(12, 8, X); set(13, 7, X); set(13, 6, X); set(14, 5, X); set(14, 4, X); set(15, 3, 'a');
                         set(5, 9, X); set(4, 8, X); set(3, 7, X); set(3, 6, X); set(2, 5, X); set(2, 4, X); set(1, 3, 'a'); }
    if (arm === 'forward') { set(11, 10, X); set(12, 10, X); set(13, 10, X); set(14, 10, 'a'); set(11, 11, X); set(12, 11, X); set(13, 11, 'a'); }
    if (arm === 'tuck') { set(11, 10, X); set(11, 11, X); set(10, 12, X); set(5, 10, X); set(4, 11, X); set(4, 12, X);
                          set(11, 9, 'b'); set(12, 9, 'b'); set(12, 10, 'b'); set(13, 10, 'b'); set(12, 11, 'b'); set(12, 10, 'l'); }
    if (arm === 'stiff') { set(11, 10, X); set(11, 11, X); set(10, 12, X); set(11, 9, 'b'); set(12, 9, 'b'); set(12, 10, 'b'); set(12, 11, 'b');
                           set(12, 10, 'l'); set(5, 10, X); set(4, 10, X); set(3, 10, X); set(2, 10, 'a'); }
    // legs: 0 = stride, 1 = passing with a knee up, 2 = standing
    var leg = o.leg === undefined ? 2 : o.leg;
    if (leg === 0) { set(9, 14, X); set(10, 15, X); set(11, 16, X); set(12, 16, X); set(7, 14, X); set(6, 15, X); set(5, 16, X); set(4, 16, X); }
    if (leg === 1) { set(7, 14, X); set(7, 15, X); set(6, 16, X); set(7, 16, X); set(8, 16, X); set(9, 14, X); set(10, 14, X); set(10, 15, X); }
    // 3 = hurdle: lead leg straight out in front, trail leg folded behind
    if (leg === 3) { set(9, 14, X); set(10, 14, X); set(11, 14, X); set(12, 14, X); set(13, 13, X); set(14, 13, X);
                     set(7, 14, X); set(6, 15, X); set(5, 15, X); set(4, 14, X); set(4, 13, X); }
    if (leg === 2) { set(7, 14, X); set(9, 14, X); set(7, 15, X); set(9, 15, X); set(6, 16, X); set(7, 16, X); set(9, 16, X); set(10, 16, X); }
    return Object.keys(g).map(function (k) { return g[k]; });
  }
  window.RobotSide = { cells: side };
})();
