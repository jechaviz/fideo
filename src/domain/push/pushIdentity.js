export const createEmptyPushState = () => ({
  enabled: false,
  bindingStatus: 'disabled',
  permission: false,
  tags: {},
  aliases: {},
  lastError: '',
});

export const buildPushIdentity = (profile, workspace) => {
  if (!profile || !workspace) return null;
  const externalId = profile.pushExternalId || profile.id;
  return {
    externalId,
    externalIdSource: profile.pushExternalId ? 'pushExternalId' : 'userId',
    userId: profile.id,
    role: profile.role || 'Admin',
    workspaceId: workspace.id,
    workspaceSlug: workspace.slug,
    employeeId: profile.employeeId || null,
    customerId: profile.customerId || null,
    supplierId: profile.supplierId || null,
    channel: profile.channel || 'web',
  };
};

export const buildPushTags = (identity) => {
  if (!identity) return {};
  const tags = {
    app: 'fideo',
    role: identity.role,
    workspace_id: identity.workspaceId,
    workspace_slug: identity.workspaceSlug,
    channel: identity.channel,
    user_id: identity.userId,
    push_external_id: identity.externalId,
    external_id_source: identity.externalIdSource,
    auth_source: 'mysql',
  };
  if (identity.employeeId) tags.employee_id = identity.employeeId;
  if (identity.customerId) tags.customer_id = identity.customerId;
  if (identity.supplierId) tags.supplier_id = identity.supplierId;
  return tags;
};

export const planPushBinding = (profile, workspace) => {
  const identity = buildPushIdentity(profile, workspace);
  if (!identity) return createEmptyPushState();
  return {
    enabled: false,
    bindingStatus: 'dry-run',
    permission: false,
    tags: buildPushTags(identity),
    aliases: {
      fideo_user_id: identity.userId,
      workspace_id: identity.workspaceId,
      workspace_slug: identity.workspaceSlug,
    },
    lastError: '',
  };
};
