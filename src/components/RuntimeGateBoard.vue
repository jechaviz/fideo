<template>
  <section class="mt-4 grid gap-4 xl:grid-cols-[0.75fr_1.25fr]">
    <article class="surface p-4">
      <h2>Gates runtime</h2>
    </article>
    <article class="surface p-4">
      <h2>MySQL snapshot</h2>
    </article>
  </section>
</template>

<script>
import { gateSummary } from '/src/infrastructure/runtimeGates.js';

const { h } = Vue;

export default {
  name: 'RuntimeGateBoard',
  props: {
    gates: { type: Array, required: true },
    pocketbaseRoutes: { type: Array, required: true },
  },
  emits: ['bootstrap-pocketbase', 'persist-snapshot', 'presence-ping', 'plan-realtime', 'plan-ai'],
  computed: {
    summary() {
      return gateSummary(this.gates);
    },
  },
  methods: {
    metric(label, value) {
      return h('div', { class: 'rounded-lg bg-slate-950/40 p-3' }, [
        h('span', { class: 'block text-xs font-black uppercase text-slate-500' }, label),
        h('strong', { class: 'text-lg text-white' }, String(value)),
      ]);
    },
    renderGate(gate) {
      return h('li', { class: 'rounded-lg bg-slate-950/40 p-3 text-sm', key: gate.id }, [
        h('div', { class: 'flex items-start justify-between gap-3' }, [
          h('div', [
            h('strong', { class: 'text-white' }, gate.title),
            h('span', { class: 'block text-slate-300' }, gate.detail),
          ]),
          h('span', { class: 'pill text-xs' }, gate.status),
        ]),
      ]);
    },
  },
  render() {
    return h('section', { class: 'mt-4 grid gap-4 xl:grid-cols-[0.75fr_1.25fr]' }, [
      h('article', { class: 'surface p-4' }, [
        h('h2', { class: 'm-0 text-lg font-black text-white' }, 'Gates runtime'),
        h('div', { class: 'mt-3 grid gap-2 sm:grid-cols-4' }, [
          this.metric('Live/local', this.summary.liveReady),
          this.metric('Configurados', this.summary.configured),
          this.metric('Gated', this.summary.gated),
          this.metric('Dry-run', this.summary.dryRun),
        ]),
        h('ul', { class: 'm-0 mt-3 grid list-none gap-2 p-0' }, this.gates.map(this.renderGate)),
      ]),
      h('article', { class: 'surface p-4' }, [
        h('div', { class: 'flex items-start justify-between gap-3' }, [
          h('div', [
            h('h2', { class: 'm-0 text-lg font-black text-white' }, 'MySQL snapshot'),
            h('p', { class: 'mt-2 text-sm text-slate-400' },
              `${this.pocketbaseRoutes.length} rutas manifestadas con bootstrap, persistencia y mensajes.`),
          ]),
          h('span', { class: 'pill text-xs' }, 'snapshot'),
        ]),
        h('div', { class: 'mt-3 flex flex-wrap gap-2' }, [
          h('button', {
            class: 'focus-ring rounded-lg bg-sky-300 px-3 py-2 text-xs font-black text-slate-950',
            onClick: () => this.$emit('bootstrap-pocketbase'),
          }, 'Bootstrap'),
          h('button', {
            class: 'focus-ring rounded-lg bg-emerald-300 px-3 py-2 text-xs font-black text-slate-950',
            onClick: () => this.$emit('persist-snapshot'),
          }, 'Persistir'),
          h('button', {
            class: 'focus-ring rounded-lg bg-violet-300 px-3 py-2 text-xs font-black text-slate-950',
            onClick: () => this.$emit('presence-ping'),
          }, 'Presencia'),
          h('button', {
            class: 'focus-ring rounded-lg bg-amber-300 px-3 py-2 text-xs font-black text-slate-950',
            onClick: () => this.$emit('plan-realtime'),
          }, 'Realtime'),
          h('button', {
            class: 'focus-ring rounded-lg border border-white/10 px-3 py-2 text-xs font-black text-slate-200',
            onClick: () => this.$emit('plan-ai'),
          }, 'AI plan'),
        ]),
        h('ul', { class: 'm-0 mt-3 flex list-none flex-wrap gap-2 p-0' },
          this.pocketbaseRoutes.slice(0, 8).map((route) =>
            h('li', { class: 'pill text-xs', key: route.id }, `${route.method} ${route.path}`))),
      ]),
    ]);
  },
};
</script>
