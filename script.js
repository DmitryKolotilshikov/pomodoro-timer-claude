const MODES = {
  work:  { label: 'Работа', seconds: 25 * 60, color: 'var(--work)' },
  break: { label: 'Отдых',  seconds: 5 * 60,  color: 'var(--break)' },
};

const els = {
  mode: document.getElementById('mode'),
  time: document.getElementById('time'),
  progress: document.getElementById('progress'),
  start: document.getElementById('start'),
  pause: document.getElementById('pause'),
  reset: document.getElementById('reset'),
  color: document.getElementById('color'),
  count: document.getElementById('count'),
};

let mode = 'work';
let remainingMs = MODES.work.seconds * 1000;
let endsAt = null;   // timestamp конца отрезка, когда таймер идёт
let tickId = null;
let completed = 0;
let customColor = null;  // случайный цвет с кнопки «Цвет»; null — цвет текущего режима
let audioCtx = null;

// Звуки через Web Audio API — без аудиофайлов.
// notes: [[частота, сдвиг от начала в секундах], ...]
function playNotes(notes, duration = 0.18, volume = 0.3) {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  notes.forEach(([freq, offset]) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, now + offset);
    gain.gain.exponentialRampToValueAtTime(volume, now + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + duration);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(now + offset);
    osc.stop(now + offset + duration + 0.02);
  });
}

// Конец отрезка: три одинаковых сигнала
function beep() {
  const freq = mode === 'work' ? 660 : 880;
  playNotes([[freq, 0], [freq, 0.25], [freq, 0.5]]);
}

// Старт: два тона вверх
const startSound = () => playNotes([[523, 0], [784, 0.1]], 0.12, 0.2);
// Пауза: два тона вниз
const pauseSound = () => playNotes([[784, 0], [523, 0.1]], 0.12, 0.2);

function format(ms) {
  const total = Math.ceil(ms / 1000);
  const m = String(Math.floor(total / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function render() {
  const cfg = MODES[mode];
  const text = format(remainingMs);
  els.time.textContent = text;
  els.mode.textContent = cfg.label;
  const fraction = remainingMs / (cfg.seconds * 1000);
  const root = document.documentElement.style;
  root.setProperty('--accent', customColor ?? cfg.color);
  root.setProperty('--offset', 100 * (1 - fraction));  // длина кольца = pathLength 100
  els.count.textContent = `Завершено помидоров: ${completed}`;
  document.title = `${text} · ${cfg.label}`;

  const running = tickId !== null;
  els.start.disabled = running;
  els.pause.disabled = !running;
  document.body.classList.toggle('running', running);  // для «дыхания» кольца в CSS
}

function tick() {
  remainingMs = Math.max(0, endsAt - Date.now());
  if (remainingMs === 0) {
    beep();
    if (mode === 'work') completed++;
    mode = mode === 'work' ? 'break' : 'work';
    remainingMs = MODES[mode].seconds * 1000;
    endsAt = Date.now() + remainingMs;  // следующий отрезок стартует автоматически
  }
  render();
}

function start() {
  if (tickId !== null) return;
  // AudioContext создаём по клику — иначе браузер заблокирует звук
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  audioCtx.resume();
  startSound();
  endsAt = Date.now() + remainingMs;
  tickId = setInterval(tick, 250);
  render();
}

function pause() {
  if (tickId === null) return;
  clearInterval(tickId);
  tickId = null;
  remainingMs = Math.max(0, endsAt - Date.now());
  pauseSound();
  render();
}

function reset() {
  clearInterval(tickId);
  tickId = null;
  customColor = null;
  mode = 'work';
  remainingMs = MODES.work.seconds * 1000;
  render();
}

// Случайный неоновый цвет: насыщенный и светлый, чтобы светился на тёмном фоне.
// Оттенок каждый раз заметно отличается от предыдущего.
let lastHue = null;
function randomColor() {
  let hue;
  do hue = Math.floor(Math.random() * 360);
  while (lastHue !== null && Math.abs(((hue - lastHue + 540) % 360) - 180) < 40);
  lastHue = hue;
  customColor = `hsl(${hue} 100% 60%)`;
  render();
}

els.start.addEventListener('click', start);
els.pause.addEventListener('click', pause);
els.reset.addEventListener('click', reset);
els.color.addEventListener('click', randomColor);

render();
