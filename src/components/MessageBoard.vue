<template>
  <section class="mt-4 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
    <article class="surface p-4">
      <h2>Mensajes</h2>
    </article>
    <article class="surface p-4">
      <h2>Campanas</h2>
    </article>
  </section>
</template>

<script>
import { messageStats } from '/src/domain/messages/messageSelectors.js';

const { h } = Vue;

export default {
  name: 'MessageBoard',
  props: {
    state: { type: Object, required: true },
  },
  emits: ['add-message', 'interpret-message', 'approve-message', 'revert-message', 'send-promotion', 'bind-push'],
  computed: {
    stats() {
      return messageStats(this.state);
    },
    firstInterpreted() {
      return this.state.messages.find((message) => message.status === 'interpreted') || null;
    },
  },
  methods: {
    metric(label, value) {
      return h('div', { class: 'rounded-lg bg-slate-950/40 p-3' }, [
        h('span', { class: 'block text-xs font-black uppercase text-slate-500' }, label),
        h('strong', { class: 'text-lg text-white' }, String(value)),
      ]);
    },
    renderMessage(message) {
      const action = message.status === 'pending'
        ? h('button', {
          class: 'focus-ring rounded-lg bg-sky-300 px-2 py-1 text-xs font-black text-slate-950',
          onClick: () => this.$emit('interpret-message', message.id),
        }, 'Interpretar')
        : message.status === 'interpreted'
          ? h('button', {
            class: 'focus-ring rounded-lg bg-emerald-300 px-2 py-1 text-xs font-black text-slate-950',
            onClick: () => this.$emit('approve-message', message.id),
          }, 'Aprobar')
          : message.undoState
            ? h('button', {
              class: 'focus-ring rounded-lg bg-amber-300 px-2 py-1 text-xs font-black text-slate-950',
              onClick: () => this.$emit('revert-message', message.id),
            }, 'Revertir')
            : null;

      return h('li', { class: 'rounded-lg bg-slate-950/40 p-3 text-sm', key: message.id }, [
        h('div', { class: 'flex items-start justify-between gap-3' }, [
          h('div', [
            h('strong', { class: 'text-white' }, message.sender),
            h('span', { class: 'block text-slate-300' }, message.text),
            h('span', { class: 'block text-xs text-slate-500' },
              message.interpretation ? `${message.status} - ${message.interpretation.type}` : message.status),
          ]),
          action,
        ]),
      ]);
    },
  },
  render() {
    return h('section', { class: 'mt-4 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]' }, [
      h('article', { class: 'surface p-4' }, [
        h('div', { class: 'flex items-start justify-between gap-3' }, [
          h('h2', { class: 'm-0 text-lg font-black text-white' }, 'Mensajes IA'),
          h('button', {
            class: 'focus-ring rounded-lg bg-slate-200 px-3 py-2 text-xs font-black text-slate-950',
            onClick: () => this.$emit('add-message'),
          }, 'Nuevo'),
        ]),
        h('div', { class: 'mt-3 grid gap-2 sm:grid-cols-4' }, [
          this.metric('Total', this.stats.total),
          this.metric('Pendientes', this.stats.pending),
          this.metric('Interpretados', this.stats.interpreted),
          this.metric('Aprobados', this.stats.approved),
        ]),
        h('ul', { class: 'm-0 mt-3 grid list-none gap-2 p-0' },
          this.state.messages.slice(-5).toReversed().map((message) => this.renderMessage(message))),
      ]),
      h('article', { class: 'surface p-4' }, [
        h('h2', { class: 'm-0 text-lg font-black text-white' }, 'Campanas y push'),
        h('div', { class: 'mt-3 grid gap-2 sm:grid-cols-2' }, [
          this.metric('Plantillas', this.state.messageTemplates.length),
          this.metric('Push', this.state.push.bindingStatus),
        ]),
        h('div', { class: 'mt-3 flex flex-wrap gap-2' }, [
          h('button', {
            class: 'focus-ring rounded-lg bg-lime-300 px-3 py-2 text-xs font-black text-slate-950',
            onClick: () => this.$emit('send-promotion'),
          }, 'Promocion'),
          h('button', {
            class: 'focus-ring rounded-lg bg-violet-300 px-3 py-2 text-xs font-black text-slate-950',
            onClick: () => this.$emit('bind-push'),
          }, 'Push dry-run'),
        ]),
      ]),
    ]);
  },
};
</script>
