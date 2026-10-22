// Мини-игра «Блоха» в духе Google-динозаврика.
// Обёрнута в IIFE: script.js тоже классический скрипт, имена не должны пересекаться.
(() => {
  const W = 600, H = 160;          // внутреннее разрешение canvas, на экране масштабируется CSS
  const GROUND = 140;              // y линии земли
  const FLEA = { x: 60, w: 26, h: 16 };
  const GRAVITY = 2400;            // px/с²
  const JUMP_V = -720;             // начальная скорость прыжка, px/с
  const BASE_SPEED = 300, MAX_SPEED = 700;
  const BEST_KEY = 'flea-best';
  const CHAR_KEY = 'flea-char';

  const els = {
    game: document.getElementById('game'),
    canvas: document.getElementById('game-canvas'),
    score: document.getElementById('game-score'),
    open: document.getElementById('game-open'),
    close: document.getElementById('game-close'),
    chars: document.querySelectorAll('#game-chars [data-char]'),
  };
  const ctx = els.canvas.getContext('2d');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  let state = 'ready';   // ready | run | over
  let flea, obstacles, speed, distance, score, nextGap;
  let best = readBest();
  let character = 'flea';  // настоящее значение выставит selectCharacter() ниже
  let rafId = null;
  let lastT = 0;

  function readBest() {
    try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; }
  }
  function saveBest() {
    try { localStorage.setItem(BEST_KEY, String(best)); } catch {}
  }

  // Смена персонажа во время забега начинает игру заново — иначе было бы нечестно
  function selectCharacter(name) {
    if (!(name in CHARACTERS)) name = 'flea';
    character = name;
    els.chars.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.char === name)));
    try { localStorage.setItem(CHAR_KEY, name); } catch {}
    if (state === 'run') { resetGame(); state = 'ready'; }
  }

  const rand = (a, b) => a + Math.random() * (b - a);

  function resetGame() {
    flea = { y: GROUND, vy: 0, onGround: true };  // y — низ блохи
    obstacles = [];
    speed = BASE_SPEED;
    distance = 0;
    score = 0;
    nextGap = rand(200, 350);
  }

  // Препятствие — «расчёска»: планка и зубья вниз до земли
  function spawn() {
    const teeth = Math.round(rand(2, 5));
    obstacles.push({ x: W, w: teeth * 7, h: rand(18, 36), teeth });
  }

  function jump() {
    if (state === 'over') { resetGame(); state = 'run'; return; }
    if (state === 'ready') state = 'run';
    if (flea.onGround) {
      flea.vy = JUMP_V;
      flea.onGround = false;
    }
  }

  function step(dt) {
    // Физика блохи
    flea.vy += GRAVITY * dt;
    flea.y += flea.vy * dt;
    if (flea.y >= GROUND) { flea.y = GROUND; flea.vy = 0; flea.onGround = true; }

    // Мир едет влево
    const dx = speed * dt;
    distance += dx;
    score = Math.floor(distance / 10);
    speed = Math.min(MAX_SPEED, BASE_SPEED + score * 0.5);
    obstacles.forEach(o => { o.x -= dx; });
    obstacles = obstacles.filter(o => o.x + o.w > 0);

    // Новое препятствие, когда последнее отъехало на нужное расстояние.
    // Промежуток растёт со скоростью, чтобы прыжок всегда успевал.
    const last = obstacles[obstacles.length - 1];
    if (!last || W - (last.x + last.w) >= nextGap) {
      spawn();
      nextGap = rand(250, 450) * speed / BASE_SPEED;
    }

    // Столкновение (хитбокс блохи чуть меньше рисунка — так честнее)
    const fx1 = FLEA.x + 4, fx2 = FLEA.x + FLEA.w - 4;
    const fy1 = flea.y - FLEA.h + 3;
    for (const o of obstacles) {
      if (fx2 > o.x && fx1 < o.x + o.w && flea.y > GROUND - o.h && fy1 < GROUND) {
        state = 'over';
        if (score > best) { best = score; saveBest(); }
        break;
      }
    }
  }

  // Персонажи: у всех один хитбокс (FLEA), отличается только рисунок.
  // draw(x, y, legs): y — низ персонажа, legs — фаза лапок (-1 | 1) на земле, 0 — в прыжке.
  const CHARACTERS = {
    flea(x, y, legs) {
      // Тело — овал, слегка наклонённый вперёд
      ctx.beginPath();
      ctx.ellipse(x + 12, y - 9, 11, 7, -0.25, 0, Math.PI * 2);
      ctx.fill();
      // Голова
      ctx.beginPath();
      ctx.arc(x + 24, y - 12, 4, 0, Math.PI * 2);
      ctx.fill();
      // Усики
      ctx.beginPath();
      ctx.moveTo(x + 26, y - 15); ctx.lineTo(x + 32, y - 22);
      ctx.moveTo(x + 24, y - 16); ctx.lineTo(x + 27, y - 24);
      ctx.stroke();
      // Лапки: на земле перебирают, в прыжке вытянуты назад
      ctx.beginPath();
      if (legs) {
        const a = legs * 3;
        ctx.moveTo(x + 6, y - 5);  ctx.quadraticCurveTo(x + 2, y - 10, x + 1 + a, y);
        ctx.moveTo(x + 12, y - 4); ctx.lineTo(x + 12 - a, y);
        ctx.moveTo(x + 18, y - 5); ctx.lineTo(x + 20 + a, y);
      } else {
        ctx.moveTo(x + 6, y - 5);  ctx.lineTo(x - 6, y + 2);
        ctx.moveTo(x + 12, y - 4); ctx.lineTo(x + 4, y + 3);
        ctx.moveTo(x + 18, y - 5); ctx.lineTo(x + 14, y + 3);
      }
      ctx.stroke();
    },

    tick(x, y, legs) {
      // Круглое брюшко и маленькая голова-«хоботок»
      ctx.beginPath();
      ctx.arc(x + 11, y - 9, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + 21, y - 8, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + 23, y - 8); ctx.lineTo(x + 27, y - 7);
      ctx.stroke();
      // Восемь лапок, видно четыре — короткие, широко расставленные
      ctx.beginPath();
      const a = legs * 2;
      for (let i = 0; i < 4; i++) {
        const lx = x + 5 + i * 4;
        const k = i % 2 ? 1 : -1;  // соседние лапки двигаются в противофазе
        if (legs) { ctx.moveTo(lx, y - 4); ctx.lineTo(lx - 3 + k * a, y); }
        else { ctx.moveTo(lx, y - 4); ctx.lineTo(lx - 6, y + 1); }
      }
      ctx.stroke();
    },

    hopper(x, y, legs) {
      // Вытянутое тело и голова с большим глазом
      ctx.beginPath();
      ctx.ellipse(x + 12, y - 10, 12, 4, -0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + 24, y - 12, 4, 0, Math.PI * 2);
      ctx.fill();
      // Длинные усы назад
      ctx.beginPath();
      ctx.moveTo(x + 25, y - 15); ctx.quadraticCurveTo(x + 22, y - 28, x + 6, y - 26);
      ctx.stroke();
      // Мощное заднее бедро-«зигзаг»: на земле сложено, в прыжке выпрямлено
      ctx.beginPath();
      if (legs) {
        ctx.moveTo(x + 8, y - 10); ctx.lineTo(x + 16, y - 17); ctx.lineTo(x + 4, y);
      } else {
        ctx.moveTo(x + 8, y - 10); ctx.lineTo(x - 2, y - 4); ctx.lineTo(x - 10, y + 3);
      }
      // Передние лапки
      const a = legs * 2;
      ctx.moveTo(x + 18, y - 7); ctx.lineTo(x + 20 + a, y);
      ctx.moveTo(x + 14, y - 7); ctx.lineTo(x + 13 - a, y);
      ctx.stroke();
    },
  };

  function drawPlayer(color, t) {
    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    const legs = !flea.onGround ? 0
      : state === 'run' && !reducedMotion.matches && Math.floor(t / 100) % 2 ? 1 : -1;
    CHARACTERS[character](FLEA.x, flea.y, legs);
    ctx.restore();
  }

  function drawComb(o, color) {
    const top = GROUND - o.h;
    ctx.fillStyle = color;
    ctx.fillRect(o.x, top, o.w, 5);  // планка
    for (let i = 0; i < o.teeth; i++) {
      ctx.fillRect(o.x + i * 7 + 1, top, 3, o.h);  // зубья
    }
  }

  function draw(t) {
    const css = getComputedStyle(document.documentElement);
    const accent = css.getPropertyValue('--accent').trim();
    const muted = css.getPropertyValue('--muted').trim();

    ctx.clearRect(0, 0, W, H);
    ctx.shadowColor = accent;
    ctx.shadowBlur = 8;

    // Земля + бегущие штрихи
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, GROUND + 0.5);
    ctx.lineTo(W, GROUND + 0.5);
    ctx.stroke();
    ctx.fillStyle = muted;
    const off = distance % 40;
    for (let x = -off; x < W; x += 40) ctx.fillRect(x, GROUND + 7, 12, 1);

    obstacles.forEach(o => drawComb(o, accent));
    drawPlayer(accent, t);

    // Рекорд в углу и подсказки
    ctx.shadowBlur = 0;
    ctx.font = `700 13px ${getComputedStyle(document.body).fontFamily}`;
    ctx.fillStyle = muted;
    ctx.textAlign = 'right';
    ctx.fillText(`РЕКОРД ${String(best).padStart(5, '0')}`, W - 8, 18);

    if (state !== 'run') {
      ctx.textAlign = 'center';
      ctx.fillStyle = accent;
      ctx.shadowBlur = 8;
      ctx.font = `700 16px ${getComputedStyle(document.body).fontFamily}`;
      if (state === 'over') ctx.fillText('ПОЙМАЛИ!', W / 2, 60);
      ctx.fillText(state === 'over' ? 'Пробел — заново' : 'Пробел — старт', W / 2, state === 'over' ? 84 : 70);
    }

    els.score.textContent = String(score).padStart(5, '0');
  }

  function loop(t) {
    // Клэмп dt: после возврата во вкладку rAF не должен «телепортировать» мир
    const dt = Math.min(0.05, (t - lastT) / 1000);
    lastT = t;
    if (state === 'run') step(dt);
    draw(t);
    rafId = requestAnimationFrame(loop);
  }

  function onKey(e) {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault();  // без скролла и без «нажатия» кнопки в фокусе
      jump();
    } else if (e.code === 'Escape') {
      close();
    } else if (/^Digit[1-9]$/.test(e.code) && els.chars[e.code.slice(5) - 1]) {
      selectCharacter(els.chars[e.code.slice(5) - 1].dataset.char);
    }
  }

  function open() {
    els.game.hidden = false;
    document.activeElement?.blur();  // иначе пробел нажмёт кнопку «Игра» под оверлеем
    resetGame();
    state = 'ready';
    document.addEventListener('keydown', onKey);
    lastT = performance.now();
    rafId = requestAnimationFrame(loop);
  }

  function close() {
    els.game.hidden = true;
    cancelAnimationFrame(rafId);
    rafId = null;
    document.removeEventListener('keydown', onKey);
  }

  els.chars.forEach(b => b.addEventListener('click', () => {
    selectCharacter(b.dataset.char);
    b.blur();  // иначе пробел «нажмёт» кнопку персонажа вместо прыжка
  }));
  try { selectCharacter(localStorage.getItem(CHAR_KEY)); } catch { selectCharacter('flea'); }

  els.open.addEventListener('click', open);
  els.close.addEventListener('click', close);
  els.canvas.addEventListener('pointerdown', e => { e.preventDefault(); jump(); });
  // Клик по затемнению вокруг окна тоже закрывает игру
  els.game.addEventListener('click', e => { if (e.target === els.game) close(); });
})();
