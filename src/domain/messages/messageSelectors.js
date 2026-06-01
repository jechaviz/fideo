export const messageStats = (state) => ({
  total: state.messages.length,
  pending: state.messages.filter((message) => message.status === 'pending' || message.status === 'interpreting').length,
  interpreted: state.messages.filter((message) => message.status === 'interpreted').length,
  approved: state.messages.filter((message) => message.status === 'approved').length,
});

export const nextActionableMessage = (state) =>
  state.messages.find((message) => message.status === 'pending' || message.status === 'interpreted') || null;

export const templateGroups = (state) =>
  state.messageTemplates.reduce((acc, template) => {
    acc[template.type] ||= [];
    acc[template.type].push(template);
    return acc;
  }, {});
