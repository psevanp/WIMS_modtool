/*! G6quad — outil interactif G6 (WIMS).  https://github.com/psevanp/WIMS_modtool
   Quadrilatere deformable pilote par les CODAGES : l'eleve glisse un/des point(s)
   pour tester si la figure PEUT devenir un rectangle / un carre / un losange,
   les codages restant toujours vrais.
   Usage WIMS :
     <div id="g6t"></div>
     <script src="https://cdn.jsdelivr.net/gh/psevanp/WIMS_modtool@main/g6quad.js"></script>
     <script>G6quad("g6t",{type:"oppra",ask:"rectangle"})</script>

   cfg.type : "para" | "rhomb" | "rtri" | "oppra" | "oppeq" | "chain3"
     para   : cotes opposes egaux (cfg.a,cfg.b ; cfg.cm=true => affiche les mesures, sinon marques)
     rhomb  : 4 cotes egaux (= para avec a===b) ; cfg.cm pour les mesures
     rtri   : angles droits codes ; cfg.ra=2 (2 points) ou 3 (1 point)
     oppra  : 2 angles droits OPPOSES (A et C) ; on bouge B et C, D = intersection
     oppeq  : AB et CD de meme mesure ; A,B fixes, on bouge C et D (|CD|=|AB|)
     chain3 : AB,BC,CD de meme mesure ; A,B fixes, on bouge C puis D
   cfg.ask     : "rectangle" | "carre" | "losange"
   cfg.verdict : false => cache le cadre-verdict (indication) ; true/absent (feedback)
   cfg.hint    : false => cache la phrase d'aide integree */
(function () {
  if (window.G6quad) return;
  var GY = '#6b7280', GRN = '#15803d', OR = '#ea7317', INK = '#1f2632';
  var CSS =
    '.g6q{font-family:ui-sans-serif,system-ui,"Segoe UI",Roboto,Arial,sans-serif;max-width:420px;color:#1f2632}'
    + '.g6q-stage{background:#f7f6f3;border:1px solid #e2ddd3;border-radius:10px;padding:4px;touch-action:none}'
    + '.g6q-stage svg{display:block;width:100%;height:auto}'
    + '.g6q-v{display:flex;align-items:center;gap:8px;margin-top:8px;border:1px solid #e2ddd3;border-radius:9px;'
    + 'padding:9px 12px;font-size:14px;font-weight:600;color:#6b7280;background:#f7f6f3;transition:background .15s,color .15s,border-color .15s}'
    + '.g6q-v.win{background:#eaf5ea;border-color:#15803d;color:#15803d}'
    + '.g6q-v.mid{background:#fff7e6;border-color:#c98a1a;color:#a86a12}'
    + '.g6q-v .d{width:8px;height:8px;border-radius:50%;background:currentColor;flex:0 0 auto}'
    + '.g6q-h{font-size:13px;color:#6b7280;margin:7px 2px 0;line-height:1.5}'
    + '.g6q-pin{cursor:grab}.g6q-pin:active{cursor:grabbing}';
  function inject() { if (document.getElementById('g6q-css')) return;
    var s = document.createElement('style'); s.id = 'g6q-css'; s.textContent = CSS; document.head.appendChild(s); }

  // ---- geometrie utilitaire
  function unit(f, t) { var dx = t.x - f.x, dy = t.y - f.y, l = Math.hypot(dx, dy) || 1; return { x: dx / l, y: dy / l }; }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function angAt(P, i) { var o = P[i], u = unit(o, P[(i + 3) % 4]), v = unit(o, P[(i + 1) % 4]);
    return Math.acos(Math.max(-1, Math.min(1, u.x * v.x + u.y * v.y))) * 180 / Math.PI; }
  function classify(P) {
    var s = [dist(P[0], P[1]), dist(P[1], P[2]), dist(P[2], P[3]), dist(P[3], P[0])];
    var isRect = true; for (var i = 0; i < 4; i++) if (Math.abs(angAt(P, i) - 90) > 4) isRect = false;
    var mx = Math.max(s[0], s[1], s[2], s[3]), mn = Math.min(s[0], s[1], s[2], s[3]);
    var isRh = (mx - mn) < 8;
    return { isRect: isRect, isRhombus: isRh, isSquare: isRect && isRh };
  }
  // intersection cercles (rayon r autour de P0 et P1), point le plus proche de 'near'
  function circInt(P0, P1, r, near) {
    var dx = P1.x - P0.x, dy = P1.y - P0.y, d = Math.hypot(dx, dy);
    if (d > 2 * r || d < 1e-6) return null;
    var a = d / 2, h = Math.sqrt(Math.max(0, r * r - a * a)), mx = P0.x + dx / 2, my = P0.y + dy / 2, ux = -dy / d, uy = dx / d;
    var s1 = { x: mx + ux * h, y: my + uy * h }, s2 = { x: mx - ux * h, y: my - uy * h };
    return dist(s1, near) < dist(s2, near) ? s1 : s2;
  }
  function convex(P) { var sg = 0; for (var i = 0; i < 4; i++) { var a = P[i], b = P[(i + 1) % 4], c = P[(i + 2) % 4];
    var z = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x), s = z > 0 ? 1 : -1; if (i === 0) sg = s; else if (s !== sg) return false; } return true; }

  // ---- marques SVG
  function raMk(P, i, col) { var o = P[i], u = unit(o, P[(i + 3) % 4]), v = unit(o, P[(i + 1) % 4]), m = 13;
    return '<path d="M' + (o.x + u.x * m).toFixed(1) + ' ' + (o.y + u.y * m).toFixed(1) + ' L' + (o.x + (u.x + v.x) * m).toFixed(1)
      + ' ' + (o.y + (u.y + v.y) * m).toFixed(1) + ' L' + (o.x + v.x * m).toFixed(1) + ' ' + (o.y + v.y * m).toFixed(1)
      + '" fill="none" stroke="' + col + '" stroke-width="2.2"/>'; }
  function tick(P, i, count, col) { var a = P[i], b = P[(i + 1) % 4], mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2,
      d = unit(a, b), n = { x: -d.y, y: d.x }, out = '';
    for (var k = 0; k < count; k++) { var off = (k - (count - 1) / 2) * 4.5, bx = mx + d.x * off, by = my + d.y * off;
      out += '<line x1="' + (bx - n.x * 5).toFixed(1) + '" y1="' + (by - n.y * 5).toFixed(1) + '" x2="' + (bx + n.x * 5).toFixed(1)
        + '" y2="' + (by + n.y * 5).toFixed(1) + '" stroke="' + col + '" stroke-width="2.1"/>'; }
    return out; }
  function cmLab(P, i, txt) { var a = P[i], b = P[(i + 1) % 4], mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2,
      cx = (P[0].x + P[1].x + P[2].x + P[3].x) / 4, cy = (P[0].y + P[1].y + P[2].y + P[3].y) / 4,
      dx = mx - cx, dy = my - cy, l = Math.hypot(dx, dy) || 1;
    return '<text x="' + (mx + dx / l * 16).toFixed(1) + '" y="' + (my + dy / l * 16 + 5).toFixed(1) + '">' + txt + '</text>'; }
  function greenRA(P) { return raMk(P, 0, GRN) + raMk(P, 1, GRN) + raMk(P, 2, GRN) + raMk(P, 3, GRN); }
  function greenTk(P) { return tick(P, 0, 1, GRN) + tick(P, 1, 1, GRN) + tick(P, 2, 1, GRN) + tick(P, 3, 1, GRN); }

  function shell(showV, showH, hintHtml) {
    var h = '<div class="g6q"><div class="g6q-stage"><svg viewBox="0 0 380 288" role="img" aria-label="Quadrilatère déformable">'
      + '<polygon class="q" fill="rgba(100,116,139,.10)" stroke="#5b6472" stroke-width="2.4" stroke-linejoin="round"></polygon>'
      + '<g class="cod"></g><g class="ra"></g>'
      + '<g class="lab" font-size="15" font-weight="600" fill="#1f2632" text-anchor="middle" paint-order="stroke" stroke="#f7f6f3" stroke-width="3.6" stroke-linejoin="round"></g>'
      + '<g class="vtx"></g><g class="pins"></g></svg></div>';
    if (showV) h += '<div class="g6q-v"><span class="d"></span><span class="t"></span></div>';
    if (showH) h += '<div class="g6q-h">' + hintHtml + '</div>';
    return h + '</div>';
  }
  function verts(P) { return P.map(function (o) { return '<circle cx="' + o.x + '" cy="' + o.y + '" r="2.6" fill="#1f2632"></circle>'; }).join(''); }
  function verdict(ask, c) {
    if (ask === 'losange') return c.isRhombus ? ['win', c.isSquare ? "C'est un losange ! (ici même un carré)" : "C'est un losange ! (4 côtés de même longueur)"] : ['', "Ce n'est pas un losange… (les 4 côtés ne sont pas égaux)"];
    if (ask === 'carre') { if (c.isSquare) return ['win', "C'est un carré ! (4 angles droits ET 4 côtés égaux)"];
      if (c.isRect) return ['mid', "C'est un rectangle, mais pas un carré."]; if (c.isRhombus) return ['mid', "C'est un losange, mais pas un carré."]; return ['', "Ce n'est pas un carré…"]; }
    return c.isRect ? ['win', c.isSquare ? "C'est un rectangle ! (ici même un carré)" : "C'est un rectangle ! (les 4 angles sont droits)"] : ['', "Ce n'est pas un rectangle… (il reste des angles non droits)"];
  }

  // ================================================================= MODES
  var MODES = {
    para: function (cfg) {
      var a = cfg.a || 5, b = cfg.b || 3, rh = (a === b), cm = !!cfg.cm;
      var S = Math.min(38, 180 / Math.max(a, b)), AB = a * S, AD = b * S;
      var A = { x: 190 - AB / 2, y: 150 + AD / 2 }, B = { x: 190 + AB / 2, y: 150 + AD / 2 };
      var LO = 34 * Math.PI / 180, HI = 146 * Math.PI / 180;
      return {
        hint: cm ? ('Fais glisser le <b style="color:#ea7317">point orange</b> : les mesures (' + a + ' cm et ' + b + ' cm) restent fixes, seuls les <b>angles</b> changent.')
                 : ('Fais glisser le <b style="color:#ea7317">point orange</b> : les <b>côtés opposés</b> restent de même longueur (marques), seuls les <b>angles</b> changent.'),
        state: { ang: (rh ? 57 : 63) * Math.PI / 180 },
        points: function (s) { var D = { x: A.x + AD * Math.cos(s.ang), y: A.y - AD * Math.sin(s.ang) }; return [A, B, { x: B.x + (D.x - A.x), y: B.y + (D.y - A.y) }, D]; },
        pins: function (P) { return [P[3]]; },
        dragPin: function (s, idx, x, y) { var an = Math.atan2(A.y - y, x - A.x); an = Math.max(LO, Math.min(HI, an)); if (Math.abs(an - Math.PI / 2) < .035) an = Math.PI / 2; return { ang: an }; },
        coded: function (P) { if (cm) return { m: '', l: cmLab(P, 0, a + ' cm') + cmLab(P, 2, a + ' cm') + cmLab(P, 1, b + ' cm') + cmLab(P, 3, b + ' cm') };
          if (rh) return { m: tick(P, 0, 1, GY) + tick(P, 1, 1, GY) + tick(P, 2, 1, GY) + tick(P, 3, 1, GY), l: '' };
          return { m: tick(P, 0, 1, GY) + tick(P, 2, 1, GY) + tick(P, 1, 2, GY) + tick(P, 3, 2, GY), l: '' }; }
      };
    },
    rtri: function (cfg) {
      var ra3 = (cfg.ra === 3), bx0 = 112, bx1 = 268, by = 210, base = bx1 - bx0, LOh = 46, HIh = 178;
      return {
        hint: ra3 ? 'Fais glisser le <b style="color:#ea7317">point orange</b> : les angles droits codés restent vrais, seule la <b>hauteur</b> change.'
                  : 'Fais glisser les <b style="color:#ea7317">deux points orange</b> : les deux angles droits codés (en bas) restent toujours vrais.',
        state: { hD: 150, hC: ra3 ? 150 : 98 },
        points: function (s) { return [{ x: bx0, y: by }, { x: bx1, y: by }, { x: bx1, y: by - s.hC }, { x: bx0, y: by - s.hD }]; },
        pins: function (P) { return ra3 ? [P[3]] : [P[3], P[2]]; },
        dragPin: function (s, idx, x, y) { var h = Math.max(LOh, Math.min(HIh, by - y)); if (Math.abs(h - base) < 6) h = base;
          if (ra3) return { hD: h, hC: h };
          if (idx === 0) return { hD: (Math.abs(h - s.hC) < 7) ? s.hC : h, hC: s.hC };
          return { hD: s.hD, hC: (Math.abs(h - s.hD) < 7) ? s.hD : h }; },
        coded: function (P) { var m = raMk(P, 0, GY) + raMk(P, 1, GY); if (ra3) m += raMk(P, 2, GY); return { m: m, l: '' }; }
      };
    },
    oppra: function (cfg) {
      var A = { x: 96, y: 210 };
      function D(B, C) { var u = unit(A, B), nA = { x: -u.y, y: u.x }, w = unit(C, B), nC = { x: -w.y, y: w.x };
        var det = nC.x * nA.y - nA.x * nC.y; if (Math.abs(det) < 1e-3) return null;
        var t = (-(C.x - A.x) * nC.y + nC.x * (C.y - A.y)) / det; return { x: A.x + t * nA.x, y: A.y + t * nA.y }; }
      function ok(B, C) { var d = D(B, C); if (!d) return null; var P = [A, B, C, d];
        if (d.x < -20 || d.x > 400 || d.y < -20 || d.y > 320) return null; if (!convex(P)) return null; return P; }
      return {
        hint: 'Deux angles droits codés en <b>A</b> et <b>C</b>. Bouge <b style="color:#ea7317">B</b> et <b style="color:#ea7317">C</b> : le point D suit (intersection des deux perpendiculaires).',
        state: { B: { x: 262, y: 210 }, C: { x: 250, y: 96 } },
        points: function (s) { return [A, s.B, s.C, D(s.B, s.C)]; },
        pins: function (P) { return [P[1], P[2]]; },
        dragPin: function (s, idx, x, y) { x = Math.max(30, Math.min(360, x)); y = Math.max(20, Math.min(268, y));
          var B = { x: s.B.x, y: s.B.y }, C = { x: s.C.x, y: s.C.y };
          if (idx === 0) { B = { x: x, y: (Math.abs(y - A.y) < 8) ? A.y : y }; }
          else { C = { x: (Math.abs(x - s.B.x) < 9) ? s.B.x : x, y: y }; }
          return ok(B, C) ? { B: B, C: C } : s; },
        coded: function (P) { return { m: raMk(P, 0, GY) + raMk(P, 2, GY), l: '' }; }
      };
    },
    oppeq: function (cfg) {
      var A = { x: 100, y: 206 }, B = { x: 280, y: 206 }, L = dist(A, B);
      var C0 = { x: 262, y: 96 }, D0 = { x: C0.x - L * 0.993, y: C0.y + L * 0.119 };
      return {
        hint: '<b>AB</b> et <b>CD</b> ont la même longueur (marques). A et B sont fixes ; bouge <b style="color:#ea7317">C</b> et <b style="color:#ea7317">D</b> — le segment CD garde toujours la longueur de AB.',
        state: { C: C0, D: D0 },
        points: function (s) { return [A, B, s.C, s.D]; },
        pins: function (P) { return [P[2], P[3]]; },
        dragPin: function (s, idx, x, y) { x = Math.max(20, Math.min(360, x)); y = Math.max(20, Math.min(268, y));
          if (idx === 0) { var C = { x: x, y: y }; if (Math.abs(x - B.x) < 9) C.x = B.x; var D = { x: C.x - L, y: C.y };
            if (Math.abs(y - s.D.y) > 12 || Math.abs(x - B.x) >= 9) { var u = unit(C, s.D); D = { x: C.x + L * u.x, y: C.y + L * u.y }; }
            return { C: C, D: D }; }
          var D2 = { x: x, y: y }; if (Math.abs(x - A.x) < 9) D2.x = A.x; var C2 = { x: D2.x + L, y: D2.y };
          if (Math.abs(y - s.C.y) > 12 || Math.abs(x - A.x) >= 9) { var v = unit(D2, s.C); C2 = { x: D2.x + L * v.x, y: D2.y + L * v.y }; }
          return { C: C2, D: D2 }; },
        coded: function (P) { return { m: tick(P, 0, 1, GY) + tick(P, 2, 1, GY), l: '' }; }
      };
    },
    chain3: function (cfg) {
      var A = { x: 110, y: 208 }, B = { x: 250, y: 208 }, L = dist(A, B);
      var C0 = { x: B.x + L * 0.243, y: B.y - L * 0.970 }, D0 = { x: C0.x - L * 0.989, y: C0.y - L * 0.148 };
      return {
        hint: '<b>AB</b>, <b>BC</b> et <b>CD</b> ont la même longueur (marques). Bouge <b style="color:#ea7317">C</b> et <b style="color:#ea7317">D</b> : les trois longueurs restent égales, seul le 4<sup>e</sup> côté (DA) varie.',
        state: { C: C0, D: D0 },
        points: function (s) { return [A, B, s.C, s.D]; },
        pins: function (P) { return [P[2], P[3]]; },
        dragPin: function (s, idx, x, y) {
          if (idx === 0) { var uC = unit(B, { x: x, y: y }), C = { x: B.x + L * uC.x, y: B.y + L * uC.y };
            var uD = unit(C, s.D), D = { x: C.x + L * uD.x, y: C.y + L * uD.y }; return { C: C, D: D }; }
          var uD2 = unit(s.C, { x: x, y: y }), D2 = { x: s.C.x + L * uD2.x, y: s.C.y + L * uD2.y };
          if (Math.abs(dist(D2, A) - L) < 12) { var snap = circInt(s.C, A, L, D2); if (snap) D2 = snap; }
          return { C: s.C, D: D2 }; },
        coded: function (P) { return { m: tick(P, 0, 1, GY) + tick(P, 1, 1, GY) + tick(P, 2, 1, GY), l: '' }; }
      };
    }
  };
  MODES.rhomb = function (cfg) { cfg.a = cfg.a || 4; cfg.b = cfg.a; return MODES.para(cfg); };

  // ================================================================= builder
  window.G6quad = function (id, cfg) {
    inject();
    var box = (typeof id === 'string') ? document.getElementById(id) : id; if (!box) return;
    var ask = cfg.ask || 'rectangle', showV = cfg.verdict !== false, showH = cfg.hint !== false;
    var M = (MODES[cfg.type] || MODES.para)(cfg);
    box.innerHTML = shell(showV, showH, M.hint);
    var svg = box.querySelector('svg'), q = box.querySelector('.q'), cod = box.querySelector('.cod'), ra = box.querySelector('.ra'),
        lab = box.querySelector('.lab'), vtx = box.querySelector('.vtx'), pins = box.querySelector('.pins'),
        vbox = box.querySelector('.g6q-v'), vt = box.querySelector('.t');
    var state = M.state, active = 0;
    function draw() {
      var P = M.points(state); if (!P || !P[3]) return;
      q.setAttribute('points', P.map(function (o) { return o.x.toFixed(1) + ',' + o.y.toFixed(1); }).join(' '));
      vtx.innerHTML = verts(P);
      var cc = M.coded(P); cod.innerHTML = cc.m; lab.innerHTML = cc.l;
      var c = classify(P), vis = '';
      if (c.isRect) vis += greenRA(P); if (ask === 'losange' && c.isRhombus && !c.isRect) vis += greenTk(P);
      ra.innerHTML = vis;
      pins.innerHTML = M.pins(P).map(function (p) { return '<circle class="g6q-pin" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="9.5" fill="' + OR + '" stroke="#f7f6f3" stroke-width="2.5" tabindex="0"></circle>'; }).join('');
      if (vbox) { var v = verdict(ask, c); vbox.className = 'g6q-v' + (v[0] ? ' ' + v[0] : ''); vt.textContent = v[1]; }
    }
    function svgXY(e) { var r = svg.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * 380, y: (e.clientY - r.top) / r.height * 288 }; }
    function pick(pt) { var ps = M.pins(M.points(state)), best = 0, bd = 1e9; for (var i = 0; i < ps.length; i++) { var d = dist(ps[i], pt); if (d < bd) { bd = d; best = i; } } return best; }
    var drag = false;
    svg.addEventListener('pointerdown', function (e) { drag = true; try { svg.setPointerCapture(e.pointerId); } catch (_) {} var pt = svgXY(e); active = pick(pt); state = M.dragPin(state, active, pt.x, pt.y) || state; draw(); e.preventDefault(); });
    window.addEventListener('pointermove', function (e) { if (!drag) return; var pt = svgXY(e); state = M.dragPin(state, active, pt.x, pt.y) || state; draw(); });
    window.addEventListener('pointerup', function () { drag = false; });
    box.addEventListener('keydown', function (e) { var ps = M.pins(M.points(state)); if (active >= ps.length) active = 0; var p = ps[active], dx = 0, dy = 0;
      if (e.key === 'ArrowLeft') dx = -6; else if (e.key === 'ArrowRight') dx = 6; else if (e.key === 'ArrowUp') dy = -6; else if (e.key === 'ArrowDown') dy = 6; else return;
      state = M.dragPin(state, active, p.x + dx, p.y + dy) || state; draw(); e.preventDefault(); });
    draw();
  };
})();
