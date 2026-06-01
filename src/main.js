import { loadSfc } from './platform/sfcLoader.js';
import { createKernel } from './platform/kernel.js';

const componentUrls = {
  ActionCenterPanel: './src/components/ActionCenterPanel.vue',
  DomainBoard: './src/components/DomainBoard.vue',
  IntegrationHealth: './src/components/IntegrationHealth.vue',
  MetricStrip: './src/components/MetricStrip.vue',
  ShellHeader: './src/components/ShellHeader.vue',
};

const loadComponents = async () => {
  const entries = await Promise.all(
    Object.entries(componentUrls).map(async ([name, url]) => [name, await loadSfc(url)]),
  );
  return Object.fromEntries(entries);
};

const boot = async () => {
  if (!window.Vue) {
    throw new Error('Vue local no esta disponible en vendor/vue.global.prod.js');
  }

  const [App, components] = await Promise.all([
    loadSfc('./src/components/App.vue'),
    loadComponents(),
  ]);

  App.components = { ...(App.components || {}), ...components };

  const kernel = createKernel({
    vue: window.Vue,
    config: {
      veeperBaseUrl: 'http://127.0.0.1:8097',
      codexGoalPath: 'C:/git/codex/codex-goal',
    },
  });

  window.Vue
    .createApp(App)
    .provide('kernel', kernel)
    .mount('#app');

  document.querySelector('[data-fideo-cloak]')?.removeAttribute('data-fideo-cloak');
};

boot().catch((error) => {
  console.error(error);
  document.querySelector('#app').innerHTML =
    '<main class="boot-screen"><strong>No se pudo iniciar FideoVue.</strong></main>';
});

