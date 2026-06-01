const templateRe = /<template>([\s\S]*?)<\/template>/i;
const scriptRe = /<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/i;
const styleRe = /<style(?:\s+[^>]*)?>([\s\S]*?)<\/style>/gi;

const loadedStyles = new Set();
const loadedComponents = new Map();

const appBase = new URL('./', window.location.href);

const assertAllowedSfcUrl = (url) => {
  const resolved = new URL(url, appBase);
  const srcRoot = new URL('./src/', appBase);
  if (resolved.origin !== window.location.origin) {
    throw new Error(`SFC remoto bloqueado: ${resolved.href}`);
  }
  if (!resolved.pathname.startsWith(srcRoot.pathname) || !resolved.pathname.endsWith('.vue')) {
    throw new Error(`SFC fuera de src bloqueado: ${resolved.pathname}`);
  }
  return resolved;
};

const injectStyle = (id, css) => {
  if (!css.trim() || loadedStyles.has(id)) return;
  const style = document.createElement('style');
  style.dataset.sfc = id;
  style.textContent = css;
  document.head.appendChild(style);
  loadedStyles.add(id);
};

const loadScript = async (source, id) => {
  const script = source.trim() || 'export default {}';
  const blob = new Blob([script], { type: 'text/javascript' });
  const moduleUrl = URL.createObjectURL(blob);
  try {
    const module = await import(moduleUrl);
    return module.default || {};
  } finally {
    URL.revokeObjectURL(moduleUrl);
  }
};

export const parseSfc = (source) => {
  const template = source.match(templateRe)?.[1]?.trim();
  const script = source.match(scriptRe)?.[1]?.trim() || 'export default {}';
  const styles = Array.from(source.matchAll(styleRe)).map((match) => match[1].trim());

  if (!template) {
    throw new Error('SFC sin <template>.');
  }

  return { template, script, styles };
};

export const loadSfc = async (url) => {
  const resolved = assertAllowedSfcUrl(url);
  const cached = loadedComponents.get(resolved.href);
  if (cached) return cached;

  const response = await fetch(resolved.href, {
    credentials: 'same-origin',
    cache: 'no-cache',
  });

  if (!response.ok) {
    throw new Error(`No se pudo cargar ${resolved.pathname}: HTTP ${response.status}`);
  }

  const parsed = parseSfc(await response.text());
  parsed.styles.forEach((css, index) => injectStyle(`${resolved.pathname}:${index}`, css));

  const component = await loadScript(parsed.script, resolved.pathname);
  if (!component.render) {
    component.template = parsed.template;
  }
  loadedComponents.set(resolved.href, component);
  return component;
};
