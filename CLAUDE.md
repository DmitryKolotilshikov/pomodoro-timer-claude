# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Обзор

Два независимых статических фронтенд-приложения на чистом HTML/CSS/JS — без сборки, без `package.json`, без зависимостей, без тестов и линтера. Не git-репозиторий.

- **Корень** — Pomodoro-таймер (`index.html`, `script.js`, `style.css`). UI на русском, неоновый/киберпанк-стиль.
- **`exchange-rates-app/`** — отдельное приложение курсов валют (опубликовано на GitHub Pages: https://dmitrykolotilshikov.github.io/exchange-rates-app). Со своими стилями и скриптами, с Pomodoro код не делит.

## Запуск

- Pomodoro: `open index.html` (работает и через `file://`).
- Exchange rates: `script.js` подключён как ES-модуль (`type="module"`, импортирует `helpers.js`), поэтому через `file://` не заработает — нужен локальный сервер, например `python3 -m http.server -d exchange-rates-app 8000`.

## Pomodoro: архитектура

- **Состояние** — модульные переменные в `script.js` (`mode`, `remainingMs`, `endsAt`, `tickId`, `completed`). Единственная функция отрисовки `render()` вызывается после каждого изменения состояния и обновляет всё: время, подпись режима, кольцо прогресса, `document.title`, disabled-состояние кнопок.
- **Отсчёт по дедлайну, а не по счётчику тиков:** при старте сохраняется `endsAt = Date.now() + remainingMs`, `setInterval(tick, 250)` лишь пересчитывает остаток. Так таймер не «отстаёт» при троттлинге фоновых вкладок. Признак «таймер идёт» — `tickId !== null`.
- **Режимы** задаются в объекте `MODES` (длительность, подпись, цвет). По окончании отрезка режим переключается work ↔ break и следующий отрезок стартует автоматически; `completed` растёт только после work.
- **Связь JS → CSS:** `render()` выставляет CSS-переменную `--accent` на `:root` (цвет текущего режима — от него зависят кольцо, кнопки, свечение) и класс `body.running` (анимация «дыхания» кольца). Перекраска интерфейса делается через `--accent`, а не через отдельные классы.
- **Кольцо прогресса** — SVG `<circle>` со `stroke-dasharray`/`stroke-dashoffset`; константа `CIRCUMFERENCE` должна соответствовать радиусу круга `.progress` в `index.html`.
- **Звук** — синтез через Web Audio API (`playNotes`), без аудиофайлов. `AudioContext` создаётся лениво по клику «Старт» из-за autoplay-политики браузеров.
- Учитывается `prefers-reduced-motion` в `style.css`.

## Exchange rates: архитектура

- Данные из `https://open.er-api.com/v6/latest/<BASE>` (без API-ключа). Глобальный объект `rates` — курсы относительно валюты первого селекта.
- Смена первой валюты или swap → повторный запрос (`updateExchangeRates`); смена второй — только перерисовка (`renderInfo`). Ввод в любое поле пересчитывает другое через `rates[secondSelect.value]`.
- DOM-элементы ищутся по `data-*` атрибутам, а не по классам.
