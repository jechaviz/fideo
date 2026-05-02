# Fideo Jefe En Celular Roadmap

Estado al 2026-05-02.

## Base ya cerrada sobre PocketBase

- `bootstrap` remoto sano para workspace + usuario + identidad operativa
- `persist` versionado con recarga en conflictos
- `runtimeOverview` con roster global y cola de excepciones
- `follow-up`, `reassign` y `resolve` server-side sobre la misma excepcion origen
- `taskAssignments` y `taskReports` ya materializados y reconstruidos al snapshot
- SLA vivo y push operativo cuando OneSignal esta configurado

La base ya no depende de "cerrar PocketBase". Esa parte ya quedo. El roadmap correcto ahora es endurecer el uso de esa base.

## Lo siguiente

1. Llevar el contrato `employeeId` + `pushExternalId` a clientes staff mas cerrados y dedicados.
2. Reducir mutacion local en triage y dejar ownership/politicas mas claramente server-side.
3. Ampliar el SLA por prioridad, horario, ventana y politica por rol.
4. Meter subscriptions mas finas solo donde quiten friccion real.
5. Volver mas personales las vistas staff y el seguimiento desde celular.
6. Despues de eso, abrir voz de entrada y automatizacion mas ambiciosa.

## No perseguir todavia

- multiplayer fino record-by-record
- workflows paralelos a `taskAssignments` y `taskReports`
- automatizacion agresiva sin mejor auditoria y ownership
