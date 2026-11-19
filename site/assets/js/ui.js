// Панель: легенда, фильтры, список-заменитель карты, карточки спора, страны и конфликта, подсказка.
import { t, tx, getLang } from './i18n.js';
import { units, controllersAt, unitVisible, partiesIn } from './roles.js';
import { formatMonth, formatDate, formatRange, activeAt } from './time.js';
import { patternDataURL } from './map.js';
import { yearsOf } from './wars.js';
import { routeStatus, segmentOperating, dint } from './routes.js';

export function el(tag, attrs = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) if (c !== null && c !== undefined && c !== false) n.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return n;
}

/** Заменить содержимое узла, пропуская пустые части (null/false иначе превратились бы в текст «null»). */
function fill(node, ...parts) {
  node.replaceChildren(...parts.flat(Infinity).filter((x) => x !== null && x !== undefined && x !== false));
}

// ---------------------------------------------------------------- иконки (обводка currentColor)
const ICONS = {
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  play: '<path d="M7 4.5v15l12-7.5z" fill="currentColor"/>',
  pause: '<path d="M7 4h3.5v16H7zM13.5 4H17v16h-3.5z" fill="currentColor" stroke="none"/>',
  prev: '<path d="M18 19 8 12l10-7z" fill="currentColor"/><path d="M6 5v14"/>',
  next: '<path d="M6 5l10 7-10 7z" fill="currentColor"/><path d="M18 5v14"/>',
  filter: '<path d="M3 4h18l-7 8.5V19l-4 2v-8.5z"/>',
  layers: '<path d="M12 3 2 8l10 5 10-5z"/><path d="M2 13l10 5 10-5"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
  info: '<circle cx="12" cy="12" r="9.5"/><path d="M12 11v6M12 7.5v.01"/>',
  i: '<path d="M12 10.5v8M12 5.6v.01" stroke-width="2.6"/>',
  help: '<circle cx="12" cy="12" r="9.5"/><path d="M9.4 9.2a2.7 2.7 0 0 1 5.2 1c0 1.9-2.6 2.3-2.6 4M12 17.3v.01"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  list: '<path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  swords: '<path d="M14.5 17.5 4 7V4h3l10.5 10.5M13 19l6-6M16 16l4 4M9.5 6.5 13 3h3v3l-3.5 3.5M5 14l5 5M4 20l3-3"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  globe: '<circle cx="12" cy="12" r="9.5"/><path d="M2.5 12h19M12 2.5c3 3.2 3 15.8 0 19M12 2.5c-3 3.2-3 15.8 0 19"/>',
  route: '<circle cx="5" cy="18" r="2.2"/><circle cx="19" cy="6" r="2.2"/><path d="M7 17.5c4-1 2.5-6 6-7.5s3.5-2 4.2-2.6"/>',
};
export function icon(name, cls = '') {
  return el('span', { class: `ico ${cls}`.trim(), 'aria-hidden': 'true',
    html: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>` });
}
export function iconHTML(name) {
  return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

export const TYPES = ['sovereignty', 'occupation', 'secession', 'maritime', 'demarcation', 'decolonization', 'other'];

export function actorName(code, actors, fallback) {
  const a = actors[code];
  if (a) return a[getLang()] || a.ru;
  return fallback || code;
}

// ---------------------------------------------------------------- легенда
export function renderLegend(root, mode, { selected = false, routes = false } = {}) {
  root.replaceChildren();
  const sw = (kind) => el('span', { class: 'swatch', style: `background-image:url(${patternDataURL(kind)})`, 'aria-hidden': 'true' });
  const item = (swatch, key) => el('li', {}, swatch, el('span', { text: t(key) }));
  const routeItems = () => (routes ? [
    item(el('span', { class: 'swatch route', 'aria-hidden': 'true' }), 'legend.route.op'),
    item(el('span', { class: 'swatch route dashed', 'aria-hidden': 'true' }), 'legend.route.plan')] : []);
  if (mode === 'wars') {
    if (selected) {
      root.append(item(sw('WX'), 'legend.war.selected'), item(sw('WL'), 'legend.war.ally'), item(sw('WF'), 'legend.war.foe'), item(sw('WP'), 'legend.war.other'));
    } else {
      root.append(item(sw('WM'), 'legend.war.major'), item(sw('Wm'), 'legend.war.minor'), item(sw('WS'), 'legend.war.secondary'), item(sw('WU'), 'legend.war.unverified'));
    }
    root.append(...routeItems(), el('li', { class: 'legend-note', text: t('legend.war.note') }));
    return;
  }
  root.append(
    item(el('span', { class: 'swatch', style: 'background:var(--role-a);opacity:.75', 'aria-hidden': 'true' }), 'legend.A'),
    item(sw('B'), 'legend.B'), item(sw('C'), 'legend.C'), item(sw('D'), 'legend.D'),
    item(sw('E'), 'legend.E'), item(sw('R'), 'legend.R'), item(sw('T'), 'legend.T'), item(sw('N'), 'legend.N'),
    item(el('span', { class: 'swatch line', 'aria-hidden': 'true' }), 'legend.changed'),
    item(el('span', { class: 'swatch nodata', 'aria-hidden': 'true' }), 'legend.nodata'),
    ...routeItems(),
  );
}

// ---------------------------------------------------------------- фильтры
export function renderTypeFilters(root, filters, onChange) {
  root.replaceChildren();
  for (const ty of TYPES) {
    const id = `f-type-${ty}`;
    const cb = el('input', { type: 'checkbox', id, checked: filters.types.has(ty) });
    cb.addEventListener('change', () => { cb.checked ? filters.types.add(ty) : filters.types.delete(ty); onChange(); });
    root.append(el('label', { for: id, class: 'chip-check' }, cb, el('span', { text: t(`type.${ty}`) })));
  }
}

// ---------------------------------------------------------------- подсказка
export function showTooltip(tip, point, nodes) {
  tip.replaceChildren(...nodes);
  tip.hidden = false;
  const pad = 14, w = tip.offsetWidth, h = tip.offsetHeight;
  const parent = tip.parentElement.getBoundingClientRect();
  let x = point.x + pad, y = point.y + pad;
  if (x + w > parent.width) x = point.x - w - pad;
  if (y + h > parent.height) y = point.y - h - pad;
  tip.style.left = `${Math.max(4, x)}px`; tip.style.top = `${Math.max(4, y)}px`;
}
export function hideTooltip(tip) { tip.hidden = true; }

export function controllerText(u, ref, actors) {
  const { full, partial } = controllersAt(u, ref);
  const names = [...full.map((c) => actorName(c.state, actors)), ...partial.map((c) => `${actorName(c.state, actors)} (${t('card.partial')})`)];
  return names.length ? names.join(', ') : t('card.control.none');
}

// ---------------------------------------------------------------- список
const norm = (s) => (s || '').toLowerCase().replaceAll('ё', 'е');

export function buildOptions(T, disputes, actors, query) {
  const q = norm(query).trim();
  const actorSet = new Map();
  for (const d of disputes) for (const u of units(d)) if (unitVisible(u, T)) {
    for (const code of partiesIn(u, T)) actorSet.set(code, (actorSet.get(code) || new Set()).add(d.id));
  }
  const actorOpts = [...actorSet.entries()]
    .map(([code, ds]) => ({ kind: 'actor', id: code, label: actorName(code, actors), meta: String(ds.size) }))
    .filter((o) => !q || norm(o.label).includes(q) || norm(o.id).includes(q))
    .sort((a, b) => a.label.localeCompare(b.label, getLang()));
  const dispOpts = disputes
    .map((d) => ({ kind: 'dispute', id: d.id, label: tx(d.name), meta: `${d.period.start ?? '…'}–${d.period.end ?? ''}`, alt: (d.alt_names || []).map((a) => a.name).join(' ') }))
    .filter((o) => !q || norm(o.label).includes(q) || norm(o.alt).includes(q))
    .sort((a, b) => a.label.localeCompare(b.label, getLang()));
  return [{ title: t('list.disputes'), opts: dispOpts }, { title: t('list.actors'), opts: actorOpts }];
}

export function renderList(listbox, groups, activeKey) {
  listbox.replaceChildren();
  let any = false;
  for (const { title, opts } of groups) {
    if (!opts.length) continue;
    any = true;
    listbox.append(el('li', { class: 'group', role: 'presentation', text: `${title} · ${opts.length}` }));
    for (const o of opts) {
      const key = `${o.kind}:${o.id}`;
      listbox.append(el('li', { role: 'option', id: `opt-${o.kind}-${o.id}`, 'data-key': key, 'aria-selected': key === activeKey ? 'true' : 'false', class: o.cls || null },
        o.dot ? el('span', { class: `opt-dot ${o.dot}`, 'aria-hidden': 'true' }) : null,
        el('span', { class: 'opt-label', text: o.label }), el('span', { class: 'meta', text: o.meta })));
    }
  }
  if (!any) listbox.append(el('li', { class: 'group', role: 'presentation', text: t('list.empty') }));
}

// ---------------------------------------------------------------- общие части карточек
function cardHead({ eyebrow, title, sub, onClose, extra }) {
  return el('header', { class: 'card-head' },
    el('div', { class: 'card-top' },
      el('button', { type: 'button', class: 'back-btn', onclick: onClose }, icon('back'), el('span', { text: t('card.back') })),
      el('button', { type: 'button', class: 'icon-btn close', 'aria-label': t('card.close'), title: t('card.close'), onclick: onClose }, icon('close'))),
    eyebrow ? el('p', { class: 'eyebrow', text: eyebrow }) : null,
    el('h2', { tabindex: '-1', text: title }),
    sub ? el('p', { class: 'sub', text: sub }) : null,
    extra || null);
}

function kv(rows) {
  return el('dl', { class: 'kv' }, rows.filter(Boolean).map(([k, v]) => [el('dt', { text: k }), el('dd', {}, v)]));
}

function tabs(id, panes) {
  // panes: [{key, label, body}] — вкладки с клавиатурой (стрелки влево/вправо)
  const list = el('div', { class: 'tabs', role: 'tablist' });
  const bodies = [];
  panes.forEach((p, i) => {
    const tid = `${id}-tab-${p.key}`, pid = `${id}-pane-${p.key}`;
    const b = el('button', { type: 'button', role: 'tab', id: tid, 'aria-controls': pid, 'aria-selected': i === 0 ? 'true' : 'false', tabindex: i === 0 ? '0' : '-1', text: p.label });
    list.append(b);
    bodies.push(el('div', { role: 'tabpanel', id: pid, 'aria-labelledby': tid, class: 'tabpane', hidden: i !== 0 }, p.body));
  });
  const btns = () => [...list.querySelectorAll('[role="tab"]')];
  const select = (i) => {
    btns().forEach((b, k) => { b.setAttribute('aria-selected', String(k === i)); b.tabIndex = k === i ? 0 : -1; bodies[k].hidden = k !== i; });
  };
  list.addEventListener('click', (e) => { const b = e.target.closest('[role="tab"]'); if (b) select(btns().indexOf(b)); });
  list.addEventListener('keydown', (e) => {
    const i = btns().indexOf(document.activeElement);
    if (i < 0) return;
    let j = null;
    if (e.key === 'ArrowRight') j = (i + 1) % bodies.length;
    if (e.key === 'ArrowLeft') j = (i - 1 + bodies.length) % bodies.length;
    if (e.key === 'Home') j = 0;
    if (e.key === 'End') j = bodies.length - 1;
    if (j !== null) { e.preventDefault(); select(j); btns()[j].focus(); }
  });
  return [list, ...bodies];
}

function refs(ids, srcIndex, did) {
  const out = [];
  for (const id of ids || []) {
    const n = srcIndex.get(id);
    if (!n) continue;
    out.push(el('a', { class: 'ref', href: `#src-${did}-${id}`, onclick: (e) => {
      e.preventDefault();
      const tab = document.getElementById(`${did}-tab-sources`);
      tab?.click();
      document.getElementById(`src-${did}-${id}`)?.scrollIntoView({ block: 'center' });
    }, text: `[${n}]` }));
  }
  return out;
}

// ---------------------------------------------------------------- карточка страны
export function renderCountryCard(card, ctx) {
  const { title, unitName, T, mode, summary, wars, warsState, diplo, actors, onOpenDispute, onOpenConflict, onCountry, onClose, gwName, isoName,
    routes = [], onOpenRoute } = ctx;
  const lang = getLang();
  const sections = [];

  // споры
  const disputesBlock = summary.length
    ? el('ul', { class: 'rows' }, summary.map(({ dispute, roles }) => el('li', {},
        el('button', { type: 'button', class: 'row-link', onclick: () => onOpenDispute(dispute.id) },
          el('span', { class: 'row-title', text: tx(dispute.name) }),
          el('span', { class: 'chips' }, [...new Set(roles.map((r) => r.role))].map((r) => el('span', { class: `role-chip ${r}`, text: t(`role.${r}`) }))),
          icon('chevron', 'row-chev')))))
    : el('p', { class: 'muted', text: t('actor.none') });
  const disputesSec = el('section', { class: 'sec' }, el('h3', {}, icon('flag'), t('actor.disputes')), disputesBlock);

  // войны
  let warBody;
  if (warsState === 'loading') warBody = el('p', { class: 'muted', text: t('war.loading') });
  else if (warsState === 'error') warBody = el('p', { class: 'muted', text: t('war.unavailable') });
  else if (!wars || !wars.length) warBody = el('p', { class: 'muted', text: t('war.none') });
  else {
    warBody = el('ul', { class: 'rows' }, wars.map((inv) => {
      const foes = inv.foes.map((p) => (p.g ? gwName(p.g) : p.name)).filter(Boolean);
      const allies = inv.allies.map((p) => (p.g ? gwName(p.g) : p.name)).filter(Boolean);
      return el('li', {},
        el('button', { type: 'button', class: 'row-link', onclick: () => onOpenConflict(inv.c.id) },
          el('span', { class: 'row-title', text: conflictTitle(inv.c, gwName) }),
          el('span', { class: 'row-meta' },
            el('span', { class: `int-chip i${inv.int}`, text: t(`war.int.${inv.int}`) }), ' ',
            el('span', { text: t(`war.kind.${kindAt(inv.c, T)}`) }),
            inv.unverified ? el('span', { class: 'badge warn', text: t('war.unverified.short') }) : null),
          icon('chevron', 'row-chev')),
        el('div', { class: 'row-details' },
          el('p', {}, el('strong', { text: `${t('war.role')}: ` }), inv.role === 1 ? t('war.role.primary') : t('war.role.secondary', { who: allies.slice(0, 3).join(', ') || '—' })),
          foes.length ? el('p', {}, el('strong', { text: `${t('war.against')}: ` }), [...new Set(foes)].join(', ')) : null,
          allies.length && inv.role === 1 ? el('p', { class: 'muted' }, `${t('war.with')}: `, [...new Set(allies)].join(', ')) : null));
    }));
  }
  const warsSec = el('section', { class: 'sec' }, el('h3', {}, icon('swords'), t('war.title', { date: formatMonth(T, lang) })), warBody);

  // дипотношения: только проверенные сведения
  let diploSec = null;
  if (diplo) {
    const { facts, none, asOf } = diplo;
    const srcLinks = (sources) => (sources?.length ? el('div', { class: 'small' }, sources.map((s, k) => [k ? ' · ' : '', el('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer', text: s.title })])) : null);
    const status = (x) => (x.review
      ? el('div', { class: 'small' }, el('span', { class: 'badge warn', text: t('diplo.review') }), x.confirmed ? el('span', { class: 'muted', text: ` · ${t('diplo.confirmed', { date: formatDate(x.confirmed, lang) })}` }) : null)
      : (x.confirmed ? el('div', { class: 'small muted', text: t('diplo.confirmed', { date: formatDate(x.confirmed, lang) }) }) : null));
    diploSec = el('section', { class: 'sec' },
      el('h3', {}, icon('globe'), t('diplo.title')),
      el('p', { class: 'muted small', text: t('diplo.asof', { date: asOf }) }),
      facts.length ? el('ul', { class: 'plain' }, facts.map((f) => el('li', {}, el('p', { text: tx(f.text) }), status(f), srcLinks(f.sources)))) : null,
      none.length ? el('div', { class: 'callout' },
        el('p', { class: 'callout-title', text: t('diplo.none') }),
        el('ul', {}, none.map((x) => el('li', {}, el('strong', { text: isoName(x.other) }),
          el('span', { class: 'muted', text: ` · ${t(`diplo.status.${x.status}`)}${x.since ? ` ${t('diplo.since', { y: formatDate(x.since, lang) })}` : ''}` }),
          x.note ? el('div', { class: 'small', text: tx(x.note) }) : null, status(x), srcLinks(x.sources))))) : null,
      !facts.length && !none.length ? el('p', { class: 'muted', text: t('diplo.empty') }) : null,
      el('p', { class: 'small muted', text: t('diplo.source') }));
  }

  if (mode === 'wars') sections.push(warsSec, disputesSec); else sections.push(disputesSec, warsSec);
  if (routes.length) {
    sections.push(el('section', { class: 'sec' }, el('h3', {}, icon('route'), t('actor.routes')),
      el('ul', { class: 'rows' }, routes.map(({ r, role }) => el('li', {},
        el('button', { type: 'button', class: 'row-link', onclick: () => onOpenRoute(r.id) },
          el('span', { class: 'route-dot', style: `background:${r.color}`, 'aria-hidden': 'true' }),
          el('span', { class: 'row-title', text: tx(r.name) }),
          el('span', { class: 'chips' }, el('span', { class: 'role-chip', text: t(`actor.route.${role}`) }),
            el('span', { class: 'role-chip', text: t(`route.status.${routeStatus(r, T.ref)}`) })),
          icon('chevron', 'row-chev')))))));
  }
  if (diploSec) sections.push(diploSec);

  fill(card,
    cardHead({ eyebrow: t('actor.eyebrow'), title, sub: t('actor.asof', { date: formatMonth(T, lang) }), onClose,
      extra: unitName && unitName !== title ? el('p', { class: 'muted small', text: t('actor.unit', { name: unitName }) }) : null }),
    ...sections);
  card.hidden = false;
}

// ---------------------------------------------------------------- справка о территории без единицы CShapes
const REF_TYPES = { 'Sovereign country': 'sovereign', Sovereignty: 'sovereign', Country: 'country', Dependency: 'dependency',
  Disputed: 'disputed', Indeterminate: 'indeterminate', Lease: 'lease' };

/** p — свойства полигона суши Natural Earth: k, n, r (названия), t (TYPE), sv/svr (суверен), u (интервалы без данных). */
export function renderRefCard(card, { p, T, onClose }) {
  const lang = getLang();
  const name = lang === 'ru' ? p.r : p.n;
  const START = 19000101, OPEN = 99991231;
  const gaps = String(p.u || '').split(',').filter(Boolean).map((iv) => iv.split('-').map(Number));
  const nowGap = gaps.some(([s, e]) => s <= T.ref && T.ref <= e);
  const base = REF_TYPES[p.t] || 'other';
  // «Country» у Natural Earth — и суверенные государства (Франция), и страны в их составе (Гренландия)
  const kind = base === 'country' && !p.sv ? 'sovereign' : base;
  const sov = lang === 'ru' ? p.svr : p.sv;
  const period = ([s, e]) => {
    if (s <= START && e >= OPEN) return t('ref.always');
    if (e >= OPEN) return t('ref.since', { date: formatDate(s, lang) });
    if (s <= START) return t('ref.until', { date: formatDate(e, lang) });
    return formatRange(s, e, lang);
  };
  fill(card,
    cardHead({ eyebrow: t('ref.eyebrow'), title: name, sub: t('actor.asof', { date: formatMonth(T, lang) }), onClose }),
    el('section', { class: 'sec' },
      el('p', { text: nowGap ? t('ref.nodata') : t('ref.covered') }),
      kv([
        [t('ref.periods'), gaps.map(period).join('; ')],
        [t('ref.status'), t(`ref.type.${kind}`)],
        sov ? [t('ref.sov'), sov] : null,
      ]),
      el('p', { class: 'small muted', text: t('ref.why') })));
  card.hidden = false;
}

// ---------------------------------------------------------------- карточка транспортного маршрута
export function renderRouteCard(card, { r, T, actors, nodes, through, onClose, onActor }) {
  const lang = getLang();
  const did = `route-${r.id}`;
  const srcIndex = new Map(r.sources.map((s, i) => [s.id, i + 1]));
  const st = routeStatus(r, T.ref);
  const actorLink = (code) => el('button', { type: 'button', class: 'linklike', onclick: () => onActor(code), text: actorName(code, actors) });
  const nodeName = (id) => (nodes[id] ? (lang === 'ru' ? nodes[id].ru : nodes[id].en) : null);

  const badges = el('div', { class: 'badges' },
    el('span', { class: `badge${st === 'operating' ? ' live' : st === 'none' ? '' : ' plan'}`, text: t(`route.status.${st}`) }),
    el('span', { class: `badge${r.confidence === 'low' ? ' warn' : ''}`, text: t(`conf.${r.confidence}`) }),
    r.needs_human_review ? el('span', { class: 'badge warn', text: t('badge.review') }) : null);

  // ветви: цепочки узлов, недостроенные участки помечены
  const branches = el('ul', { class: 'plain route-branches' }, r.branches.map((b) => el('li', {},
    el('strong', { text: tx(b.name) }),
    el('div', { class: 'small' }, b.segments.map((seg, i) => {
      const names = seg.nodes.map(nodeName).filter(Boolean);
      const op = segmentOperating(r, seg, T.ref);
      const notYet = T.ref < (dint(seg.appear) || dint(r.appear));
      return el('div', { class: `seg${seg.planned ? ' planned' : ''}` },
        el('span', { class: 'seg-line', style: `border-color:${r.color}`, 'data-op': op ? '1' : '0', 'aria-hidden': 'true' }),
        names.join(' – '),
        seg.mode === 'sea' ? el('span', { class: 'muted', text: ` · ${t('route.sea')}` }) : null,
        seg.planned ? el('span', { class: 'badge warn', text: t('route.seg.planned') }) : (st === 'partial' && !op && !notYet ? el('span', { class: 'badge plan', text: t('route.seg.notyet') }) : null),
        seg.note ? el('div', { class: 'muted', text: tx(seg.note) }) : null);
    })),
    b.note ? el('div', { class: 'small muted', text: tx(b.note) }) : null)));

  const parties = r.parties.length ? el('p', {}, r.parties.map((c, i) => [i ? ', ' : '', actorLink(c)])) : null;
  const thr = (through || []).filter((c) => !r.parties.includes(c));
  const overview = [
    el('p', { class: 'lead', text: tx(r.summary) }),
    el('h3', { text: t('route.now') }), el('p', { text: tx(r.status) }),
    parties ? [el('h3', { text: t('route.parties') }), parties] : null,
    thr.length ? [el('h3', { text: t('route.through') }), el('p', {}, thr.map((c, i) => [i ? ', ' : '', actorLink(c)]))] : null,
    el('h3', { text: t('route.branches') }), branches,
    el('p', { class: 'small muted', text: t('route.geom') }),
  ];

  // загрузка: пропускная способность и ряды по годам
  const caps = r.capacity.length
    ? el('ul', { class: 'plain caps' }, r.capacity.map((c) => el('li', {},
        el('span', { class: 'role-chip', text: t(`route.cap.${c.kind}`) }), ' ', tx(c.text), ' ', refs(c.source_ids, srcIndex, did))))
    : el('p', { class: 'muted', text: t('route.nocapacity') });
  const series = r.volumes.length ? r.volumes.map((sr) => {
    const max = Math.max(...sr.points.map((p) => p.value)) || 1;
    return el('figure', { class: 'vol' },
      el('figcaption', {}, el('strong', { text: tx(sr.label) }), el('span', { class: 'muted', text: ` · ${tx(sr.unit)}` })),
      el('ul', { class: 'bars' }, sr.points.map((p) => {
        const later = p.year > T.y;
        return el('li', { class: later ? 'later' : (p.year === T.y ? 'now' : null), title: later ? t('route.later') : null },
          el('span', { class: 'bar-year', text: String(p.year) }),
          el('span', { class: 'bar-track' }, el('span', { class: 'bar-fill', style: `width:${Math.max(2, (p.value / max) * 100)}%;background:${r.color}` })),
          el('span', { class: 'bar-val', text: p.value.toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-GB', { maximumFractionDigits: 3 }) }),
          el('span', { class: 'bar-src' }, refs(p.source_ids, srcIndex, did), p.source_ids.length < 2 ? el('span', { class: 'badge warn', text: t('route.single') }) : null));
      })),
      sr.note ? el('p', { class: 'small muted', text: tx(sr.note) }) : null);
  }) : [el('p', { class: 'muted', text: t('route.novolumes') })];
  const load = [el('h3', { text: t('route.capacity') }), caps, el('h3', { text: t('route.volumes') }), ...series];

  const history = r.history.length
    ? el('ol', { class: 'history' }, r.history.map((h) => el('li', { class: `h-${h.kind || 'event'}${dint(h.date) > T.ref ? ' later' : ''}` },
        el('time', { text: formatDate(h.date, lang) }), el('p', {}, tx(h.text), ' ', refs(h.source_ids, srcIndex, did)))))
    : el('p', { class: 'muted', text: t('card.history.none') });

  const sources = el('ol', { class: 'sources' }, r.sources.map((s) => el('li', { id: `src-${did}-${s.id}` },
    s.url ? el('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer', text: s.title }) : el('span', { text: s.title }),
    el('span', { class: 'src-meta', text: ` — ${sourceLabel(s)}; ${s.type}${s.page_or_article ? '; ' + s.page_or_article : ''}${s.note ? '; ' + s.note : ''}; ${s.verified_fulltext ? t('card.verified') : t('card.notverified')}` }))));
  const review = (r.review.conflicts.length || r.review.notes.length)
    ? el('details', { class: 'more review' }, el('summary', { text: t('card.review') }),
        el('ul', {}, [...r.review.conflicts, ...r.review.notes].map((x) => el('li', { class: 'small', text: x }))))
    : null;

  fill(card,
    cardHead({ eyebrow: t('route.eyebrow'), title: tx(r.name), sub: t('actor.asof', { date: formatMonth(T, lang) }), onClose, extra: badges }),
    kv(r.operate && r.operate === r.appear
      ? [[t('route.since'), formatDate(r.operate, lang)]]
      : [[t('route.appear'), formatDate(r.appear, lang)],
         [t('route.operate'), r.operate ? formatDate(r.operate, lang) : t(st === 'partial' ? 'route.operate.partial' : 'route.operate.none')]]),
    ...tabs(did, [
      { key: 'overview', label: t('card.tab.overview'), body: overview },
      { key: 'load', label: t('route.tab.load'), body: load },
      { key: 'history', label: t('card.tab.history'), body: history },
      { key: 'sources', label: t('card.tab.sources', { n: r.sources.length }), body: [sources, review] },
    ]));
  card.hidden = false;
}

// ---------------------------------------------------------------- карточка спора
function sourceLabel(s) {
  const when = s.published ? formatDate(s.published, getLang()) : (s.year ? String(s.year) : null);
  return [s.author, when].filter(Boolean).join(', ');
}

export function renderDisputeCard(card, { d, T, actors, geometryMeta, onClose, onActor }) {
  const lang = getLang();
  const ref = T.ref;
  const srcIndex = new Map(d.sources.map((s, i) => [s.id, i + 1]));
  const srcById = Object.fromEntries(d.sources.map((s) => [s.id, s]));
  const allUnits = units(d);
  const visUnits = allUnits.filter((u) => unitVisible(u, T));
  const multi = allUnits.length > 1;
  const actorLink = (code) => el('button', { type: 'button', class: 'linklike', onclick: () => onActor(code), text: actorName(code, actors) });

  const badges = el('div', { class: 'badges' },
    d.secondary_types.map((s) => el('span', { class: 'badge', text: `${t(`type.${s.type}`)}${s.qualified_by.length ? ' · ' + t('card.qualified', { src: s.qualified_by.map((id) => (srcById[id] ? `${srcById[id].author.split(' (')[0]}${srcById[id].year ? ', ' + srcById[id].year : ''}` : id)).join('; ') }) : ''}` })),
    el('span', { class: `badge${d.confidence === 'low' ? ' warn' : ''}`, text: t(`conf.${d.confidence}`) }),
    d.needs_human_review ? el('span', { class: 'badge warn', text: t('badge.review') }) : null,
    d.period.end === null ? el('span', { class: 'badge live', text: t('badge.active') }) : el('span', { class: 'badge', text: t('badge.resolved') }));

  // стороны
  const seen = new Set();
  const claimants = el('ul', { class: 'plain' });
  for (const c of d.claimants) {
    const key = `${c.actor}|${c.from}|${c.to}`; if (seen.has(key)) continue; seen.add(key);
    claimants.append(el('li', {}, actorLink(c.actor), ' ',
      el('span', { class: 'muted small', text: `${formatRange(c.from, c.to, lang)}${c.claim_type === 'special_rights' ? ' · ' + t('card.rights') : ''}` }),
      c.basis ? el('div', { class: 'small', text: tx(c.basis) }) : null));
  }

  // контроль на дату по зонам
  const control = visUnits.length
    ? el('ul', { class: 'plain' }, visUnits.map((u) => {
        const ext = u.external.filter((e) => activeAt(e, ref));
        return el('li', {}, multi ? el('strong', { text: `${tx(u.name)}: ` }) : null, controllerText(u, ref, actors),
          ext.length ? el('div', { class: 'small muted', text: `${t('card.external')}: ${ext.map((e) => actorName(e.state, actors)).join(', ')} — ${ext.map((e) => tx(e.basis)).join('; ')}` }) : null);
      }))
    : el('p', { class: 'muted', text: t('card.control.none') });

  // история: события + смены контроля
  const events = (d.history || []).map((h) => ({ date: h.date, text: tx(h.text), src: h.source_ids, kind: h.kind || 'event' }));
  const historyList = events.length
    ? el('ol', { class: 'history' }, events.map((e) => el('li', { class: `h-${e.kind}` },
        el('time', { text: formatDate(e.date, lang) }),
        el('p', {}, e.text, ' ', refs(e.src, srcIndex, d.id)))))
    : el('p', { class: 'muted', text: t('card.history.none') });
  const controlTimeline = el('ul', { class: 'control-tl' }, allUnits.flatMap((u) => u.controllers.map((c) =>
    el('li', {}, el('span', { class: 'muted', text: `${formatRange(c.from, c.to, lang)}` }), ' — ',
      multi ? `${tx(u.name)}: ` : '', el('strong', { text: actorName(c.state, actors) }), c.control === 'partial' ? ` (${t('card.partial')})` : '', ' ', refs(c.source_ids, srcIndex, d.id)))));

  const positions = el('div', { class: 'positions' }, d.positions.map((p) => el('div', { class: 'position' },
    el('h4', { text: actorName(p.actor, actors) }),
    el('p', {}, tx(p.text), ' ', refs(p.source_ids, srcIndex, d.id)))));

  const intl = d.international_position ? el('div', { class: 'position intl' }, el('h4', { text: t('card.international') }),
    el('p', {}, tx(d.international_position.text), ' ', refs(d.international_position.source_ids, srcIndex, d.id))) : null;

  const sources = el('ol', { class: 'sources' }, d.sources.map((s) => el('li', { id: `src-${d.id}-${s.id}` },
    s.url ? el('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer', text: s.title }) : el('span', { text: s.title }),
    el('span', { class: 'src-meta', text: ` — ${sourceLabel(s)}; ${s.type}; ${t('card.perspective')}: ${s.perspective}${s.page_or_article ? '; ' + s.page_or_article : ''}; ${s.verified_fulltext ? t('card.verified') : t('card.notverified')}` }))));

  const geom = allUnits.map((u) => {
    const g = geometryMeta[u.area_id];
    return g ? el('li', { class: 'small' }, multi ? `${tx(u.name)}: ` : '', `${t(`geom.${g.quality}`)} — ${g.source}`, g.note ? el('div', { class: 'muted', text: g.note }) : null) : null;
  }).filter(Boolean);

  const review = (d.review.conflicts.length || d.review.notes.length)
    ? el('details', { class: 'more review' }, el('summary', { text: t('card.review') }),
        el('ul', {}, [...d.review.conflicts, ...d.review.notes].map((x) => el('li', { class: 'small', text: x }))))
    : null;

  const overview = [
    el('p', { class: 'lead', text: tx(d.summary) }),
    el('h3', { text: t('card.control', { date: formatMonth(T, lang) }) }), control,
    el('h3', { text: t('card.parties') }), claimants,
    d.alt_names.length ? [el('h3', { text: t('card.alt') }), el('p', { class: 'small', text: d.alt_names.map((a) => a.name).join(' · ') })] : null,
    geom.length ? [el('h3', { text: t('card.geometry') }), el('ul', { class: 'plain' }, geom)] : null,
  ];
  const history = [historyList, el('h3', { text: t('card.timeline') }), controlTimeline];
  const law = [el('h3', { text: t('card.legal') }), el('p', { text: tx(d.legal_status) }), intl, el('h3', { text: t('card.positions') }), positions];
  const srcPane = [sources, review];

  fill(card,
    cardHead({ eyebrow: `${t('card.eyebrow')} · ${t(`type.${d.type}`)}`, title: tx(d.name), sub: tx(d.territory), onClose, extra: badges }),
    kv([[t('card.period'), formatRange(d.period.start_date || d.period.start, d.period.end_date || d.period.end, lang)],
        [t('card.control.short'), visUnits.length ? visUnits.map((u) => controllerText(u, ref, actors)).filter((v, i, a) => a.indexOf(v) === i).join('; ') : t('card.control.none')]]),
    ...tabs(d.id, [
      { key: 'overview', label: t('card.tab.overview'), body: overview },
      { key: 'history', label: t('card.tab.history'), body: history },
      { key: 'law', label: t('card.tab.law'), body: law },
      { key: 'sources', label: t('card.tab.sources', { n: d.sources.length }), body: srcPane },
    ]));
  card.hidden = false;
}

// ---------------------------------------------------------------- карточка конфликта
export function conflictTitle(c, gwName) {
  if (c.name) return tx(c.name);
  const loc = (c.loc || []).map((g) => gwName(g)).filter(Boolean).join(', ');
  if (c.kind === 'interstate') {
    const a = c.parts.filter((p) => p.side === 0 && p.role === 1 && p.g).map((p) => gwName(p.g));
    const b = c.parts.filter((p) => p.side === 1 && p.role === 1 && p.g).map((p) => gwName(p.g));
    return `${[...new Set(a)].join(', ')} — ${[...new Set(b)].join(', ')}`;
  }
  const what = c.inc === 'territory' && c.terr ? c.terr : t(`war.inc.${c.inc || 'government'}`);
  return `${loc}: ${what}`;
}

export function kindAt(c, T) {
  if (!c.ky) return c.kind;
  let k = c.ky[0][1];
  for (const [y, kk] of c.ky) if (y <= T.y) k = kk;
  return k;
}

export function renderConflictCard(card, { c, T, gwName, onCountry, onClose }) {
  const lang = getLang();
  const at = c.parts.filter((p) => p.from <= T.to && p.to >= T.from);
  const unverified = at.length && at.every((p) => p.unverified);
  const int = Math.max(0, ...at.map((p) => p.int || 0));
  const sideList = (side) => {
    const rows = new Map();
    const src = at.length ? at : c.parts;
    for (const p of src.filter((x) => x.side === side)) {
      const key = p.g ? `g${p.g}` : `n${p.name}`;
      if (!rows.has(key) || p.role < rows.get(key).role) rows.set(key, p);
    }
    return el('ul', { class: 'plain side-list' }, [...rows.values()].sort((a, b) => a.role - b.role).map((p) => el('li', {},
      p.g ? el('button', { type: 'button', class: 'linklike', onclick: () => onCountry(p.g), text: gwName(p.g) }) : el('span', { text: p.name }),
      p.role === 2 ? el('span', { class: 'muted small', text: ` · ${t('war.secondary.short')}` }) : null)));
  };
  const yrs = yearsOf(c);
  const y0 = yrs.length ? yrs[0][0] : T.y, y1 = yrs.length ? yrs[yrs.length - 1][0] : T.y;
  const spark = el('div', { class: 'spark', role: 'img', 'aria-label': t('war.spark.label', { a: y0, b: y1 }) },
    yrs.map(([y, i]) => el('span', { class: `bar i${i}${y === T.y ? ' now' : ''}`, title: `${y}: ${t(`war.int.${i}`)}`, style: `height:${i === 2 ? 100 : 55}%` })));
  fill(card,
    cardHead({ eyebrow: `${t('war.eyebrow')} · ${t(`war.kind.${kindAt(c, T)}`)}`, title: conflictTitle(c, gwName),
      sub: c.inc ? t(`war.inc.long.${c.inc}`) + (c.terr ? `: ${c.terr}` : '') : null, onClose }),
    kv([[t('war.period'), formatRange(c.start, c.end, lang)],
        [t('war.int.now', { date: formatMonth(T, lang) }), at.length ? (unverified ? t('war.unverified', { int: t(`war.int.${int}`) }) : t(`war.int.${int}`)) : t('war.inactive')],
        [t('war.source'), el('span', {}, t(`war.src.${c.src}`), c.url ? [' · ', el('a', { href: c.url, target: '_blank', rel: 'noopener noreferrer' }, t('war.src.open'), icon('ext', 'tiny'))] : null)]]),
    el('div', { class: 'sides' },
      el('section', { class: 'side' }, el('h3', { text: t('war.sideA') }), sideList(0)),
      el('section', { class: 'side' }, el('h3', { text: t('war.sideB') }), sideList(1))),
    yrs.length > 1 ? el('section', { class: 'sec' }, el('h3', { text: t('war.spark', { a: y0, b: y1 }) }), spark) : null,
    c.note ? el('p', { class: 'small muted', text: tx(c.note) }) : null,
    c.sources?.length ? el('section', { class: 'sec' }, el('h3', { text: t('card.sources') }), el('ol', { class: 'sources' },
      c.sources.map((s) => el('li', {}, el('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer', text: s.title }), el('span', { class: 'src-meta', text: ` — ${sourceLabel(s)}` }))))) : null,
    c.src !== 'manual' && c.sources?.length ? el('p', { class: 'small muted', text: t('war.method.edited') }) : null,
    el('p', { class: 'small muted', text: t(`war.method.${c.src}`) }));
  card.hidden = false;
}
