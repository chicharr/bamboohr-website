import { getMetadata, lookupPages } from '../../scripts/scripts.js';
import { createBlogCard } from '../featured-articles/featured-articles.js';
import { createAppCard } from '../app-cards/app-cards.js';
import { createResourceCard } from '../resources-library/resources-library.js';

function highlightTextElements(terms, elements) {
  elements.forEach((e) => {
    const matches = [];
    const text = e.textContent;
    const offset = text.toLowerCase().indexOf(terms);
    if (offset >= 0) {
      matches.push({ offset, terms });
    }
    matches.sort((a, b) => a.offset - b.offset);
    let markedUp = '';
    if (!matches.length) {
      markedUp = text;
    } else {
      markedUp = text.substr(0, matches[0].offset);
      matches.forEach((hit, i) => {
        markedUp += `<mark class="search-highlight">${text.substr(hit.offset, hit.terms.length)}</mark>`;
        if (matches.length - 1 === i) {
          markedUp += text.substr(hit.offset + hit.terms.length);
        } else {
          markedUp += text.substring(hit.offset + hit.terms.length, matches[i + 1].offset);
        }
      });
      if (e.closest('span') && terms) e.closest('span').classList.add('search-searchtag-highlighted');
      e.innerHTML = markedUp;
    }
  });
}

async function displaySearchResults(terms, results) {
  let collection = 'blog';
  if (getMetadata('theme') === 'integrations') collection = 'integrations';
  if (getMetadata('theme') === 'resources') collection = 'resources';
  await lookupPages([], collection);
  const allPages = window.pageIndex[collection].data;
  allPages.forEach((page) => {
    let searchTags = '';
    if (collection === 'integrations') {
      searchTags = `${page.level}, ${page.tag}, ${page.category}, ${page.partnerConnectionLibrary}`;
    }
    if (collection === 'blog') {
      searchTags = `${page.tags}`;
    }
    if (collection === 'resources') {
      searchTags = `${page.title}, ${page.category}, ${page.description}`;
    }
    page.searchTags = searchTags;
  });
  results.innerHTML = '<ul></ul>';
  const ul = results.children[0];
  const filtered = allPages.filter((e) => e.title.toLowerCase().includes(terms.toLowerCase())
    || e.description.toLowerCase().includes(terms.toLowerCase())
    || e.searchTags.toLowerCase().includes(terms.toLowerCase()));
  

  if  (collection === 'integrations' && filtered.length) {
    const hasIndirectIntegrationOnly = filtered.every((listing) => listing.partnerConnectionLibrary.toLowerCase().includes(terms.toLowerCase()));
    
    if (hasIndirectIntegrationOnly === true) {
      const msg = document.createElement('p');
      msg.className = 'search-results-msg';
      msg.textContent = 'We don’t offer a direct integration for the provider you’ve searched for, but don’t worry! You can access that integration through one of our integration platform partners below.';
      ul.before(msg);
    }
  }
  
  filtered.forEach((row) => {
    let card;
    if (collection === 'blog') card = createBlogCard(row, 'search-blog');
    if (collection === 'integrations') card = createAppCard(row, 'search-app');
    if (collection === 'resources') card = createResourceCard(row, 'resource');
    ul.append(card);
  });

  highlightTextElements(terms, results.querySelectorAll('h3, p:first-of-type, span'));
  results.querySelectorAll(('span.search-searchtag-highlighted')).forEach((span) => {
    span.addEventListener('click', () => {
      const searchBox = results.closest('.block').querySelector('#search-box');
      searchBox.value = span.textContent;
      displaySearchResults(searchBox.value.toLowerCase(), results);
    });
  });
}

export default async function decorate(block) {
  block.innerHTML = `<div class="search-box"><input id="search-box" type="text" placeholder="${block.textContent.trim()}"></div>
    <div class="search-results"></div>`;
  const searchBox = block.querySelector('#search-box');
  const results = block.querySelector('.search-results');
  results.setAttribute('am-region', 'Search');
  searchBox.addEventListener('input', () => {
    displaySearchResults(searchBox.value.toLowerCase(), results);
  });
}
