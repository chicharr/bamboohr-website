import { createElem, readBlockConfig } from '../../scripts/scripts.js';

function handleActive(block, id) {
  const link = block.querySelector(`a[href="${id}"]`);

  // skip if empty
  if (!link) return;

  // clear all actives, add active
  block.querySelectorAll('.active').forEach((active) => active.classList.remove('active'));

  // skip if not t1
  // if (+link.closest('ol').dataset.level !== 1) return;

  // add class
  link.parentNode.classList.add('active');
}

function handleScroll(event) {
  const id = event.target.getAttribute('href');
  const heading = document.querySelector(id);

  // skip if empty
  if (!heading) return;

  // do the scroll
  window.scrollTo({
    behavior: 'smooth',
    top: heading.offsetTop - 100,
  });

  // trigger active functionality
  handleActive(event.target.closest('.block'), id);

  // stop normal jump, manually set hash
  event.preventDefault();
  window.history.pushState(null, null, id);
}

function buildNav(levels = 2) {
  const headings = [...document.querySelectorAll('.default-content-wrapper, .title-wrapper')]
    .map((wrapper) => [...wrapper.querySelectorAll('h2, h3, h4, h5, h6')])
    .flat();

  // create list
  const nav = document.createElement('nav');
  nav.ariaLabel = 'Page';
  nav.role = 'navigation';
  let listLevel = 0;
  let listOl = nav;
  let lastLi = nav;
  headings.forEach((heading) => {
    let level = +heading.tagName.slice(-1) - 1;

    // skip
    if (level > levels) return;

    // get link
    const li = createElem('li');
    const a = createElem('a');
    a.href = `#${heading.id}`;
    a.textContent = heading.textContent;
    a.addEventListener('click', handleScroll);
    li.append(a);

    if (level === listLevel) {
      listOl.appendChild(li);
      lastLi = li;
    } else if (level > listLevel) {
      listLevel = level;
      const ol = document.createElement('ol');
      ol.dataset.level = `${level}`; // store the level in a property
      ol.appendChild(li);
      lastLi.appendChild(ol);
      listOl = ol;
      lastLi = li;
    } else if (level < listLevel) {
      listOl = nav.querySelector(`ol[data-level="${level}"]`);
      level = +listOl.dataset.level;
      listOl.appendChild(li);
      lastLi = li;
      listLevel = level;
    }
  });

  return nav;
}

function overrideList(block, items, tier) {
  // loop 'em
  items.forEach((item, key) => {
    const sublist = item.querySelector('ol');

    // text
    let text = null;
    [...item.childNodes].forEach((node) => {
      // skip if not a text node
      if (node.nodeType !== Node.TEXT_NODE) return;

      // skip if empty text
      if (node.textContent.trim() === '' || node.textContent.trim() === '-') return;

      text = node.textContent.trim();
    });

    // icon
    const icon = item.querySelector(':scope > span.icon');

    // find matching item
    const matchLi = block.querySelector(
      `nav ol[data-level="${tier + 1}"] > li:nth-child(${key + 1})`
    );

    if (text) matchLi.querySelector(':scope > a').textContent = text;
    if (icon) {
      matchLi.classList.add('has-icon');
      matchLi.prepend(icon);
    }

    // recurse
    if (sublist) overrideList(block, [...sublist.children], tier + 1);
  });
}

export default function decorate(block) {
  const { levels } = readBlockConfig(block);

  const overrides = block.querySelector('ol');
  const ctas = createElem('div', 'ctas');
  [...block.querySelectorAll('.button-container')]
    .map((buttons) => buttons.querySelector('a.button'))
    .forEach((cta) => ctas.append(cta));

  block.innerText = '';
  const nav = buildNav(levels);
  block.append(nav);

  // do overrides
  overrideList(block, [...overrides.children], 0);

  // ctas
  if (ctas.children.length > 0) block.append(ctas);

  // hash
  if (window.location.hash !== '') handleActive(block, window.location.hash);
}
