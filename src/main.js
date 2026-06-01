import { loadSfc } from './platform/sfcLoader.js';
import { createKernel } from './platform/kernel.js';

const componentUrls = {
  ActionCenterPanel: './src/components/ActionCenterPanel.vue',
  CommerceBoard: './src/components/CommerceBoard.vue',
  DeliveryOpsBoard: './src/components/DeliveryOpsBoard.vue',
  DomainBoard: './src/components/DomainBoard.vue',
  FinanceOpsBoard: './src/components/FinanceOpsBoard.vue',
  IntegrationHealth: './src/components/IntegrationHealth.vue',
  InventoryOpsBoard: './src/components/InventoryOpsBoard.vue',
  MessageBoard: './src/components/MessageBoard.vue',
  MetricStrip: './src/components/MetricStrip.vue',
  PortalAssetBoard: './src/components/PortalAssetBoard.vue',
  ShellHeader: './src/components/ShellHeader.vue',
  SupplierOpsBoard: './src/components/SupplierOpsBoard.vue',
};

const loadComponents = async () => {
  const entries = await Promise.all(
    Object.entries(componentUrls).map(async ([name, url]) => [name, await loadSfc(url)]),
  );
  return Object.fromEntries(entries);
};

const boot = async () => {
  if (!window.Vue) {
    throw new Error('Vue local no esta disponible en vendor/vue.runtime.global.prod.js');
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
  const root = document.querySelector('#app');
  const message = document.createElement('main');
  const title = document.createElement('strong');
  message.className = 'boot-screen';
  title.textContent = 'No se pudo iniciar FideoVue.';
  message.appendChild(title);
  root.replaceChildren(message);
});
