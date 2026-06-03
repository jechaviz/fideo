import { loadSfc } from './platform/sfcLoader.js';
import { createKernel } from './platform/kernel.js';

const componentUrls = {
  ActionCenterPanel: './src/components/ActionCenterPanel.vue',
  CatalogAdminBoard: './src/components/CatalogAdminBoard.vue',
  CommerceBoard: './src/components/CommerceBoard.vue',
  DeliveryOpsBoard: './src/components/DeliveryOpsBoard.vue',
  DomainBoard: './src/components/DomainBoard.vue',
  FideoCustomerPortal: './src/components/FideoCustomerPortal.vue',
  FinanceOpsBoard: './src/components/FinanceOpsBoard.vue',
  FideoRoleSwitcher: './src/components/FideoRoleSwitcher.vue',
  FideoShellSidebar: './src/components/FideoShellSidebar.vue',
  FideoSupplierPortal: './src/components/FideoSupplierPortal.vue',
  IntegrationHealth: './src/components/IntegrationHealth.vue',
  InventoryOpsBoard: './src/components/InventoryOpsBoard.vue',
  MessageAiOpsBoard: './src/components/MessageAiOpsBoard.vue',
  MessageBoard: './src/components/MessageBoard.vue',
  MetricStrip: './src/components/MetricStrip.vue',
  PortalAssetBoard: './src/components/PortalAssetBoard.vue',
  RuntimeGateBoard: './src/components/RuntimeGateBoard.vue',
  RolePipelineAuditBoard: './src/components/RolePipelineAuditBoard.vue',
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
  const runtimeConfig = window.FIDEO_CONFIG || {};

  const kernel = createKernel({
    vue: window.Vue,
    config: {
      pocketbaseBaseUrl: runtimeConfig.pocketbaseBaseUrl ?? './',
      pocketbaseBackend: runtimeConfig.pocketbaseBackend || 'mysql',
      pocketbaseToken: runtimeConfig.pocketbaseToken || '',
      oneSignalAppId: runtimeConfig.oneSignalAppId || '',
      allowOneSignalLive: runtimeConfig.allowOneSignalLive || false,
      veeperBaseUrl: runtimeConfig.veeperBaseUrl || '',
      codexGoalPath: runtimeConfig.codexGoalPath || '',
      aiProvider: runtimeConfig.aiProvider || 'kilo',
      aiModel: runtimeConfig.aiModel || 'kilo/stepfun/step-3.7-flash:free',
      aiVariant: runtimeConfig.aiVariant || 'high',
      aiBridgeUrl: runtimeConfig.aiBridgeUrl || './api/fideo/ai',
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
