<template>
  <header class="surface flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
    <div>
      <p class="text-xs font-black uppercase tracking-wide text-lime-300">FideoVue</p>
      <h1 class="m-0 text-2xl font-black text-white">Mesa operativa</h1>
      <p class="m-0 text-sm text-slate-300">{{ workspace.slug }} · v{{ workspace.version }}</p>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <span class="pill flex items-center gap-2 text-sm">
        <span class="status-dot"></span>
        {{ openExceptions }} abiertas
      </span>
      <button class="focus-ring rounded-lg border border-lime-300/40 bg-lime-300 px-3 py-2 text-sm font-black text-slate-950" @click="$emit('inspect')">
        Revisar integraciones
      </button>
    </div>
  </header>
</template>

<script>
const { h } = Vue;

export default {
  name: 'ShellHeader',
  props: {
    openExceptions: { type: Number, required: true },
    workspace: { type: Object, required: true },
  },
  emits: ['inspect'],
  render() {
    return h('header', { class: 'surface flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between' }, [
      h('div', [
        h('p', { class: 'text-xs font-black uppercase tracking-wide text-lime-300' }, 'FideoVue'),
        h('h1', { class: 'm-0 text-2xl font-black text-white' }, 'Mesa operativa'),
        h('p', { class: 'm-0 text-sm text-slate-300' }, `${this.workspace.slug} · v${this.workspace.version}`),
      ]),
      h('div', { class: 'flex flex-wrap items-center gap-2' }, [
        h('span', { class: 'pill flex items-center gap-2 text-sm' }, [
          h('span', { class: 'status-dot' }),
          `${this.openExceptions} abiertas`,
        ]),
        h('button', {
          class: 'focus-ring rounded-lg border border-lime-300/40 bg-lime-300 px-3 py-2 text-sm font-black text-slate-950',
          onClick: () => this.$emit('inspect'),
        }, 'Revisar integraciones'),
      ]),
    ]);
  },
};
</script>
