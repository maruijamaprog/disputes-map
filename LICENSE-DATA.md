# Лицензии данных

| Файлы | Происхождение | Лицензия | Что требуется |
|---|---|---|---|
| `site/data/countries.*.topo.json` | Производные от **CShapes 2.0** (G. Schvitz, L. Girardin, S. Rüegger, N. B. Weidmann, L.-E. Cederman, K. S. Gleditsch, ETH Zürich; *Journal of Conflict Resolution* 66(1), 2022) | **CC BY-NC 4.0** | Атрибуция; только некоммерческое использование |
| `site/data/land.topo.json`, `site/data/disputes.topo.json` (части из Natural Earth) | **Natural Earth** 5.1 (1:10m, 1:50m) | Общественное достояние | Атрибуция по желанию (указана) |
| `site/data/disputes.topo.json` (Данциг, Кувейт) | Производные от CShapes 2.0 | CC BY-NC 4.0 | Как выше |
| `data/disputes.json`, `site/data/disputes.json`, `site/data/actors.json` | Тексты и метаданные автора проекта (Маруся Малафеева) | **CC BY 4.0** | Атрибуция |
| `site/data/wars.json` (1946–2025) | Производные от **UCDP/PRIO Armed Conflict Dataset 26.1** (Uppsala Conflict Data Program, PRIO; Gleditsch et al. 2002; Davies et al. 2025) | **CC BY 4.0** | Атрибуция (указана на сайте и в карточках) |
| `site/data/wars.json` (1900–1945) | Производные от **Correlates of War**: Inter-State и Extra-State War Data v4.0, Intra-State War Data v5.1. Цитирование по просьбе проекта: Sarkees, Meredith Reid and Frank Wayman (2010). Resort to War: 1816 – 2007. Washington DC: CQ Press; для внутренних войн также Dixon & Sarkees, *A Guide to Intra-State Wars* (2016) | Условия проекта Correlates of War: без коммерческого использования; распространение — с письменного разрешения | Разрешение на публикацию получено автором проекта (октябрь 2026 г.); исходные файлы COW (`raw/`) в репозиторий не выкладываются |
| `data/wars_manual.json`, `data/diplomacy_curated.json` и их части в `site/data/` | Решения и тексты автора проекта (Маруся Малафеева) со ссылками на внешние публикации | **CC BY 4.0** | Атрибуция |
| `data/routes.json`, `site/data/routes.json` | Тексты, даты, цифры и схема линий транспортных маршрутов — автор проекта (Маруся Малафеева) по источникам, указанным в каждой записи; проверка линий по Natural Earth | **CC BY 4.0** | Атрибуция |
| `site/data/diplomacy.json` (названия государств) | **Wikidata** | CC0 | Не требуется |
| `site/assets/glyphs/` | Шрифты Noto Sans (Google), сконвертированные в формат MapLibre | SIL Open Font License 1.1 | Текст лицензии с уведомлением об авторских правах — `site/assets/glyphs/OFL.txt` |
| `site/vendor/maplibre-gl/` | MapLibre GL JS 5.24.0 | BSD-3-Clause | Сохранить `LICENSE.txt` |

Поскольку слой государств по годам распространяется по CC BY-NC 4.0, сайт целиком может использоваться **только в некоммерческих целях**.

Цитаты и ссылки на внешние документы (резолюции, судебные решения, статьи) в `disputes.json` — это библиографические ссылки; сами документы принадлежат их правообладателям.
