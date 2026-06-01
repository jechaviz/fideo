export const pocketBaseRouteManifest = [
  { id: 'bootstrap', method: 'POST', path: '/api/fideo/bootstrap', mutates: true },
  { id: 'presence_ping', method: 'POST', path: '/api/fideo/presence/ping', mutates: true },
  { id: 'runtime_overview', method: 'GET', path: '/api/fideo/runtime/overview', mutates: false },
  { id: 'state_persist', method: 'POST', path: '/api/fideo/state/persist', mutates: true },
  { id: 'tasks_report', method: 'POST', path: '/api/fideo/tasks/report', mutates: true },
  { id: 'exceptions_reassign', method: 'POST', path: '/api/fideo/exceptions/reassign', mutates: true },
  { id: 'tasks_reassign', method: 'POST', path: '/api/fideo/tasks/reassign', mutates: true },
  { id: 'exceptions_resolve', method: 'POST', path: '/api/fideo/exceptions/resolve', mutates: true },
  { id: 'tasks_resolve', method: 'POST', path: '/api/fideo/tasks/resolve', mutates: true },
  { id: 'reports_resolve', method: 'POST', path: '/api/fideo/reports/resolve', mutates: true },
  { id: 'exceptions_follow_up', method: 'POST', path: '/api/fideo/exceptions/follow-up', mutates: true },
  { id: 'tasks_follow_up', method: 'POST', path: '/api/fideo/tasks/follow-up', mutates: true },
  { id: 'reports_follow_up', method: 'POST', path: '/api/fideo/reports/follow-up', mutates: true },
  { id: 'cash_follow_up', method: 'POST', path: '/api/fideo/cash/follow-up', mutates: true },
  { id: 'messages_interpret', method: 'POST', path: '/api/fideo/messages/interpret', mutates: true },
  { id: 'messages_approve', method: 'POST', path: '/api/fideo/messages/approve', mutates: true },
  { id: 'messages_correct', method: 'POST', path: '/api/fideo/messages/correct', mutates: true },
  { id: 'messages_revert', method: 'POST', path: '/api/fideo/messages/revert', mutates: true },
  { id: 'messages_undo', method: 'POST', path: '/api/fideo/messages/undo', mutates: true },
];

export const routeById = (routeId) =>
  pocketBaseRouteManifest.find((route) => route.id === routeId) || null;

export const mutatingPocketBaseRoutes = () =>
  pocketBaseRouteManifest.filter((route) => route.mutates);
