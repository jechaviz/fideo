<template>
  <section class="mt-4 grid gap-4 xl:grid-cols-3">
    <article class="surface p-4">
      <h2>Insights IA</h2>
    </article>
    <article class="surface p-4">
      <h2>Correccion remota</h2>
    </article>
    <article class="surface p-4">
      <h2>Campanas segmentadas</h2>
    </article>
  </section>
</template>

<script>
import {
  aiInsightCards,
  campaignDrafts,
  correctionQueue,
} from '/src/domain/messages/messageInsights.js';

const { h } = Vue;

export default {
  name: 'MessageAiOpsBoard',
  props: {
    state: { type: Object, required: true },
  },
  emits: ['correct-message', 'train-ai', 'send-campaign', 'update-template'],
  computed: {
    insights() {
      return aiInsightCards(this.state);
    },
    corrections() {
      return correctionQueue(this.state);
    },
    drafts() {
      return campaignDrafts(this.state);
    },
    firstTemplate() {
      return this.state.messageTemplates.find((template) => template.type === 'promotion') || this.state.messageTemplates[0];
    },
  },
  methods: {
    renderInsight(insight) {
      return h('li', { class: 'rounded-lg bg-slate-950/40 p-3 text-sm', key: insight.id }, [
        h('strong', { class: insight.priority === 'high' ? 'text-amber-100' : 'text-white' }, insight.title),
        h('span', { class: 'block text-slate-300' }, insight.detail),
        h('span', { class: 'block text-xs font-bold text-sky-200' }, insight.action),
      ]);
    },
    renderInsights() {
      return h('article', { class: 'surface p-4' }, [
        h('div', { class: 'flex items-start justify-between gap-3' }, [
          h('h2', { class: 'm-0 text-lg font-black text-white' }, 'Insights IA'),
          h('button', {
            class: 'focus-ring rounded-lg bg-violet-300 px-3 py-2 text-xs font-black text-slate-950',
            onClick: () => this.$emit('train-ai'),
          }, 'Entrenar'),
        ]),
        this.insights.length
          ? h('ul', { class: 'm-0 mt-3 grid list-none gap-2 p-0' }, this.insights.map(this.renderInsight))
          : h('p', { class: 'mt-3 text-sm text-slate-400' }, 'Sin insights pendientes.'),
      ]);
    },
    renderCorrection(message) {
      return h('li', { class: 'rounded-lg bg-slate-950/40 p-3 text-sm', key: message.id }, [
        h('div', { class: 'flex items-start justify-between gap-3' }, [
          h('div', [
            h('strong', { class: 'text-white' }, message.sender),
            h('span', { class: 'block text-slate-300' }, message.interpretation?.type || 'Sin tipo'),
            h('span', { class: 'block text-xs text-slate-500' },
              `certeza ${Math.round(Number(message.interpretation?.certainty || 0) * 100)}%`),
          ]),
          h('button', {
            class: 'focus-ring rounded-lg bg-amber-300 px-2 py-1 text-xs font-black text-slate-950',
            onClick: () => this.$emit('correct-message', message.id),
          }, 'Corregir'),
        ]),
      ]);
    },
    renderCorrections() {
      return h('article', { class: 'surface p-4' }, [
        h('h2', { class: 'm-0 text-lg font-black text-white' }, 'Correccion remota'),
        h('p', { class: 'mt-2 text-sm text-slate-400' },
          'Contrato dry-run: PocketBase correct/revert + codex-goal sin SDK cliente.'),
        this.corrections.length
          ? h('ul', { class: 'm-0 mt-3 grid list-none gap-2 p-0' }, this.corrections.map(this.renderCorrection))
          : h('p', { class: 'mt-3 text-sm text-slate-400' }, 'Sin correcciones abiertas.'),
      ]);
    },
    renderDraft(draft) {
      return h('li', { class: 'rounded-lg bg-slate-950/40 p-3 text-sm', key: draft.id }, [
        h('strong', { class: 'text-white' }, draft.title),
        h('span', { class: 'block text-slate-300' }, draft.message),
        h('span', { class: 'block text-xs text-slate-500' },
          `${draft.targetIds.length} destinatario(s) - ${draft.quantity} unidades`),
      ]);
    },
    renderCampaigns() {
      return h('article', { class: 'surface p-4' }, [
        h('div', { class: 'flex items-start justify-between gap-3' }, [
          h('h2', { class: 'm-0 text-lg font-black text-white' }, 'Campanas segmentadas'),
          h('button', {
            class: 'focus-ring rounded-lg bg-lime-300 px-3 py-2 text-xs font-black text-slate-950',
            onClick: () => this.$emit('send-campaign'),
          }, 'Enviar'),
        ]),
        this.drafts.length
          ? h('ul', { class: 'm-0 mt-3 grid list-none gap-2 p-0' }, this.drafts.map(this.renderDraft))
          : h('p', { class: 'mt-3 text-sm text-slate-400' }, 'Sin stock listo para campana.'),
        this.firstTemplate ? h('button', {
          class: 'focus-ring mt-3 rounded-lg border border-white/10 px-3 py-2 text-xs font-black text-slate-200',
          onClick: () => this.$emit('update-template', this.firstTemplate.id),
        }, 'Actualizar plantilla') : null,
      ]);
    },
  },
  render() {
    return h('section', { class: 'mt-4 grid gap-4 xl:grid-cols-3' }, [
      this.renderInsights(),
      this.renderCorrections(),
      this.renderCampaigns(),
    ]);
  },
};
</script>
