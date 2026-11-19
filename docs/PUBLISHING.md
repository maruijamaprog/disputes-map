# Публикация на GitHub Pages

Сайт публикуется прямо из ветки `main`, без GitHub Actions и без папки `.github`. Для этого в корне репозитория лежат два файла:

- `index.html` — перенаправляет на `site/` (ссылки вида `…#t=1938-09&d=sudetenland` сохраняются);
- `.nojekyll` — пустой файл, отключает обработку Jekyll: GitHub отдаёт файлы как есть.

Адрес сайта после публикации: `https://<логин>.github.io/<имя репозитория>/` — он сразу откроет карту из `site/`.

## Первая публикация (GitHub Desktop)

1. GitHub Desktop → **File → Add local repository…** → папка `C:\Users\Marusya\projects\disputes-map` → **Add repository**.
2. Слева появится список файлов. Внизу в поле **Summary** написать, например, «Карта: партии 1–3» → **Commit to main**.
3. Вверху нажать **Publish repository**. Имя — например, `disputes-map`. Снять галочку **Keep this code private**: на бесплатном аккаунте GitHub Pages работает только для публичных репозиториев. → **Publish repository**.
4. На github.com открыть репозиторий → **Settings** → слева **Pages** → в разделе **Build and deployment**:
   - **Source:** Deploy from a branch
   - **Branch:** `main`, папка `/ (root)` → **Save**.
5. Через 1–3 минуты вверху страницы **Pages** появится адрес сайта («Your site is live at …»). Ход публикации виден на вкладке **Actions** (задача «pages build and deployment»): её GitHub создаёт сам, файлы в репозиторий она не добавляет.

## Первая публикация через сайт github.com (без программ)

1. github.com → **+** → **New repository** → имя `disputes-map`, **Public**, README не добавлять → **Create repository**.
2. На странице пустого репозитория нажать ссылку **uploading an existing file**.
3. В Проводнике открыть папку проекта, выделить всё, **кроме `raw`**, и перетащить в окно браузера. Скрытую папку `.git` не переносить. Структура папок сохраняется. За раз можно загрузить до 100 файлов, в проекте их около 75.
4. Дождаться, пока загрузятся все файлы → внизу **Commit changes**.
5. Проверить, что в корне репозитория лежат `index.html` и `.nojekyll`. Если `.nojekyll` не загрузился (пустые файлы иногда пропускаются): **Add file → Create new file** → имя `.nojekyll` → **Commit changes**.
6. Дальше — шаги 4–5 из предыдущего раздела (**Settings → Pages**).

Обновление через сайт: **Add file → Upload files** → перетащить изменённые папки (`data`, `site`, `scripts`, `docs`) → **Commit changes**. Файлы с теми же путями заменятся. Файлы, удалённые на компьютере, на GitHub останутся — их нужно удалить вручную.

Если репозиторий создан через сайт, то для работы с ним в GitHub Desktop его нужно клонировать (**File → Clone repository**), а не публиковать заново папку проекта.

## Обновление после новой партии

GitHub Desktop покажет изменённые файлы → **Commit to main** → **Push origin**. Сайт обновится сам за 1–3 минуты. Если в браузере видна старая версия — обновить страницу с **Ctrl+F5**.

## Что не попадает в репозиторий

`raw/` — исходные датасеты (CShapes, Natural Earth, UCDP, COW). Они большие, у части свои условия распространения, и сайт их не использует: всё нужное уже собрано в `site/data/`. Папка исключена в `.gitignore`. Также исключены `__pycache__/` и журнал сборки.

## Перед публикацией проверить

- Есть `site/vendor/maplibre-gl/` (если нет — `scripts\download_vendor.bat`).
- Сайт открывается локально (см. README, «Как посмотреть сайт на своём компьютере»).
- Лицензии: CShapes 2.0 распространяется по CC BY-NC 4.0, поэтому сайт некоммерческий. Атрибуция источников есть на карте и на странице «Методика», условия — в `LICENSE-DATA.md`.

## Вариант через командную строку

```bat
cd C:\Users\Marusya\projects\disputes-map
git add .
git commit -m "Карта: партии 1–3"
git branch -M main
git remote add origin https://github.com/<логин>/disputes-map.git
git push -u origin main
```

Репозиторий `disputes-map` нужно сначала создать на github.com (пустым, без README). Дальше — шаг 4 выше. Для обновлений: `git add .`, `git commit -m "…"`, `git push`.
