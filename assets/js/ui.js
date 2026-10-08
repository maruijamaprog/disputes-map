// Панель: легенда, фильтры, список-заменитель карты, карточки спора и стороны, подсказка.
import { t, tx, getLang } from './i18n.js';
import { units, controllersAt, actorSummary, unitVisible, partiesInYear } from './roles.js';
import { refDate, formatRef, formatDate, activeAt } from './time.js';
import { patternDataURL } from './map.js';

export function el(tag, attrs = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) n.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return n;
}

export const TYPES = ['sovereignty', 'occupation', 'secession', 'maritime', 'demarcation', 'decolonization', 'other'];

export function actorName(code, actors, fallback) {
  const a = actors[code];
  if (a) return a[getLang()] || a.ru;
  return fallback || code;
}

// ---------------------------------------------------------------- легенда
export function renderLegend(root) {
  root.replaceChildren();
  const sw = (kind) => el('span', { class: 'swatch', style: `background-image:url(${patternDataURL(kind)})`, 'aria-hidden': 'true' });
  root.append(
    el('li', {}, el('span', { class: 'swatch', style: 'background:var(--role-a);opacity:.75', 'aria-hidden': 'true' }), t('legend.A')),
    el('li', {}, sw('B'), t('legend.B')),
    el('li', {}, sw('C'), t('legend.C')),
    el('li', {}, sw('D'), t('legend.D')),
    el('li', {}, sw('E'), t('legend.E')),
    el('li', {}, sw('R'), t('legend.R')),
    el('li', {}, sw('N'), t('legend.N')),
    el('li', {}, el('span', { class: 'swatch line', 'aria-hidden': 'true' }), t('legend.changed')),
    el('li', {}, el('span', { class: 'swatch dot', 'aria-hidden': 'true' }), t('legend.marker')),
  );
}

// ---------------------------------------------------------------- фильтры
export function renderTypeFilters(root, filters, onChange) {
  root.replaceChildren();
  for (const ty of TYPES) {
    const id = `f-type-${ty}`;
    const cb = el('input', { type: 'checkbox', id, checked: filters.types.has(ty) });
    cb.addEventListener('change', () => { cb.checked ? filters.types.add(ty) : filters.types.delete(ty); onChange(); });
    root.append(el('label', { for: id }, cb, ' ', t(`type.${ty}`)));
  }
}

// ---------------------------------------------------------------- подсказка
export function showTooltip(tip, point, html) {
  tip.replaceChildren(...html);
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
export function buildOptions(year, disputes, actors, query) {
  const q = (query || '').trim().toLowerCase();
  const actorSet = new Map();
  for (const d of disputes) for (const u of units(d)) if (unitVisible(u, year)) {
    for (const code of partiesInYear(u, year)) actorSet.set(code, (actorSet.get(code) || new Set()).add(d.id));
  }
  const actorOpts = [...actorSet.entries()]
    .map(([code, ds]) => ({ kind: 'actor', id: code, label: actorName(code, actors), meta: String(ds.size) }))
    .filter((o) => !q || o.label.toLowerCase().includes(q) || o.id.toLowerCase().includes(q))
    .sort((a, b) => a.label.localeCompare(b.label, getLang()));
  const dispOpts = disputes
    .map((d) => ({ kind: 'dispute', id: d.id, label: tx(d.name), meta: `${d.period.start ?? '…'}–${d.period.end ?? ''}`, alt: (d.alt_names || []).map((a) => a.name).join(' ') }))
    .filter((o) => !q || o.label.toLowerCase().includes(q) || o.alt.toLowerCase().includes(q))
    .sort((a, b) => a.label.localeCompare(b.label, getLang()));
  return { actorOpts, dispOpts };
}

export function renderList(listbox, { actorOpts, dispOpts }, activeKey) {
  listbox.replaceChildren();
  const add = (title, opts) => {
    if (!opts.length) return;
    listbox.append(el('li', { class: 'group', role: 'presentation', text: title }));
    for (const o of opts) {
      const key = `${o.kind}:${o.id}`;
      listbox.append(el('li', { role: 'option', id: `opt-${o.kind}-${o.id}`, 'data-key': key, 'aria-selected': key === activeKey ? 'true' : 'false' },
        el('span', { text: o.label }), el('span', { class: 'meta', text: o.meta })));
    }
  };
  add(t('list.actors'), actorOpts);
  add(t('list.disputes'), dispOpts);
  if (!actorOpts.length && !dispOpts.length) listbox.append(el('li', { class: 'group', role: 'presentation', text: t('list.empty') }));
}

// ---------------------------------------------------------------- карточка стороны
export function renderActorCard(card, { code, unitName, year, disputes, actors, onOpenDispute, onClose }) {
  const name = code ? actorName(code, actors, unitName) : unitName;
  const sum = code ? actorSummary(code, year, disputes) : [];
  card.replaceChildren(...[
    el('div', { class: 'card-head' },
      el('h2', { tabindex: '-1', text: t('actor.title', { name, year }) }),
      el('button', { type: 'button', class: 'close', 'aria-label': t('card.close'), onclick: onClose, text: '×' })),
    unitName && code && unitName !== name ? el('p', { class: 'muted small', text: t('actor.unit', { name: unitName }) }) : null,
    sum.length
      ? el('ul', {}, sum.map(({ dispute, roles }) => el('li', {},
          el('a', { href: `#d=${dispute.id}`, onclick: (e) => { e.preventDefault(); onOpenDispute(dispute.id); }, text: tx(dispute.name) }),
          ' ', [...new Set(roles.map((r) => r.role))].map((r) => el('span', { class: `role-chip ${r}`, text: t(`role.${r}`) })))))
      : el('p', { class: 'muted', text: t('actor.none', { year }) }),
  ].filter(Boolean));
  card.hidden = false;
}

// ---------------------------------------------------------------- карточка спора
function sourceLabel(s) {
  const parts = [s.author, s.year ? String(s.year) : null].filter(Boolean).join(', ');
  return parts;
}

export function renderDisputeCard(card, { d, year, actors, geometryMeta, onClose, onActor }) {
  const lang = getLang();
  const ref = refDate(year);
  const srcById = Object.fromEntries(d.sources.map((s) => [s.id, s]));
  const visUnits = units(d).filter((u) => unitVisible(u, year));
  const actorLink = (code) => el('a', { href: `#a=${code}`, onclick: (e) => { e.preventDefault(); onActor(code); }, text: actorName(code, actors) });

  const badges = el('div', { class: 'badges' },
    el('span', { class: 'badge', text: t(`type.${d.type}`) }),
    d.secondary_types.map((s) => el('span', { class: 'badge', text: `${t(`type.${s.type}`)}${s.qualified_by.length ? ' · ' + t('card.qualified', { src: s.qualified_by.map((id) => srcById[id]?.title.split('.')[0] || id).join('; ') }) : ''}` })),
    el('span', { class: `badge${d.confidence === 'low' ? ' warn' : ''}`, text: t(`conf.${d.confidence}`) }),
    d.needs_human_review ? el('span', { class: 'badge warn', text: t('badge.review') }) : null,
  );

  // стороны
  const claimants = [];
  const seen = new Set();
  for (const c of d.claimants) {
    const key = `${c.actor}|${c.from}|${c.to}`; if (seen.has(key)) continue; seen.add(key);
    claimants.push(el('li', {}, actorLink(c.actor), ' ',
      el('span', { class: 'muted', text: `${formatDate(c.from, lang)}–${formatDate(c.to, lang)}${c.claim_type === 'special_rights' ? ' · ' + t('card.rights') : ''}` }),
      c.basis ? el('div', { class: 'small muted', text: tx(c.basis) }) : null));
  }

  // контроль на дату по зонам
  const control = visUnits.length
    ? el('ul', {}, visUnits.map((u) => {
        const ext = u.external.filter((e) => activeAt(e, ref));
        return el('li', {}, units(d).length > 1 ? el('strong', { text: `${tx(u.name)}: ` }) : null, controllerText(u, ref, actors),
          ext.length ? el('div', { class: 'small muted', text: `${t('card.external')}: ${ext.map((e) => actorName(e.state, actors)).join(', ')} — ${ext.map((e) => tx(e.basis)).join('; ')}` }) : null);
      }))
    : el('p', { class: 'muted', text: t('card.control.none') });

  // хронология
  const timeline = el('ul', {}, units(d).flatMap((u) => u.controllers.map((c) =>
    el('li', {}, units(d).length > 1 ? `${tx(u.name)}: ` : '', `${formatDate(c.from, lang)} – ${formatDate(c.to, lang)}: `, actorName(c.state, actors), c.control === 'partial' ? ` (${t('card.partial')})` : ''))));

  const positions = el('div', {}, d.positions.map((p) => el('div', {},
    el('h4', { class: 'small', style: 'margin:8px 0 2px', text: actorName(p.actor, actors) }),
    el('p', { text: tx(p.text) }),
    el('p', { class: 'small muted', text: p.source_ids.map((id) => srcById[id] ? `[${d.sources.indexOf(srcById[id]) + 1}]` : id).join(' ') }))));

  const intl = d.international_position ? el('div', {}, el('p', { text: tx(d.international_position.text) }),
    el('p', { class: 'small muted', text: d.international_position.source_ids.map((id) => `[${d.sources.indexOf(srcById[id]) + 1}]`).join(' ') })) : null;

  const sources = el('ol', { class: 'sources' }, d.sources.map((s) => el('li', { id: `src-${d.id}-${s.id}` },
    s.url ? el('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer', text: s.title }) : s.title,
    el('span', { class: 'src-meta', text: ` — ${sourceLabel(s)}; ${s.type}; ${t('card.perspective')}: ${s.perspective}${s.page_or_article ? '; ' + s.page_or_article : ''}; ${s.verified_fulltext ? t('card.verified') : t('card.notverified')}` }))));

  const geom = units(d).map((u) => {
    const g = geometryMeta[u.area_id];
    return g ? el('li', { class: 'small' }, units(d).length > 1 ? `${tx(u.name)}: ` : '', `${t(`geom.${g.quality}`)} — ${g.source}`, g.note ? el('div', { class: 'muted', text: g.note }) : null) : null;
  }).filter(Boolean);

  const review = (d.review.conflicts.length || d.review.notes.length)
    ? el('details', { class: 'review' }, el('summary', { text: t('card.review') }),
        el('ul', {}, [...d.review.conflicts, ...d.review.notes].map((x) => el('li', { class: 'small', text: x }))))
    : null;

  card.replaceChildren(...[
    el('div', { class: 'card-head' },
      el('h2', { tabindex: '-1', text: tx(d.name) }),
      el('button', { type: 'button', class: 'close', 'aria-label': t('card.close'), onclick: onClose, text: '×' })),
    el('p', { class: 'muted small', text: tx(d.territory) }),
    d.alt_names.length ? el('p', { class: 'small' }, el('span', { class: 'muted', text: `${t('card.alt')}: ` }), d.alt_names.map((a) => a.name).join(' · ')) : null,
    badges,
    el('dl', { class: 'facts' },
      el('dt', { text: t('card.period') }), el('dd', { text: `${d.period.start ?? '…'} – ${d.period.end ?? formatDate(null, lang)}` })),
    el('h3', { text: t('card.control', { date: formatRef(ref, lang) }) }), control,
    el('h3', { text: t('card.parties') }), el('ul', {}, claimants),
    el('h3', { text: t('card.summary') }), el('p', { text: tx(d.summary) }),
    el('h3', { text: t('card.legal') }), el('p', { text: tx(d.legal_status) }),
    intl ? el('h3', { text: t('card.international') }) : null, intl,
    el('h3', { text: t('card.positions') }), positions,
    el('h3', { text: t('card.timeline') }), timeline,
    geom.length ? el('h3', { text: t('card.geometry') }) : null, geom.length ? el('ul', {}, geom) : null,
    el('h3', { text: t('card.sources') }), sources,
    review,
  ].filter(Boolean));
  card.hidden = false;
}
