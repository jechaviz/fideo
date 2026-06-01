export const nowIso = () => new Date().toISOString();

export const makeId = (prefix) => `${prefix}_${Date.now()}_${Math.round(Math.random() * 10000)}`;

export const receipt = (kind, status, message, extra = {}) => ({
  kind,
  status,
  message,
  ...extra,
});

export const pushLog = (state, type, description, details = {}) => {
  state.activityLog.unshift({
    id: makeId('log'),
    type,
    timestamp: nowIso(),
    description,
    details,
  });
};
