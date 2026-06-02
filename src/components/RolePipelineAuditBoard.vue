<template>
  <section class="mt-4 grid gap-4">
    <article class="surface p-4">
      <h2>Auditoria roles</h2>
    </article>
  </section>
</template>

<script>
import { rolePipelineAudit } from '/src/domain/operations/rolePipelineAudit.js';

const { h } = Vue;

const statusLabel = {
  ok: 'OK',
  info: 'Info',
  warning: 'Atencion',
  critical: 'Critico',
};

const statusClass = {
  ok: 'border-emerald-400/30 bg-emerald-300/10 text-emerald-100',
  info: 'border-sky-400/30 bg-sky-300/10 text-sky-100',
  warning: 'border-amber-400/30 bg-amber-300/10 text-amber-100',
  critical: 'border-rose-400/30 bg-rose-300/10 text-rose-100',
};

export default {
  name: 'RolePipelineAuditBoard',
  props: {
    state: { type: Object, required: true },
  },
  computed: {
    audit() {
      return rolePipelineAudit(this.state);
    },
  },
  methods: {
    badge(status) {
      return h('span', {
        class: `inline-flex rounded-full border px-2 py-1 text-[10px] font-black uppercase ${statusClass[status] || statusClass.info}`,
      }, statusLabel[status] || status);
    },
    metric(label, value) {
      return h('div', { class: 'rounded-lg bg-slate-950/40 p-3' }, [
        h('span', { class: 'block text-xs font-black uppercase text-slate-500' }, label),
        h('strong', { class: 'text-lg text-white' }, String(value)),
      ]);
    },
    renderObjective(objective) {
      return h('li', { class: 'rounded-lg bg-slate-950/40 p-3 text-sm', key: objective.id }, [
        h('div', { class: 'flex items-start justify-between gap-3' }, [
          h('div', { class: 'min-w-0' }, [
            h('strong', { class: 'text-white' }, objective.label),
            h('span', { class: 'block text-slate-300' }, objective.value),
            h('span', { class: 'block text-xs text-slate-500' }, objective.detail),
          ]),
          this.badge(objective.status),
        ]),
      ]);
    },
    renderRole(card) {
      return h('li', { class: 'rounded-lg bg-slate-950/40 p-3 text-sm', key: card.id }, [
        h('div', { class: 'flex items-start justify-between gap-3' }, [
          h('div', [
            h('strong', { class: 'text-white' }, card.role),
            h('span', { class: 'block text-slate-300' }, card.objective),
          ]),
          this.badge(card.status),
        ]),
        h('ul', { class: 'm-0 mt-3 grid list-none gap-1 p-0 text-xs text-slate-400' },
          card.facts.map((fact) => h('li', { key: fact }, fact))),
        h('p', { class: 'm-0 mt-3 text-xs font-bold text-sky-200' }, card.nextAction),
      ]);
    },
    renderRisk(risk) {
      return h('li', { class: 'rounded-lg bg-slate-950/40 p-3 text-sm', key: risk.id }, [
        h('div', { class: 'flex items-start justify-between gap-3' }, [
          h('div', [
            h('strong', { class: risk.tone === 'critical' ? 'text-rose-100' : 'text-white' }, risk.title),
            h('span', { class: 'block text-slate-300' }, risk.detail),
            h('span', { class: 'block text-xs text-slate-500' }, `${risk.owner} - ${risk.hidden ? 'oculto' : 'visible'}`),
          ]),
          this.badge(risk.tone),
        ]),
      ]);
    },
  },
  render() {
    return h('section', { class: 'mt-4 grid gap-4' }, [
      h('article', { class: 'surface p-4' }, [
        h('div', { class: 'flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between' }, [
          h('div', [
            h('p', { class: 'm-0 text-xs font-black uppercase text-sky-200' }, 'Auditoria roles'),
            h('h2', { class: 'm-0 mt-1 text-2xl font-black text-white' }, this.audit.summary.headline),
          ]),
          h('div', { class: 'flex flex-wrap gap-2' }, [
            this.badge(this.audit.summary.status),
            h('span', { class: 'pill text-xs' },
              this.audit.summary.adminKnowsEverything ? 'Admin informado' : 'Riesgo oculto'),
            h('span', { class: 'pill text-xs' },
              this.audit.summary.objectivesAchieved ? 'Objetivos OK' : 'Objetivos abiertos'),
          ]),
        ]),
        h('div', { class: 'mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4' }, [
          this.metric('Criticos', this.audit.summary.critical),
          this.metric('Advertencias', this.audit.summary.warning),
          this.metric('Ocultos', this.audit.summary.hiddenRisks),
          this.metric('Visibles', this.audit.summary.visibleRisks),
        ]),
        h('ul', { class: 'm-0 mt-3 grid list-none gap-2 p-0 md:grid-cols-2 xl:grid-cols-5' },
          this.audit.objectives.map(this.renderObjective)),
      ]),
      h('div', { class: 'grid gap-4 xl:grid-cols-[1.15fr_0.85fr]' }, [
        h('article', { class: 'surface p-4' }, [
          h('h2', { class: 'm-0 text-lg font-black text-white' }, 'Pipelines por rol'),
          h('ul', { class: 'm-0 mt-3 grid list-none gap-2 p-0 md:grid-cols-2 xl:grid-cols-3' },
            this.audit.roleCards.map(this.renderRole)),
        ]),
        h('article', { class: 'surface p-4' }, [
          h('div', { class: 'flex items-start justify-between gap-3' }, [
            h('h2', { class: 'm-0 text-lg font-black text-white' }, 'Riesgos'),
            h('span', { class: 'pill text-xs' }, String(this.audit.risks.length)),
          ]),
          this.audit.risks.length
            ? h('ul', { class: 'm-0 mt-3 grid list-none gap-2 p-0' }, this.audit.risks.slice(0, 8).map(this.renderRisk))
            : h('p', { class: 'mt-3 text-sm text-slate-400' }, 'Sin riesgos abiertos.'),
        ]),
      ]),
    ]);
  },
};
</script>
