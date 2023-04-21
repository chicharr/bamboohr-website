/*
 * Copyright 2021 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

const AUDIENCES_CONFIG = {
  audiences: {
    'is-customer': {
      label: 'Is a Customer',
      test: () => {
        // eslint-disable-next-line no-use-before-define
        const features = getBhrFeaturesCookie();
        return features && features.is_admin && !features.bhr_user;
      },
    },
    'not-customer': {
      label: 'Is not a Customer',
      test: () => {
        // eslint-disable-next-line no-use-before-define
        const features = getBhrFeaturesCookie();
        return !features || !(features.is_admin && !features.bhr_user);
      },
    },
    'mobile': {
      label: 'Mobile',
      test: () => {
        return window.innerWidth < 600;
      },
    },
    'desktop': {
      label: 'Desktop',
      test: () => {
        return window.innerWidth >= 600;
      },
    },
  },
};

/*
 * this is an extensible stub to take on audience mappings
 * @param {string} audience
 * @return {boolean} is member of this audience
*/
export function isValidAudience(audience) {
 const configuredAudience = AUDIENCES_CONFIG.audiences[audience];
 return configuredAudience && configuredAudience.test();
}

/**
 * Gets the value for the specific cookie
 * @param {string} name The name of the cookie
 * @returns {string} the cookie value, or null
 */
function readCookie(name) {
  const [value] = document.cookie
    .split('; ')
    .filter((cookieString) => cookieString.split('=')[0] === name)
    .map((cookieString) => cookieString.split('=')[1]);
  return value || null;
}

/**
 * Gets the BHR Features from the cookie
 * @returns {object} the BHR features, or an empty object
 */
function getBhrFeaturesCookie() {
  const value = readCookie('bhr_features');
  try {
  	const decryptedValue = atob(value);
    return JSON.parse(decryptedValue);
  } catch (err1) {
	  try{
		  return JSON.parse(value);
	  } catch (err2) {
		  return {};
	  }
  }
}

/**
 * log RUM if part of the sample.
 * @param {string} checkpoint identifies the checkpoint in funnel
 * @param {Object} data additional data for RUM sample
 */
export function sampleRUM(checkpoint, data = {}) {
  sampleRUM.defer = sampleRUM.defer || [];
  const defer = (fnname) => {
    sampleRUM[fnname] = sampleRUM[fnname] || ((...args) => sampleRUM.defer.push({ fnname, args }));
  };
  sampleRUM.drain =
    sampleRUM.drain ||
    ((dfnname, fn) => {
      sampleRUM[dfnname] = fn;
      sampleRUM.defer
        .filter(({ fnname }) => dfnname === fnname)
        .forEach(({ fnname, args }) => sampleRUM[fnname](...args));
    });
  sampleRUM.always = sampleRUM.always || [];
  sampleRUM.always.on = (chkpnt, fn) => {
    sampleRUM.always[chkpnt] = fn;
  };
  sampleRUM.on = (chkpnt, fn) => {
    sampleRUM.cases[chkpnt] = fn;
  };
  defer('observe');
  defer('cwv');
  defer('convert');
  try {
    window.hlx = window.hlx || {};
    if (!window.hlx.rum) {
      const usp = new URLSearchParams(window.location.search);
      const weight = usp.get('rum') === 'on' ? 1 : 100; // with parameter, weight is 1. Defaults to 100.
      // eslint-disable-next-line no-bitwise
      const hashCode = (s) => s.split('').reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0);
      const id = `${hashCode(window.location.href)}-${new Date().getTime()}-${Math.random()
        .toString(16)
        .substr(2, 14)}`;
      const random = Math.random();
      const isSelected = random * weight < 1;
      // eslint-disable-next-line object-curly-newline
      window.hlx.rum = { weight, id, random, isSelected, sampleRUM };
    }
    const { weight, id } = window.hlx.rum;
    if (window.hlx && window.hlx.rum && window.hlx.rum.isSelected) {
      const sendPing = (pdata = data) => {
        // eslint-disable-next-line object-curly-newline, max-len, no-use-before-define
        const body = JSON.stringify(
          {
            weight,
            id,
            referer: window.location.href,
            generation: window.hlx.RUM_GENERATION,
            checkpoint,
            ...data,
          },
          (key, value) => (key === 'element' ? undefined : value)
        );
        const url = `https://rum.hlx.page/.rum/${weight}`;
        // eslint-disable-next-line no-unused-expressions
        navigator.sendBeacon(url, body);
        // eslint-disable-next-line no-console
        console.debug(`ping:${checkpoint}`, pdata);
      };
      sampleRUM.cases = sampleRUM.cases || {
        cwv: () => sampleRUM.cwv(data) || true,
        lazy: () => {
          // use classic script to avoid CORS issues
          const script = document.createElement('script');
          script.src = 'https://rum.hlx.page/.rum/@adobe/helix-rum-enhancer@^1/src/index.js';
          document.head.appendChild(script);
          return true;
        },
      };
      sendPing(data);
      if (sampleRUM.cases[checkpoint]) {
        sampleRUM.cases[checkpoint]();
      }
    }
    if (sampleRUM.always[checkpoint]) {
      sampleRUM.always[checkpoint](data);
    }
  } catch (error) {
    // something went wrong
  }
}

/**
 * Loads a CSS file.
 * @param {string} href The path to the CSS file
 */
export function loadCSS(href, callback) {
  if (!document.querySelector(`head > link[href="${href}"]`)) {
    const link = document.createElement('link');
    link.setAttribute('rel', 'stylesheet');
    link.setAttribute('href', href);
    if (typeof callback === 'function') {
      link.onload = (e) => callback(e.type);
      link.onerror = (e) => callback(e.type);
    }
    document.head.appendChild(link);
  } else if (typeof callback === 'function') {
    callback('noop');
  }
}

/**
 * Retrieves the content of a metadata tag.
 * @param {string} name The metadata name (or property)
 * @returns {string} The metadata value
 */
export function getMetadata(name) {
  const attr = name && name.includes(':') ? 'property' : 'name';
  const meta = document.head.querySelector(`meta[${attr}="${name}"]`);
  return meta && meta.content;
}

/**
 * Sanitizes a name for use as class name.
 * @param {string} name The unsanitized name
 * @returns {string} The class name
 */
export function toClassName(name) {
  return name && typeof name === 'string' ? name.toLowerCase().replace(/[^0-9a-z]/gi, '-') : '';
}

/**
 * Loads a template specific CSS file.
 */
function loadTemplateCSS() {
  const template = toClassName(getMetadata('template'));
  if (template) {
    const templates = [
      'bhr-comparison',
      'bhr-home',
      'ee-solution',
      'hr-glossary',
      'hr-software',
      'hr-software-payroll',
      'hr-unplugged',
      'hrvs-listing',
      'industry',
      'industry-category',
      'live-demo-webinars',
      'payroll-roi',
      'performance-reviews',
      'pricing-quote',
      'content-library',
      'webinar',
      'paid-landing-page',
      'product-updates',
      'live-demo-webinar-lp',
      'hr-101-guide'
    ];
    if (templates.includes(template)) {
      const cssBase = `${window.hlx.serverPath}${window.hlx.codeBasePath}`;
      loadCSS(`${cssBase}/styles/templates/${template}.css`);
    }
  }
}

/**
 * Adds one or more URLs to the dependencies for publishing.
 * @param {string|[string]} url The URL(s) to add as dependencies
 */
export function addPublishDependencies(url) {
  const urls = Array.isArray(url) ? url : [url];
  window.hlx = window.hlx || {};
  if (window.hlx.dependencies && Array.isArray(window.hlx.dependencies)) {
    window.hlx.dependencies = window.hlx.dependencies.concat(urls);
  } else {
    window.hlx.dependencies = urls;
  }
}

/*
 * Sanitizes a name for use as a js property name.
 * @param {string} name The unsanitized name
 * @returns {string} The camelCased name
 */
export function toCamelCase(name) {
  return toClassName(name).replace(/-([a-z])/g, (g) => g[1].toUpperCase());
}

/**
 * Replace icons with inline SVG and prefix with codeBasePath.
 * @param {Element} element
 */
function replaceIcons(element) {
  element.querySelectorAll('img.icon').forEach((img) => {
    const span = document.createElement('span');
    span.className = img.className;
    img.replaceWith(span);
  });
}

/**
 * Replace icons with inline SVG and prefix with codeBasePath.
 * @param {Element} element
 */
export function decorateIcons(element) {
  // prepare for forward compatible icon handling
  replaceIcons(element);

  const fetchBase = window.hlx.serverPath;
  element.querySelectorAll('span.icon').forEach((span) => {
    const iconName = span.className.split('icon-')[1];
    fetch(`${fetchBase}${window.hlx.codeBasePath}/icons/${iconName}.svg`).then((resp) => {
      if (resp.status === 200)
        resp.text().then((svg) => {
          const parent = span.firstElementChild?.tagName === 'A' ? span.firstElementChild : span;
          parent.innerHTML = svg;
        });
    });
  });
}

/**
 * Gets placeholders object
 * @param {string} prefix
 */
export async function fetchPlaceholders(prefix = 'default') {
  window.placeholders = window.placeholders || {};
  const loaded = window.placeholders[`${prefix}-loaded`];
  if (!loaded) {
    window.placeholders[`${prefix}-loaded`] = new Promise((resolve, reject) => {
      try {
        fetch(`${prefix === 'default' ? '' : prefix}/placeholders.json`)
          .then((resp) => resp.json())
          .then((json) => {
            const placeholders = {};
            json.data.forEach((placeholder) => {
              placeholders[toCamelCase(placeholder.Key)] = placeholder.Text;
            });
            window.placeholders[prefix] = placeholders;
            resolve();
          });
      } catch (e) {
        // error loading placeholders
        window.placeholders[prefix] = {};
        reject();
      }
    });
  }
  await window.placeholders[`${prefix}-loaded`];
  return window.placeholders[prefix];
}

/**
 * Decorates a block.
 * @param {Element} block The block element
 */
export function decorateBlock(block) {
  const trimDashes = (str) => str.replace(/(^\s*-)|(-\s*$)/g, '');
  const classes = Array.from(block.classList.values());
  const blockName = classes[0];
  if (!blockName) return;
  const section = block.closest('.section');
  if (section) {
    section.classList.add(`${blockName}-container`.replace(/--/g, '-'));
  }
  const blockWithVariants = blockName.split('--');
  const shortBlockName = trimDashes(blockWithVariants.shift());
  const variants = blockWithVariants.map((v) => trimDashes(v));
  block.classList.add(shortBlockName);
  block.classList.add(...variants);

  block.classList.add('block');
  block.setAttribute('data-block-name', shortBlockName);
  block.setAttribute('data-block-status', 'initialized');

  const blockWrapper = block.parentElement;
  blockWrapper.classList.add(`${shortBlockName}-wrapper`);

  [...block.classList]
    .filter((filter) => filter.match(/^content-width-/g))
    .forEach((style) => {
      block.parentElement.classList.add(style);
      block.classList.remove(style);
    });
  // eslint-disable-next-line no-use-before-define
  addClassToParent(block);
}

/**
 * Extracts the config from a block.
 * @param {Element} block The block element
 * @returns {object} The block config
 */
export function readBlockConfig(block) {
  const config = {};
  block.querySelectorAll(':scope>div').forEach((row) => {
    if (row.children) {
      const cols = [...row.children];
      if (cols[1]) {
        const col = cols[1];
        const name = toClassName(cols[0].textContent);
        let value = '';
        if (col.querySelector('a')) {
          const as = [...col.querySelectorAll('a')];
          if (as.length === 1) {
            value = as[0].href;
          } else {
            value = as.map((a) => a.href);
          }
        } else if (col.querySelector('p')) {
          const ps = [...col.querySelectorAll('p')];
          if (ps.length === 1) {
            value = ps[0].textContent;
          } else {
            value = ps.map((p) => p.textContent);
          }
        } else value = row.children[1].textContent;
        config[name] = value;
      }
    }
  });
  return config;
}

/**
 * Decorates backgrounds in sections.
 * @param {Element} $section The section element
 */
export function decorateBackgrounds($section) {
  const missingBgs = [
    'bg-bottom-cap-3-tint-laptop',
    'bg-bottom-cap-3-tint-mobile',
    'bg-bottom-cap-3-tint-tablet',
    'bg-top-cap-3-laptop',
    'bg-top-cap-3-mobile',
    'bg-top-cap-3-tablet',
    'bg-top-multi-7',
    'bg-bottom-multi-3',
    'bg-center-multi-3',
    'bg-block-center-page-cta',
    'bg-block-benefits-laptop',
    'bg-block-benefits-tablet',
    'bg-block-benefits-mobile',
    'bg-block-center-left-single-1-laptop',
    'bg-block-center-left-single-1-tablet',
    'bg-block-center-left-single-1-mobile',
    'bg-block-center-left-single-2-laptop',
    'bg-block-center-left-single-2-tablet',
    'bg-block-center-left-single-2-mobile',
    'bg-block-center-right-double-1-laptop',
    'bg-block-center-right-double-1-tablet',
    'bg-block-center-right-single-3-laptop',
    'bg-block-center-right-single-3-tablet',
    'bg-block-center-right-single-3-mobile',
    'bg-block-ee-solutions-quote-laptop',
    'bg-block-ee-solutions-quote-tablet',
    'bg-block-ee-solutions-quote-mobile',
    'bg-bottom-cap-1-laptop',
    'bg-bottom-cap-1-tablet',
    'bg-bottom-cap-1-mobile',
    'bg-bottom-cap-2-laptop',
    'bg-bottom-cap-2-tablet',
    'bg-bottom-cap-2-mobile',
    'bg-bottom-cap-3-laptop',
    'bg-bottom-cap-3-tablet',
    'bg-bottom-cap-3-mobile',
    'bg-cover-green-patterns-laptop',
    'bg-cover-green-patterns-tablet',
    'bg-cover-green-patterns-mobile',
    'bg-left-single-1-laptop',
    'bg-left-single-1-tablet',
    'bg-left-single-1-mobile',
    'bg-left-single-2-tablet',
    'bg-left-single-2-mobile',
    'bg-right-multi-2-mobile',
    'bg-top-cap-1-laptop',
    'bg-top-cap-1-tablet',
    'bg-top-cap-1-mobile',
    'bg-top-cap-2-laptop',
    'bg-top-cap-2-tablet',
    'bg-top-cap-2-mobile',
    'bg-top-multi-7-tint-10',
    'bg-top-multi-7-tint-15',
    'bg-top-multi-11-laptop',
    'bg-top-multi-11-tablet',
    'bg-top-multi-11-mobile',
    'bg-block-center-right-single-4-mobile',
    'bg-block-center-right-single-4-tablet',
    'bg-block-center-right-single-4-laptop',
    'bg-block-center-left-single-3-mobile',
    'bg-block-center-left-single-3-tablet',
    'bg-block-center-left-single-3-laptop',
    'bg-right-multi-4-mobile',
    'bg-right-multi-4-tablet',
    'bg-right-multi-4-laptop',
  ];
  const sectionKey = [...$section.parentElement.children].indexOf($section);
  [...$section.classList]
    .filter((filter) => filter.match(/^bg-/g))
    .forEach((style, bgKey) => {
      const background = document.createElement('span');
      const fetchBase = window.hlx.serverPath;
      const sizes = ['', 'laptop', 'tablet', 'mobile'];

      background.classList.add('bg', style);

      if (!style.startsWith('bg-gradient') && !style.startsWith('bg-solid')) {
        // get svgs
        sizes.forEach((size, sizeKey) => {
          let name = style;

          if (size) name += `-${size}`;

          if (!missingBgs.includes(name)) {
            fetch(`${fetchBase}${window.hlx.codeBasePath}/styles/backgrounds/${name}.svg`).then(
              (resp) => {
                // skip if not success
                if (resp.status !== 200) return;

                // put the svg in the span
                resp.text().then((output) => {
                  const element = document.createElement('div');
                  let html = output;

                  // get IDs
                  const matches = html.matchAll(/id="([^"]+)"/g);
                  // replace IDs
                  [...matches].forEach(([, match], matchKey) => {
                    html = html.replaceAll(
                      match,
                      `${match}-id-${sectionKey}-${bgKey}-${sizeKey}-${matchKey}`
                    );
                  });

                  element.innerHTML = html;
                  const svg = element.firstChild;

                  svg.classList.add(size || 'desktop');

                  background.append(svg);
                  $section.classList.add('has-bg');
                });
              }
            );
          }
        });
      }
      if (style.startsWith('bg-gradient') || style.startsWith('bg-solid')) {
        $section.classList.add('has-bg');
      }
      $section.prepend(background);
    });
}

/**
 * Decorates all sections in a container element.
 * @param {Element} $main The container element
 */
export function decorateSections($main) {
  $main.querySelectorAll(':scope > div').forEach((section) => {
    const wrappers = [];
    let defaultContent = false;
    [...section.children].forEach((e) => {
      if (e.tagName === 'DIV' || !defaultContent) {
        const wrapper = document.createElement('div');
        wrappers.push(wrapper);
        defaultContent = e.tagName !== 'DIV';
        if (defaultContent) wrapper.classList.add('default-content-wrapper');
      }
      wrappers[wrappers.length - 1].append(e);
    });
    wrappers.forEach((wrapper) => section.append(wrapper));
    section.classList.add('section');
    section.setAttribute('data-section-status', 'initialized');

    /* process section metadata */
    const sectionMeta = section.querySelector('div.section-metadata');
    if (sectionMeta) {
      const meta = readBlockConfig(sectionMeta);
      const keys = Object.keys(meta);
      keys.forEach((key) => {
        if (key === 'style') {
          section.classList.add(...meta.style.split(', ').map(toClassName));
        } else if (key === 'anchor') {
          section.id = toClassName(meta.anchor);
        } else {
          section.dataset[toCamelCase(key)] = meta[key];
        }
      });
      decorateBackgrounds(section);
      sectionMeta.remove();
    }
  });
}

/**
 * Updates all section status in a container element.
 * @param {Element} main The container element
 */
export function updateSectionsStatus(main) {
  const sections = [...main.querySelectorAll(':scope > div.section')];
  for (let i = 0; i < sections.length; i += 1) {
    const section = sections[i];
    const status = section.getAttribute('data-section-status');
    if (status !== 'loaded') {
      const loadingBlock = section.querySelector(
        '.block[data-block-status="initialized"], .block[data-block-status="loading"]'
      );
      if (loadingBlock) {
        section.setAttribute('data-section-status', 'loading');
        break;
      } else {
        section.setAttribute('data-section-status', 'loaded');
        const event = new CustomEvent('section-display', { detail: { section } });
        document.body.dispatchEvent(event);
        /* eslint-disable no-console */
        console.log('event dispatched');
      }
    }
  }
}

/**
 * Decorates all blocks in a container element.
 * @param {Element} main The container element
 */
export function decorateBlocks(main) {
  main
    .querySelectorAll('div.section div[class]:not(.default-content-wrapper)')
    .forEach((block) => decorateBlock(block));
}

/**
 * Builds a block DOM Element from a two dimensional array
 * @param {string} blockName name of the block
 * @param {any} content two dimensional array or string or object of content
 */
export function buildBlock(blockName, content) {
  const table = Array.isArray(content) ? content : [[content]];
  const blockEl = document.createElement('div');
  // build image block nested div structure
  blockEl.classList.add(blockName);
  table.forEach((row) => {
    const rowEl = document.createElement('div');
    row.forEach((col) => {
      const colEl = document.createElement('div');
      const vals = col.elems ? col.elems : [col];
      vals.forEach((val) => {
        if (val) {
          if (typeof val === 'string') {
            colEl.innerHTML += val;
          } else {
            colEl.appendChild(val);
          }
        }
      });
      rowEl.appendChild(colEl);
    });
    blockEl.appendChild(rowEl);
  });
  return blockEl;
}

/**
 * Loads JS and CSS for a block.
 * @param {Element} block The block element
 */
export async function loadBlock(block, eager = false) {
  if (
    !(
      block.getAttribute('data-block-status') === 'loading' ||
      block.getAttribute('data-block-status') === 'loaded'
    )
  ) {
    block.setAttribute('data-block-status', 'loading');
    const blockName = block.getAttribute('data-block-name');
    const cssBase = `${window.hlx.serverPath}${window.hlx.codeBasePath}`;
    let cssPath = `${cssBase}/blocks/${blockName}/${blockName}.css`;
    let jsPath = `../blocks/${blockName}/${blockName}.js`;

    if (window.hlx.experiment && window.hlx.experiment.run) {
      const { experiment } = window.hlx;
      if (experiment.selectedVariant !== 'control') {
        const { control } = experiment.variants;
        if (control && control.blocks && control.blocks.includes(blockName)) {
          const blockIndex = control.blocks.indexOf(blockName);
          const variant = experiment.variants[experiment.selectedVariant];
          const blockPath = variant.blocks[blockIndex];
          cssPath = `${cssBase}/${blockPath}/${blockName}.css`;
          jsPath = `../${blockPath}/${blockName}.js`;
        }
      }
    }

    try {
      const cssLoaded = new Promise((resolve) => {
        loadCSS(cssPath, resolve);
      });
      const decorationComplete = new Promise((resolve) => {
        (async () => {
          try {
            const mod = await import(jsPath);
            if (mod.default) {
              await mod.default(block, blockName, document, eager);
            }
          } catch (err) {
            // eslint-disable-next-line no-console
            console.log(`failed to load module for ${blockName}`, err);
          }
          resolve();
        })();
      });
      await Promise.all([cssLoaded, decorationComplete]);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log(`failed to load block ${blockName}`, err);
    }
    block.setAttribute('data-block-status', 'loaded');
  }
}

/**
 * Loads JS and CSS for all blocks in a container element.
 * @param {Element} main The container element
 */
export async function loadBlocks(main) {
  updateSectionsStatus(main);
  const blocks = [...main.querySelectorAll('div.block')];
  for (let i = 0; i < blocks.length; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await loadBlock(blocks[i]);
    updateSectionsStatus(main);
  }
}

/**
 * Returns a picture element with webp and fallbacks
 * @param {string} src The image URL
 * @param {boolean} eager load image eager
 * @param {Array} breakpoints breakpoints and corresponding params (eg. width)
 */
export function createOptimizedPicture(
  src,
  alt = '',
  eager = false,
  breakpoints = [{ media: '(min-width: 400px)', width: '2000' }, { width: '750' }]
) {
  const url = new URL(src, window.location.href);
  const picture = document.createElement('picture');
  const { pathname } = url;
  const ext = pathname.substring(pathname.lastIndexOf('.') + 1);

  // webp
  breakpoints.forEach((br) => {
    const source = document.createElement('source');
    if (br.media) source.setAttribute('media', br.media);
    source.setAttribute('type', 'image/webp');
    source.setAttribute('srcset', `${pathname}?width=${br.width}&format=webply&optimize=medium`);
    picture.appendChild(source);
  });

  // fallback
  breakpoints.forEach((br, i) => {
    if (i < breakpoints.length - 1) {
      const source = document.createElement('source');
      if (br.media) source.setAttribute('media', br.media);
      source.setAttribute('srcset', `${pathname}?width=${br.width}&format=${ext}&optimize=medium`);
      picture.appendChild(source);
    } else {
      const img = document.createElement('img');
      img.setAttribute('loading', eager ? 'eager' : 'lazy');
      img.setAttribute('alt', alt);
      picture.appendChild(img);
      img.setAttribute('src', `${pathname}?width=${br.width}&format=${ext}&optimize=medium`);
    }
  });

  return picture;
}

/**
 * Normalizes all headings within a container element.
 * @param {Element} el The container element
 * @param {[string]]} allowedHeadings The list of allowed headings (h1 ... h6)
 */
export function normalizeHeadings(el, allowedHeadings) {
  const allowed = allowedHeadings.map((h) => h.toLowerCase());
  el.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((tag) => {
    const h = tag.tagName.toLowerCase();
    if (allowed.indexOf(h) === -1) {
      // current heading is not in the allowed list -> try first to "promote" the heading
      let level = parseInt(h.charAt(1), 10) - 1;
      while (allowed.indexOf(`h${level}`) === -1 && level > 0) {
        level -= 1;
      }
      if (level === 0) {
        // did not find a match -> try to "downgrade" the heading
        while (allowed.indexOf(`h${level}`) === -1 && level < 7) {
          level += 1;
        }
      }
      if (level !== 7) {
        tag.outerHTML = `<h${level} id="${tag.id}">${tag.textContent}</h${level}>`;
      }
    }
  });
}

/**
 * Set template (page structure) and theme (page styles).
 */
function decorateTemplateAndTheme() {
  const template = getMetadata('template');
  if (template) document.body.classList.add(toClassName(template));
  const theme = getMetadata('theme');
  if (theme) {
    const themeValues = theme.split(',').map((t) => t.trim());
    themeValues.forEach((t) => {
      if (t.toLowerCase() === 'base') document.querySelector('main')?.setAttribute('id', 'base');
      document.body.classList.add(toClassName(t));
    });
  }
}

/**
 * Adds the favicon.
 * @param {string} href The favicon URL
 */
export function addFavIcon(href) {
  const link = document.createElement('link');
  link.rel = 'icon';
  link.type = 'image/svg+xml';
  link.href = href;
  const existingLink = document.querySelector('head link[rel="icon"]');
  if (existingLink) {
    existingLink.parentElement.replaceChild(link, existingLink);
  } else {
    document.getElementsByTagName('head')[0].appendChild(link);
  }
}

/**
 * load LCP block and/or wait for LCP in default content.
 */
async function waitForLCP() {
  // eslint-disable-next-line no-use-before-define
  const lcpBlocks = LCP_BLOCKS;
  const block = document.querySelector('.block');
  const hasLCPBlock = block && lcpBlocks.includes(block.getAttribute('data-block-name'));
  if (hasLCPBlock) await loadBlock(block, true);

  document.querySelector('body').classList.add('appear');
  const lcpCandidate = document.querySelector('main img');
  await new Promise((resolve) => {
    if (lcpCandidate && !lcpCandidate.complete) {
      lcpCandidate.setAttribute('loading', 'eager');
      lcpCandidate.addEventListener('load', () => resolve());
      lcpCandidate.addEventListener('error', () => resolve());
    } else {
      resolve();
    }
  });
}

/**
 * Decorates the page.
 */
async function loadPage(doc) {
  // eslint-disable-next-line no-use-before-define
  await loadEager(doc);
  // eslint-disable-next-line no-use-before-define
  await loadLazy(doc);
  // eslint-disable-next-line no-use-before-define
  loadDelayed(doc);
}

export function initHlx(forceMultiple = false) {
  if (!window.hlx || forceMultiple) {
    window.hlx = window.hlx || {};
    window.hlx.lighthouse = new URLSearchParams(window.location.search).get('lighthouse') === 'on';
    window.hlx.codeBasePath = '';
    window.hlx.serverPath = '';

    const scriptEl = document.querySelector('script[src$="/scripts/scripts.js"]');
    if (scriptEl) {
      try {
        [window.hlx.codeBasePath] = new URL(scriptEl.src).pathname.split('/scripts/scripts.js');
      } catch (e) {
        // eslint-disable-next-line no-console
        console.log(e);
      }
    }
  }
}

initHlx();

/*
 * ------------------------------------------------------------
 * Edit above at your own risk
 * ------------------------------------------------------------
 */

const LCP_BLOCKS = ['hero', 'featured-articles']; // add your LCP blocks to the list
window.hlx.RUM_GENERATION = 'bamboo-rum-conversion-1'; // add your RUM generation information here

sampleRUM('top');

window.addEventListener('unhandledrejection', (event) => {
  sampleRUM('error', { source: event.reason.sourceURL, target: event.reason.line });
});

window.addEventListener('error', (event) => {
  sampleRUM('error', { source: event.filename, target: event.lineno });
});

window.addEventListener('load', () => sampleRUM('load'));

if (!window.hlx.suppressLoadPage) loadPage(document);

export function formatDate(dateString) {
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  const [year, month, day] = dateString.split('-').map((n) => +n);
  return `${months[month - 1]} ${day}, ${year}`;
}

export function decorateButtons(block = document) {
  const noButtonBlocks = [];
  block.querySelectorAll(':scope a').forEach(($a) => {
    $a.title = $a.title || $a.textContent.trim();
    const $block = $a.closest('div.section > div > div');
    let blockName;
    if ($block) {
      blockName = $block.className;
    }
    if (!noButtonBlocks.includes(blockName) && $a.href !== $a.textContent) {
      const $up = $a.parentElement;
      const $twoup = $a.parentElement.parentElement;
      if (!$a.querySelector('img')) {
        if ($up.childNodes.length === 1 && ($up.tagName === 'P' || $up.tagName === 'DIV')) {
          $a.className = 'button accent'; // default
          $up.classList.add('button-container');
        }
        if (
          $up.childNodes.length === 1 &&
          $up.tagName === 'STRONG' &&
          $twoup.childNodes.length === 1 &&
          $twoup.tagName === 'P'
        ) {
          $a.className = 'button accent';
          $twoup.classList.add('button-container');
        }
        if (
          $up.childNodes.length === 1 &&
          $up.tagName === 'EM' &&
          $twoup.childNodes.length === 1 &&
          $twoup.tagName === 'P'
        ) {
          $a.className = 'button accent light';
          $twoup.classList.add('button-container');
        }
      }
    }
  });
}

export function toCategory(category) {
  let categoryName = toClassName(category);
  while (categoryName.includes('--')) categoryName = categoryName.replace('--', '-');
  return categoryName;
}

function setCategory() {
  let category = getMetadata('category');
  if (!category && window.location.pathname.includes('/category/')) {
    // eslint-disable-next-line prefer-destructuring
    category = window.location.pathname.split('/category/')[1];
  }

  const categoryName = toCategory(category);
  if (category) {
    document.body.classList.add(`category-${categoryName}`);
  }
}

/**
 * Build figcaption element
 * @param {Element} pEl The original element to be placed in figcaption.
 * @returns figCaptionEl Generated figcaption
 */

export function buildCaption(pEl) {
  const figCaptionEl = document.createElement('figcaption');
  pEl.classList.add('caption');
  figCaptionEl.append(pEl);
  return figCaptionEl;
}

/**
 * Build figure element
 * @param {Element} blockEl The original element to be placed in figure.
 * @returns figEl Generated figure
 */
export function buildFigure(blockEl) {
  const figEl = document.createElement('figure');
  figEl.classList.add('figure');
  // content is picture only, no caption or link
  if (blockEl?.firstElementChild) {
    if (
      blockEl.firstElementChild.nodeName === 'PICTURE' ||
      blockEl.firstElementChild.nodeName === 'VIDEO'
    ) {
      figEl.append(blockEl.firstElementChild);
    } else if (blockEl.firstElementChild.nodeName === 'P') {
      const pEls = Array.from(blockEl.children);
      pEls.forEach((pEl) => {
        if (pEl.firstElementChild) {
          if (
            pEl.firstElementChild.nodeName === 'PICTURE' ||
            pEl.firstElementChild.nodeName === 'VIDEO'
          ) {
            figEl.append(pEl.firstElementChild);
          } else if (pEl.firstElementChild.nodeName === 'EM') {
            const figCapEl = buildCaption(pEl);
            figEl.append(figCapEl);
          } else if (pEl.firstElementChild.nodeName === 'A') {
            const picEl = figEl.querySelector('picture');
            if (picEl) {
              pEl.firstElementChild.textContent = '';
              pEl.firstElementChild.append(picEl);
            }
            figEl.prepend(pEl.firstElementChild);
          }
        }
      });
      // catch link-only figures (like embed blocks);
    } else if (blockEl.firstElementChild.nodeName === 'A') {
      figEl.append(blockEl.firstElementChild);
    }
  }
  return figEl;
}

export async function readIndex(indexPath, collectionCache) {
  window.pageIndex = window.pageIndex || {};
  if (!window.pageIndex[collectionCache]) {
    const resp = await fetch(indexPath);
    const json = await resp.json();
    const lookup = {};
    json.data.forEach((row) => {
      lookup[row.path] = row;
    });
    window.pageIndex[collectionCache] = { data: json.data, lookup };
  }
}

export async function lookupPages(pathnames, collection, sheet = '') {
  const indexPaths = {
    blog: '/blog/fixtures/blog-query-index.json',
    integrations: '/integrations/query-index.json?sheet=listings',
    hrGlossary: '/resources/hr-glossary/query-index.json',
    hrvs: '/resources/events/hr-virtual/2022/query-index.json',
    blockInventory: '/blocks/query-index.json',
    blockTracker: `/website-marketing-resources/block-inventory-tracker2.json?sheet=${sheet}`,
    resources: `/resources/query-index.json?sheet=resources`,
    speakers: `/speakers/query-index.json`,
  };
  const indexPath = indexPaths[collection];
  const collectionCache = `${collection}${sheet}`;
  await readIndex(indexPath, collectionCache);

  /* guard for legacy URLs */
  pathnames.forEach((path, i) => {
    if (path.endsWith('/')) pathnames[i] = path.substr(0, path.length - 1);
  });
  const { lookup } = window.pageIndex[collectionCache];
  const result = pathnames.map((path) => lookup[path]).filter((e) => e);
  return result;
}

export async function loadHeader(header) {
  const queryParams = new Proxy(new URLSearchParams(window.location.search), {
    get: (searchParams, prop) => searchParams.get(prop),
  });
  const headerblockName = queryParams.header === 'meganav' ? 'meganav' : 'header';

  const headerBlock = buildBlock(headerblockName, '');
  header.append(headerBlock);
  decorateBlock(headerBlock);
  await loadBlock(headerBlock);
  // Patch logo URL for is-customer audience
  if (getBhrFeaturesCookie()) {
    if (AUDIENCES_CONFIG.audiences['is-customer'].test()) {
      const usp = new URLSearchParams(window.location.search);
      usp.append('segment', 'general');
      document.querySelector('.nav-brand a').href += `?${usp.toString()}`;
    }
  }
}

function loadFooter(footer) {
  const queryParams = new Proxy(new URLSearchParams(window.location.search), {
    get: (searchParams, prop) => searchParams.get(prop),
  });
  const footerBlockName = queryParams.header ? 'megafooter' : 'footer';

  const footerBlock = buildBlock(footerBlockName, '');
  footer.append(footerBlock);
  decorateBlock(footerBlock);
  loadBlock(footerBlock);
}

function buildPageHeader(main, type) {
  const section = document.createElement('div');
  let content = [];
  if (type === 'resources-guides') {
    const picture = document.querySelector('h1 + h5 + p > picture');
    const h1 = document.querySelector('h1');
    const h5 = h1.nextElementSibling?.tagName === 'H5' ? h1.nextElementSibling : null;
    content = [[picture], [h1], [h5]].filter((e) => e[0]);
  }
  const header = buildBlock('page-header', content);
  header.setAttribute('data-header-location', toClassName(type));
  section.append(header);
  main.prepend(section);
}

/**
 * Builds all synthetic blocks in a container element.
 * @param {Element} main The container element
 */
// eslint-disable-next-line no-unused-vars
async function buildAutoBlocks(main) {
  try {
    let template = toClassName(getMetadata('template'));
    if (window.location.pathname.startsWith('/blog/') && !template) template = 'blog';

    const templates = [
      'blog',
      'integrations-listing',
      'content-library',
      'webinar',
      'product-updates',
      'live-demo-webinar-lp',
    ];
    if (templates.includes(template)) {
      const mod = await import(`./${template}.js`);
      if (mod.default) {
        await mod.default(main);
      }
    }

    if (
      template === 'job-description' ||
      template === 'resources-guides' ||
      template === 'performance-reviews'
    ) {
      buildPageHeader(main, template);
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Auto Blocking failed', error);
  }
}

function linkImages(main) {
  main.querySelectorAll(':scope > div > p > picture').forEach((picture) => {
    const p = picture.parentElement;
    const a = p.querySelector('a');
    if (a && a.textContent.includes('://')) {
      a.textContent = '';
      a.append(picture);
    }
  });
}

/**
 * Decorates the main element.
 * @param {Element} main The main element
 */
export async function decorateMain(main) {
  linkImages(main);

  await buildAutoBlocks(main);
  setCategory();
  decorateSections(main);
  decorateBlocks(main);
  decorateButtons(main);
  sampleRUM.observe(main.querySelectorAll('div[data-block-name]'));
  window.setTimeout(() => sampleRUM.observe(main.querySelectorAll('picture > img')), 1000);
}

/**
 * Returns the label used for tracking link clicks
 * @param {Element} element link element
 * @returns link label used for tracking converstion
 */
function getLinkLabel(element) {
  return element.title ? toClassName(element.title) : toClassName(element.textContent);
}

function findConversionValue(parent, fieldName) {
  // Try to find the element by Id or Name
  const valueElement =
    document.getElementById(fieldName) || parent.querySelector(`[name='${fieldName}']`);
  if (valueElement) {
    return valueElement.value;
  }
  // Find the element by the inner text of the label
  return Array.from(parent.getElementsByTagName('label'))
    .filter((l) => l.innerText.trim().toLowerCase() === fieldName.toLowerCase())
    .map((label) => document.getElementById(label.htmlFor))
    .filter((field) => !!field)
    .map((field) => field.value)
    .pop();
}

/**
 * Registers conversion listeners according to the metadata configured in the document.
 * @param {Element} parent element where to find potential event conversion sources
 * @param {string} path fragment path when the parent element is coming from a fragment
 */
export async function initConversionTracking(parent, path) {
  const conversionElements = {
    form: () => {
      // Track all forms
      parent.querySelectorAll('form').forEach((element) => {
        const section = element.closest('div.section');
        if (section.dataset.conversionValueField) {
          const cvField = section.dataset.conversionValueField.trim();
          // this will track the value of the element with the id specified in the "Conversion Element" field.
          // ideally, this should not be an ID, but the case-insensitive name label of the element.
          sampleRUM.convert(
            undefined,
            (cvParent) => findConversionValue(cvParent, cvField),
            element,
            ['submit']
          );
        }
        const formConversionName = section.dataset.conversionName || getMetadata('conversion-name');
        if (formConversionName) {
          sampleRUM.convert(formConversionName, undefined, element, ['submit']);
        } else {
          // if no conversion name is specified, use the form path or id
          sampleRUM.convert(path ? toClassName(path) : element.id, undefined, element, ['submit']);
        }
      });
    },
    link: () => {
      // track all links
      Array.from(parent.querySelectorAll('a[href]'))
        .map((element) => ({
          element,
          cevent:
            getMetadata(`conversion-name--${getLinkLabel(element)}-`) ||
            getMetadata('conversion-name') ||
            getLinkLabel(element),
        }))
        .forEach(({ element, cevent }) => {
          sampleRUM.convert(cevent, undefined, element, ['click']);
        });
    },
    'labeled-link': () => {
      // track only the links configured in the metadata
      const linkLabels = getMetadata('conversion-link-labels') || '';
      const trackedLabels = linkLabels
        .split(',')
        .map((p) => p.trim())
        .map(toClassName);

      Array.from(parent.querySelectorAll('a[href]'))
        .filter((element) => trackedLabels.includes(getLinkLabel(element)))
        .map((element) => ({
          element,
          cevent:
            getMetadata(`conversion-name--${getLinkLabel(element)}-`) ||
            getMetadata('conversion-name') ||
            getLinkLabel(element),
        }))
        .forEach(({ element, cevent }) => {
          sampleRUM.convert(cevent, undefined, element, ['click']);
        });
    },
  };

  const declaredConversionElements = getMetadata('conversion-element')
    ? getMetadata('conversion-element')
        .split(',')
        .map((ce) => toClassName(ce.trim()))
    : [];

  Object.keys(conversionElements)
    .filter((ce) => declaredConversionElements.includes(ce))
    .forEach((cefn) => conversionElements[cefn]());
}
/**
 * loads everything related to Marketing technology that must be loaded eagerly
 * (e.g., Adobe Target).
 */
async function loadMartech() {
  /* Adobe Target Prehiding Snippet */
  /*
  ;(function(win, doc, style, timeout) {
    const STYLE_ID = 'at-body-style';
    function getParent() {
      return doc.getElementsByTagName('head')[0];
    }
    function addStyle(parent, id, def) {
      if (!parent) {
        return;
      }
      const style = doc.createElement('style');
      style.id = id;
      style.innerHTML = def;
      parent.appendChild(style);
    }
    function removeStyle(parent, id) {
      if (!parent) {
        return;
      }
      const style = doc.getElementById(id);
      if (!style) {
        return;
      }
      parent.removeChild(style);
    }
    addStyle(getParent(), STYLE_ID, style);
    setTimeout(function() {
      removeStyle(getParent(), STYLE_ID);
    }, timeout);
  }(window, document, "body {opacity: 0 !important}", 3000));
  */
  /* Move Adobe Tags here from delayed.js if Adobe Target is added and enabled */
}

/**
 * loads everything needed to get to LCP.
 */
async function loadEager(doc) {
  const instantSegments = [
    ...document.head.querySelectorAll(`meta[property^="audience:"],meta[name^="audience-"]`),
  ].map((meta) => {
    const id = (
      meta.name ? meta.name.substring(9) : meta.getAttribute('property').split(':')[1]
    ).replace(/^-+|-+$/g, '');
    return { id, url: meta.getAttribute('content') };
  });
  if (instantSegments.length && getBhrFeaturesCookie()) {
    // eslint-disable-next-line import/no-cycle
    const { runSegmentation } = await import('./experimentation.js');
    const resolution = getMetadata('audience-resolution');
    await runSegmentation(instantSegments, { ...AUDIENCES_CONFIG, resolution });
  }

  const experiment = getMetadata('experiment');
  const instantExperiment = getMetadata('instant-experiment');
  if (instantExperiment || experiment) {
    // eslint-disable-next-line import/no-cycle
    const { runExperiment } = await import('./experimentation.js');
    await runExperiment(experiment, instantExperiment);
  }

  if (!window.hlx.lighthouse) loadMartech();

  /* This is temporary code to load our homepage convert test mid-test.
     we are loading here to avoid the delay "long flicker" before the test page is loaded.
     This type of test should be handled in Adobe Franklin experiments going forward.
   */
  // const testPaths = [
  //   '/resources/hr-glossary/performance-review'
  // ];
  // const isOnTestPath = testPaths.includes(window.location.pathname);
  // if (isOnTestPath) {
  const $head = document.querySelector('head');
  const $script = document.createElement('script');
  $script.src = 'https://cdn-4.convertexperiments.com/js/10004673-10005501.js';
  $head.append($script);
  // }
  /* This is the end of the temporary convert test code */

  decorateTemplateAndTheme();
  document.documentElement.lang = 'en';
  const main = doc.querySelector('main');
  if (main) {
    await decorateMain(main);
    if (window.innerWidth >= 900) loadCSS(`${window.hlx.codeBasePath}/styles/fonts/early-fonts.css`);
    if (sessionStorage.getItem('lazy-styles-loaded')) {
      loadCSS(`${window.hlx.codeBasePath}/styles/fonts/early-fonts.css`);
      loadCSS(`${window.hlx.codeBasePath}/styles/lazy-styles.css`);
    }
    await waitForLCP();
  }
}

/**
 * Schema markup functions
 */
function createProductSchemaMarkup() {
  const pageTitle = document.querySelector('h1').textContent;
  const pageUrl = document.querySelector('link[rel="canonical"]').getAttribute('href');
  const socialImage = document.querySelector('meta[property="og:image"]').getAttribute('content');
  const quoteAuthor = document.querySelector('.product-schema p:last-of-type').textContent;
  const quoteText = document
    .querySelector('.product-schema div div p:first-of-type')
    .textContent.replace(/["]+/g, '');
  const pageDescription = document
    .querySelector('meta[property="og:description"]')
    .getAttribute('content');
  const quotePublishDate = document.lastModified;
  const productSchema = {
    '@context': 'http://schema.org/',
    '@type': 'Product',
    name: pageTitle,
    url: pageUrl,
    image: socialImage,
    description: pageDescription,
    brand: 'Bamboohr',
    aggregateRating: {
      '@type': 'aggregateRating',
      ratingValue: '4.3',
      reviewCount: '593',
    },
    review: [
      {
        '@type': 'Review',
        author: quoteAuthor,
        datePublished: quotePublishDate,
        reviewBody: quoteText,
      },
    ],
  };
  const $productSchema = document.createElement('script', { type: 'application/ld+json' });
  $productSchema.innerHTML = JSON.stringify(productSchema, null, 2);
  const $head = document.head;
  $head.append($productSchema);
}

function createVideoObjectSchemaMarkup() {
  const videoName = document.querySelector('h1').textContent;
  const wistiaThumb = getMetadata('wistia-video-thumbnail');
  const wistiaVideoId = getMetadata('wistia-video-id');
  const wistiaVideoUrl = `https://fast.wistia.net/embed/iframe/${wistiaVideoId}`;
  const videoDescription = document
    .querySelector('meta[property="og:description"]')
    .getAttribute('content');
  const videoUploadDate = document.lastModified;
  const videoObjectSchema = {
    '@context': 'http://schema.org/',
    '@type': 'VideoObject',
    name: videoName,
    thumbnailUrl: wistiaThumb,
    embedUrl: wistiaVideoUrl,
    uploadDate: videoUploadDate,
    description: videoDescription,
  };
  const $videoObjectSchema = document.createElement('script', { type: 'application/ld+json' });
  $videoObjectSchema.innerHTML = JSON.stringify(videoObjectSchema, null, 2);
  const $head = document.head;
  $head.append($videoObjectSchema);
}

function createFaqPageSchemaMarkup() {
  const faqPageSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [],
  };
  document.querySelectorAll('.faq-page-schema .accordion').forEach((tab) => {
    const q = tab.querySelector('h2').textContent.trim();
    const a = tab
      .querySelector('.tabs-content')
      .textContent.replace(/(\n|\n|\r)/gm, '')
      .trim();
    if (q && a) {
      faqPageSchema.mainEntity.push({
        '@type': 'Question',
        name: q,
        acceptedAnswer: {
          '@type': 'Answer',
          text: a,
        },
      });
    }
  });
  const $faqPageSchema = document.createElement('script', { type: 'application/ld+json' });
  $faqPageSchema.innerHTML = JSON.stringify(faqPageSchema, null, 2);
  const $head = document.head;
  $head.append($faqPageSchema);
}

/**
 * loads everything that doesn't need to be delayed.
 */
async function loadLazy(doc) {
  // eslint-disable-next-line no-use-before-define
  loadDelayedOnClick();

  const header = doc.querySelector('header');
  const queryParams = new Proxy(new URLSearchParams(window.location.search), {
    get: (searchParams, prop) => searchParams.get(prop),
  });
  if (queryParams.header === 'meganav') header.classList.add('header-meganav');
  const main = doc.querySelector('main');
  loadTemplateCSS();
  await loadBlocks(main);
  decorateIcons(main);

  const { hash } = window.location;
  const element = hash ? main.querySelector(hash) : false;
  if (hash && element) element.scrollIntoView();

  /**
   * Calls the Schema markup functions
   */
  if (getMetadata('schema')) {
    const schemaVals = getMetadata('schema').split(',');
    schemaVals.forEach((val) => {
      switch (val.trim()) {
        case 'Product':
          createProductSchemaMarkup();
          break;
        case 'VideoObject':
          createVideoObjectSchemaMarkup();
          break;
        case 'FAQPage':
          createFaqPageSchemaMarkup();
          break;
        default:
          break;
      }
    });
  }

  const headerloaded = loadHeader(header);
  loadFooter(doc.querySelector('footer'));
  
  loadCSS(`${window.hlx.codeBasePath}/styles/fonts/early-fonts.css`);
  loadCSS(`${window.hlx.codeBasePath}/styles/lazy-styles.css`);
  if (!window.location.hostname.includes('localhost')) sessionStorage.setItem('lazy-styles-loaded', 'true');
  addFavIcon('https://www.bamboohr.com/favicon.ico');

  if (window.location.hostname.endsWith('hlx.page') || window.location.hostname === 'localhost') {
    // eslint-disable-next-line import/no-cycle
    import('../tools/preview/experimentation-preview.js');
  }
  sampleRUM('lazy');
  await headerloaded;
  initConversionTracking(document);
}

function loadDelayedOnClick() {
  // eslint-disable-next-line no-use-before-define
  document.body.addEventListener('click', handleLoadDelayed);
}

async function handleLoadDelayed() {
  if (!window.hlx.delayedJSLoaded) {
    window.hlx.delayedJSLoaded = true;
    // eslint-disable-next-line import/no-cycle
    await import('./delayed.js');

    document.body.removeEventListener('click', handleLoadDelayed);
  }
}

/**
 * loads everything that happens a lot later, without impacting
 * the user experience.
 */
function loadDelayed() {
  const testPaths = [
    '/',
    '/resources/hr-glossary/performance-review',
    '/resources/hr-glossary/',
    '/hr-solutions/industry/construction',
    '/blog/key-hr-metrics',
  ];
  const isOnTestPath = testPaths.includes(window.location.pathname);

  if (isOnTestPath) handleLoadDelayed(); // import without delay (for testing page performance)
  // else if (!window.hlx.performance) window.setTimeout(() => handleLoadDelayed(), 4000);
  else if (!window.hlx.performance) handleLoadDelayed();

  // load anything that can be postponed to the latest here
}

export async function loadFragment(path) {
  const resp = await fetch(`${path}.plain.html`);
  const main = document.createElement('main');
  if (resp.ok) {
    main.innerHTML = await resp.text();
    await decorateMain(main);
    await loadBlocks(main);
    decorateIcons(main);
  }
  return main;
}

export function lockBody() {
  const bs = document.body.style;
  bs.position = 'fixed';
  bs.top = `-${window.scrollY}px`;
  bs.left = 0;
  bs.right = 0;
}

export function unlockBody() {
  const bs = document.body.style;
  const scrollY = bs.top;
  bs.position = '';
  bs.top = '';
  bs.left = '';
  bs.right = '';
  window.scrollTo(0, parseInt(scrollY || '0', 10) * -1);
}

export function newsletterSubscribe(email) {
  const action = 'https://www.bamboohr.com/ajax/blog-newsletter-form.php';
  const body = `email=${encodeURIComponent(email)}`;
  fetch(action, {
    method: 'POST',
    mode: 'no-cors',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
    body,
  });
}

export function insertNewsletterForm(elem, submitCallback) {
  const action = 'https://www.bamboohr.com/ajax/blog-newsletter-form.php';
  const relative = new URL(action).pathname;
  elem.querySelectorAll(`a[href="${action}"], a[href="${relative}"]`).forEach((a) => {
    const formDiv = document.createElement('div');
    formDiv.innerHTML = `
    <form class="nav-form" __bizdiag="96619420" __biza="WJ__">
      <input type="email" name="email" placeholder="Email Address" aria-label="email" autocomplete="off">
      <button class="">${a.textContent}</button>
    </form>
    `;
    const button = formDiv.querySelector('button');
    const input = formDiv.querySelector('input');
    button.addEventListener('click', (e) => {
      newsletterSubscribe(input.value);
      e.preventDefault();
      submitCallback();
    });
    a.replaceWith(formDiv);
  });
}

/**
 * Return whether or not this element has a class that starts with the given string
 * @param {HtmlElement} elem
 * @param {string} classNameStart
 * @returns {boolean}
 */
export function hasClassStartsWith(elem, classNameStart) {
  const classNames = [...elem.classList];
  let isClassStartsWith = false;

  classNames.forEach((className) => {
    if (className.startsWith(classNameStart)) {
      isClassStartsWith = true;
    }
  });

  return isClassStartsWith;
}

/**
 * Gets array of parameterized values given a class that starts with a name
 * @param {string} className
 * @param {string} classNameStart
 * @return {string[]} Array of remaining items split on the hyphen (-)
 */
export function getValuesFromClassName(className, classNameStart) {
  const params = className.substring(classNameStart.length);

  return params.split('-');
}

/**
 * Creates an element with optional class and type
 * @param {string} elemType type of element to create
 * @param {...string} [cssClass] CSS class(es) to apply to element
 * @returns {Element}
 */
export function createElem(elemType, ...cssClass) {
  const elem = document.createElement(elemType);
  if (cssClass != null && cssClass.length) {
    elem.classList.add(cssClass);
  }

  return elem;
}

/**
 * Add class to a block's parent.
 * @param {Element} block The block element
 */
export function addClassToParent(block) {
  const classes = [
    'full-width',
    'med-width',
    'normal-width',
    'small-width',
    'medium-width',
    'extra-wide',
    'extra-small-width',
    'top-section-top-margin',
    'bottom-margin',
    'top-margin',
    'laptop-small-width',
    'variable-width',
  ];
  classes.some((c) => {
    const found = block.classList.contains(c);
    if (found) {
      block.parentElement.classList.add(c);
      block.classList.remove(c);
    }
    return found;
  });
}

const params = new URLSearchParams(window.location.search);
if (params.get('performance')) {
  window.hlx.performance = true;
  import('./performance.js').then((mod) => {
    if (mod.default) mod.default();
  });
}

/**
 * Registers the 'convert' function to `sampleRUM` which sends
 * variant and convert events upon conversion.
 * The function will register a listener for an element if listenTo parameter is provided.
 * listenTo supports 'submit' and 'click'.
 * If listenTo is not provided, the information is used to track a conversion event.
 */
sampleRUM.drain('convert', (cevent, cvalueThunk, element, listenTo = []) => {
  async function trackConversion(celement) {
    const MAX_SESSION_LENGTH = 1000 * 60 * 60 * 24 * 30; // 30 days
    try {
      // get all stored experiments from local storage (unified-decisioning-experiments)
      const experiments = JSON.parse(localStorage.getItem('unified-decisioning-experiments'));
      if (experiments) {
        Object.entries(experiments)
          .map(([experiment, { treatment, date }]) => ({ experiment, treatment, date }))
          .filter(({ date }) => Date.now() - new Date(date) < MAX_SESSION_LENGTH)
          .forEach(({ experiment, treatment }) => {
            // send conversion event for each experiment that has been seen by this visitor
            sampleRUM('variant', { source: experiment, target: treatment });
          });
      }
      // send conversion event
      const cvalue = typeof cvalueThunk === 'function' ? await cvalueThunk(element) : cvalueThunk;
      sampleRUM('convert', { source: cevent, target: cvalue, element: celement });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log('error reading experiments', e);
    }
  }

  function registerConversionListener(elements) {
    // if elements is an array or nodelist, register a conversion event for each element
    if (Array.isArray(elements) || elements instanceof NodeList) {
      elements.forEach((e) => registerConversionListener(e, listenTo, cevent, cvalueThunk));
    } else {
      listenTo.forEach((eventName) =>
        element.addEventListener(eventName, (e) => trackConversion(e.target))
      );
    }
  }

  if (element && listenTo.length) {
    registerConversionListener(element, listenTo, cevent, cvalueThunk);
  } else {
    trackConversion(element, cevent, cvalueThunk);
  }
});

// call upon conversion events, pushes them to the datalayer
sampleRUM.always.on('convert', (data) => {
  const { element } = data;
  if (element && window.digitalData) {
    let evtDataLayer;
    if (element.tagName === 'FORM') {
      evtDataLayer = {
        event: 'Form Complete',
        forms: {
          formsComplete: 1,
          formName: data.source, // this is the conversion event name
          conversionValue: data.target,
          formId: element.id,
          formsType: '',
        },
      };
    } else if (element.tagName === 'A') {
      evtDataLayer = {
        event: 'Link Click',
        eventData: {
          linkName: data.source, // this is the conversion event name
          linkText: element.innerHTML,
          linkHref: element.href,
        },
      };
    }
    console.debug('push to datalayer', evtDataLayer);
    window.digitalData.push(evtDataLayer);
  }
});
