<template>
  <section class="surface p-4">
    <div class="flex items-center justify-between gap-3">
      <div>
        <p class="m-0 text-xs font-black uppercase tracking-wide text-sky-300">Action Center</p>
        <h2 class="m-0 text-xl font-black text-white">Excepciones operativas</h2>
      </div>
      <span class="pill text-sm">{{ exceptions.length }} activas</span>
    </div>

    <div class="mt-4 grid gap-3">
      <article v-for="item in exceptions" :key="item.id" class="rounded-lg border border-slate-700/80 bg-slate-950/45 p-3">
        <div class="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <p class="m-0 text-sm font-black text-white">{{ item.title }}</p>
            <p class="m-0 text-sm text-slate-300">{{ item.detail }}</p>
            <p class="m-0 mt-2 text-xs text-slate-400">{{ item.employeeName || 'Sin responsable' }}</p>
          </div>

          <div class="flex flex-wrap gap-2">
            <button class="focus-ring rounded-lg bg-sky-300 px-3 py-2 text-xs font-black text-slate-950" @click="$emit('follow-up', item)">
              Follow-up
            </button>
            <button class="focus-ring rounded-lg bg-emerald-300 px-3 py-2 text-xs font-black text-slate-950" @click="$emit('resolve', item)">
              Resolver
            </button>
          </div>
        </div>

        <label class="mt-3 block text-xs font-bold uppercase text-slate-400">
          Reasignar
          <select class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-sm text-white" @change="onReassign(item, $event)">
            <option value="">Seleccionar responsable</option>
            <option v-for="employee in employees" :key="employee.id" :value="employee.id">
              {{ employee.name }} · {{ employee.role }}
            </option>
          </select>
        </label>
      </article>

      <p v-if="exceptions.length === 0" class="rounded-lg border border-emerald-300/30 bg-emerald-300/10 p-4 text-sm text-emerald-100">
        Sin excepciones abiertas.
      </p>
    </div>
  </section>
</template>

<script>
export default {
  name: 'ActionCenterPanel',
  props: {
    employees: { type: Array, required: true },
    exceptions: { type: Array, required: true },
  },
  emits: ['follow-up', 'resolve', 'reassign'],
  setup(_props, { emit }) {
    const onReassign = (item, event) => {
      const employeeId = event.target.value;
      if (employeeId) emit('reassign', item, employeeId);
      event.target.value = '';
    };
    return { onReassign };
  },
};
</script>

