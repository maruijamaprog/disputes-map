# Спорные территории 1900–2026

Интерактивная политическая карта мира со спорными территориями с 1900 года по настоящее время. Автор — Маруся Малафеева. Статический сайт: MapLibre GL JS + чистый JavaScript, без бэкенда, без сторонних тайлов и ключей API.

## Статус

| Этап | Что | Статус |
|---|---|---|
| 1 | Архитектура, список споров, каркас данных | ✅ |
| 2 | Сбор и верификация данных по первым 10 спорам | ✅ (`docs/VERIFICATION_REPORT.md`, разделы 1–9) |
| 3 | Код сайта с этими данными | ✅ |
| 3.1 | Помесячная шкала, подписи стран, темы и цвет карты, история конфликта, дипотношения, режим «Военные конфликты» | ✅ |
| 4 | Остальные споры партиями по 10–15 | партия 2 (10 споров) ✅; партия 3 (15 споров) ✅ ждёт подтверждения (разделы 16–19 отчёта); партия 4 ⏳ |
| 5 | Инструкция по публикации | ✅ `docs/PUBLISHING.md` (GitHub Pages из ветки main, без Actions) |
| 6 | Слой «Транспортные маршруты»: СМП, TRACECA, МТК «Север – Юг», Средний коридор, IMEC, TRIPP | ✅ ждёт подтверждения (раздел 20 отчёта) |

## Как посмотреть сайт на своём компьютере

Открыть `site/index.html` двойным щелчком нельзя: браузер запрещает страницам с диска загружать файлы данных. Нужен простой локальный веб-сервер.

**Вариант 1 — Python (уже установлен вместе с Anaconda):**

1. Открой «Anaconda Prompt» или обычную командную строку.
2. Выполни:
   ```
   cd %USERPROFILE%\projects\disputes-map\site
   python -m http.server 8000
   ```
3. Открой в браузере http://localhost:8000
4. Чтобы остановить сервер — `Ctrl+C` в окне командной строки.

**Вариант 2 — VS Code:** установи расширение Live Server, открой папку `site` и нажми «Go Live» внизу окна.

## Структура

```
disputes-map/
├── site/                     ← это и есть сайт; эту папку публикуем
│   ├── index.html            карта: режимы «Споры» и «Военные конфликты»
│   ├── methodology.html      «Источники и методология» (RU/EN)
│   ├── assets/css, assets/js модули: topo, time, roles, map, wars, ui, i18n, main
│   ├── assets/glyphs/        шрифты для подписей на карте (Noto Sans)
│   ├── i18n/ru.json, en.json строки интерфейса
│   ├── vendor/maplibre-gl/   MapLibre GL JS 5.24.0 (BSD-3-Clause)
│   └── data/                 собранные данные (генерируются скриптами, руками не править)
├── data/
│   ├── disputes.json         проверенные записи споров (сейчас 20)
│   ├── disputes.skeleton.json  каркас остальных записей (черновик)
│   ├── actors.skeleton.json  справочник сторон
│   ├── wars_manual.json      решения редакции по войнам 2026 г. (до выхода UCDP 27.1)
│   └── diplomacy_curated.json  проверенные сведения о дипотношениях и признании
├── raw/                      исходные датасеты (не публикуются, см. .gitignore)
├── scripts/
│   ├── download_raw.bat      скачать геоданные в raw/
│   ├── download_extra.bat    скачать UCDP, Correlates of War и названия государств из Wikidata в raw/
│   ├── download_vendor.bat   скачать MapLibre в site/vendor/
│   ├── build_geodata.py      CShapes + Natural Earth → site/data/*.topo.json, подписи стран
│   ├── geomops.py            наложение полигонов (разность, пересечение) без сторонних библиотек
│   ├── build_site_data.py    data/disputes.json → site/data/
│   ├── build_wars.py         UCDP + COW + wars_manual.json → site/data/wars.json
│   ├── build_diplomacy.py    diplomacy_curated.json → site/data/diplomacy.json
│   ├── build_routes.py       data/routes.json → site/data/routes.json (транспортные маршруты, проверка линий)
│   ├── check_data.py         проверка записей: схема, два источника, позиции сторон, лексика
│   ├── data/                 скрипты партий: batch2*.py, batch3*.py, history_batch1.py
│   └── geometry_sources.json откуда берётся полигон каждой зоны спора
├── schema/disputes.schema.json
└── docs/                     ARCHITECTURE, BACKLOG, VERIFICATION_REPORT, PUBLISHING
```

## Как пересобрать данные

Нужен только Python 3.9+ (без GDAL и сторонних библиотек). Сначала скачать исходники: `scripts\download_raw.bat` и `scripts\download_extra.bat`.

```
cd %USERPROFILE%\projects\disputes-map
python scripts\build_geodata.py --raw raw --out site\data --disputes data\disputes.json --sources scripts\geometry_sources.json
python scripts\build_site_data.py
python scripts\build_wars.py --raw raw --out site\data --manual data\wars_manual.json
python scripts\build_diplomacy.py --raw raw --out site\data
python scripts\data\routes_data.py data\routes.json
python scripts\build_routes.py --raw raw --out site\data
python scripts\check_data.py . check.json
```

- `build_wars.py` берёт войны 1900–1945 из Correlates of War, 1946–2025 — из UCDP/PRIO 26.1. Конфликты 2025 г. продолжаются в 2026 г. с пометкой «не проверено», пока в `data/wars_manual.json` нет решения по источникам.
- `build_diplomacy.py` показывает только проверенные сведения из `data/diplomacy_curated.json`; из Wikidata берутся лишь названия государств.
- Файл UCDP (`ucdp-prio-acd-261-csv.zip`) и файлы Correlates of War кладутся в `raw/` скриптом `download_extra.bat`. Архив `States2024.zip` антивирус может заблокировать — для сборки он не нужен.

## Лицензии

- Код сайта и скрипты — MIT (`LICENSE`).
- Тексты и метаданные споров, решения по войнам 2026 г., сведения о дипотношениях — CC BY 4.0.
- Слой государств по годам — производный от CShapes 2.0, **CC BY-NC 4.0** (только некоммерческое использование). Поэтому сайт целиком некоммерческий.
- Войны 1946–2025 — UCDP/PRIO Armed Conflict Dataset 26.1, CC BY 4.0; войны 1900–1945 — Correlates of War, публикуются с письменного разрешения проекта (цитирование: Sarkees & Wayman 2010, *Resort to War*). Исходные файлы COW в репозиторий не выкладываются.
- Natural Earth — общественное достояние; названия государств из Wikidata — CC0; MapLibre GL JS — BSD-3-Clause; шрифты Noto Sans — SIL Open Font License 1.1.

Подробности — в `LICENSE-DATA.md` и `docs/ARCHITECTURE.md` §4.
