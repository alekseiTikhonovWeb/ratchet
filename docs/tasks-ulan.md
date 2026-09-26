# Улан — задачи (инфраструктура и проверки)

Всё ниже — копипаст команд. Ничего не нужно придумывать. Если что-то падает — скрин ошибки Алексею, не чинить самому дольше 15 минут.

## 1. Bob у себя (30 мин)

- [ ] Установить Bob IDE **2.0.2+** (`bob.ibm.com/download`), запустить триал, один тестовый запрос в Agent-режиме
- [ ] Settings → MCP → Add server. Записать в `bob_sessions/README.md`, как выглядит конфиг (JSON или форма — скрин)
- [ ] Сделать любую сессию, найти кнопку/команду экспорта сессии. Записать в `bob_sessions/README.md`: где кнопка, какой файл получается (расширение, размер)

## 2. Форк демо-репо — mirador (30 мин)

Репо выбран: `github.com/ProjectMirador/mirador`. Точные команды — в `docs/demo-repo.md`, раздел «Prepare the fork». Выполнить их по порядку. Коротко: форк → `npm install` → `@types/react@19` → скопировать tsconfig, `ci/ratchet.sh`, workflow → заменить в workflow строку тестов на `npx vitest run` → `npx tsc --noEmit` (0 ошибок) → `bash ci/ratchet.sh --init` → коммит «ratchet: baseline» → push.

- [ ] Actions на GitHub зелёный. Скрин Алексею
- [ ] Один намеренно красный прогон: добавить любой `src/tmp.js`, запушить, дождаться красного Actions, скрин, откатить коммит (`git revert`), запушить

Если `tsc` ругается на `Cannot find name 'require'` — не хватает `@types/node` (шаг 2). Если `Cannot redeclare block-scoped variable` — в `tsconfig.json` должно быть `"moduleDetection": "force"` (уже есть в нашем файле).

## 3. Vercel (30 мин)

- [ ] vercel.com → New Project → импорт `alekseiTikhonovWeb/ratchet` → Root Directory: `packages/dashboard` → Framework: Vite → Deploy
- [ ] URL вида `ratchet-xxx.vercel.app` — Софии в README и Алексею
- [ ] Пока дашборда нет, деплой упадёт или покажет пустую страницу — это нормально, главное чтобы проект существовал

## 4. На каждом батче (с вечера пятницы)

После того как Алексей говорит «батч N готов»:

```bash
cd demo-mirador && git pull
npx tsc --noEmit
npx vitest run __tests__/src/components   # тесты слоя, который мигрируем; полный сьют — в CI
bash ci/ratchet.sh --check
```

- [ ] Все три зелёные → сообщить «батч N ок». Красное — скрин Алексею
- [ ] Экспорт сессии Bob → `ratchet/bob_sessions/bNN.json`, коммит в `ratchet`
- [ ] Скрин дашборда после батча → `pitch/screens/batch-NN.png`

## 5. Суббота: запись экрана

- [ ] OBS или встроенная запись, 1080p, 30 fps, без веб-камеры, звук с микрофона Алексея
- [ ] Тестовая запись 30 секунд в пятницу вечером: проверить, что видно курсор и текст читается
