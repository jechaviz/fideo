<template>
  <section class="grid gap-4 lg:grid-cols-3">
    <article class="surface p-4">
      <h2 class="m-0 text-lg font-black text-white">Inventario</h2>
      <ul class="m-0 mt-3 grid list-none gap-2 p-0">
        <li v-for="item in state.inventory" :key="item.id" class="rounded-lg bg-slate-950/40 p-3 text-sm">
          <strong class="text-white">{{ item.product }}</strong>
          <span class="block text-slate-300">{{ item.quantity }} · {{ item.state }} · {{ item.quality }}</span>
        </li>
      </ul>
    </article>

    <article class="surface p-4">
      <h2 class="m-0 text-lg font-black text-white">Ventas</h2>
      <ul class="m-0 mt-3 grid list-none gap-2 p-0">
        <li v-for="sale in state.sales" :key="sale.id" class="rounded-lg bg-slate-950/40 p-3 text-sm">
          <strong class="text-white">{{ sale.customer }}</strong>
          <span class="block text-slate-300">{{ sale.product }} · {{ sale.status }}</span>
        </li>
      </ul>
    </article>

    <article class="surface p-4">
      <h2 class="m-0 text-lg font-black text-white">Staff</h2>
      <ul class="m-0 mt-3 grid list-none gap-2 p-0">
        <li v-for="employee in state.employees" :key="employee.id" class="rounded-lg bg-slate-950/40 p-3 text-sm">
          <strong class="text-white">{{ employee.name }}</strong>
          <span class="block text-slate-300">{{ employee.role }} · {{ employee.status }}</span>
        </li>
      </ul>
    </article>
  </section>
</template>

<script>
export default {
  name: 'DomainBoard',
  props: {
    state: { type: Object, required: true },
  },
};
</script>

