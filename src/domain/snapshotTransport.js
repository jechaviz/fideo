const compactOmitKeys = ['productGroups', 'sizes', 'warehouses', 'customers', 'suppliers'];

const clone = (value) => JSON.parse(JSON.stringify(value));

const equalJson = (left, right) => {
  try {
    return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
  } catch {
    return false;
  }
};

export const buildPersistableSnapshot = (state) => {
  const {
    workspace,
    employees,
    productGroups,
    sizes,
    warehouses,
    customers,
    suppliers,
    prices,
    crateTypes,
    crateInventory,
    expenses,
    payments,
    purchaseOrders,
    cashDrawers,
    cashDrawerActivities,
    crateLoans,
    ripeningRules,
    inventory,
    sales,
    taskAssignments,
    taskReports,
    messages,
    messageTemplates,
    push,
    systemPrompt,
    activityLog,
  } = state;

  return clone({
    workspace,
    employees,
    productGroups,
    sizes,
    warehouses,
    customers,
    suppliers,
    prices,
    crateTypes,
    crateInventory,
    expenses,
    payments,
    purchaseOrders,
    cashDrawers,
    cashDrawerActivities,
    crateLoans,
    ripeningRules,
    inventory,
    sales,
    taskAssignments,
    taskReports,
    messages,
    messageTemplates,
    push,
    systemPrompt,
    activityLog,
  });
};

export const compactRemoteSnapshot = (snapshot, referenceSnapshot = null) => {
  const compact = clone(snapshot);
  compactOmitKeys.forEach((key) => {
    if (!referenceSnapshot || equalJson(snapshot[key], referenceSnapshot[key])) {
      delete compact[key];
    }
  });
  return compact;
};

export const mergeRuntimeIntoSnapshot = (snapshot, runtime = {}) => ({
  ...clone(snapshot || {}),
  presenceRoster: runtime.staffPresence?.roster || runtime.staffPresence || [],
  operationalExceptions: runtime.operationalExceptions?.items || runtime.exceptionInbox || [],
});

export const normalizePersistResult = (payload = {}) => ({
  version: Number(payload.version || 0),
  snapshotRecordId: String(payload.snapshotRecordId || ''),
  updatedAt: payload.updatedAt || new Date().toISOString(),
  snapshot: payload.snapshot ? clone(payload.snapshot) : null,
  runtimeOverview: payload.runtimeOverview || null,
});

export const isConflictPayload = (payload = {}) =>
  Number(payload.status || payload.code || 0) === 409 || Number(payload.version || 0) > 0;

export class SnapshotConflictError extends Error {
  constructor(message, payload = {}) {
    super(message);
    this.name = 'SnapshotConflictError';
    this.version = Number(payload.version || 0);
    this.snapshotRecordId = String(payload.snapshotRecordId || '');
  }
}
