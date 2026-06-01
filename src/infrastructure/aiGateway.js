export const createAiGateway = ({ codexGoalPath }) => ({
  async inspect() {
    return {
      kind: 'ai_engine',
      status: 'dry-run',
      message: `Adapter listo para codex-goal en ${codexGoalPath}.`,
      path: codexGoalPath,
    };
  },
  async planInsightRun(workspaceId, intent) {
    return {
      kind: 'ai_engine_plan',
      status: 'dry-run',
      message: `codex-goal planificado para ${intent}.`,
      path: codexGoalPath,
      workspaceId,
    };
  },
});
