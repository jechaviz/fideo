export const createAiGateway = ({ codexGoalPath }) => ({
  async inspect() {
    return {
      kind: 'ai_engine',
      status: 'dry-run',
      message: `Adapter listo para codex-goal en ${codexGoalPath}.`,
      path: codexGoalPath,
    };
  },
});

