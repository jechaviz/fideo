import { completeSale, markOrderAsPacked } from '../sales/salesActions.js';
import { updateTaskAssignmentStatus } from './taskAssignments.js';

const completionReceipt = (taskId, message) => ({
  kind: 'task_status',
  status: 'ok',
  message,
  taskId,
});

export const completeOperationalTask = (state, taskId, actor = {}) => {
  const task = state.taskAssignments.find((item) => item.taskId === taskId);
  if (!task) return [{ kind: 'task_status', status: 'skipped', message: 'Tarea no encontrada.', taskId }];
  if (task.status !== 'in_progress') {
    return [{
      kind: 'task_status',
      status: 'failed',
      message: 'La tarea debe estar en progreso antes de cerrarse.',
      taskId,
    }];
  }

  if (task.kind === 'PACK_ORDER' && task.saleId) {
    const packed = markOrderAsPacked(state, task.saleId);
    return packed.status === 'ok'
      ? [packed, completionReceipt(taskId, 'Tarea cerrada por empaque completado.')]
      : [packed];
  }

  if (task.kind === 'DELIVER_ORDER' && task.saleId) {
    const completed = completeSale(state, task.saleId, 'Pagado', 'Efectivo');
    return completed.status === 'ok'
      ? [completed, completionReceipt(taskId, 'Tarea cerrada por entrega completada.')]
      : [completed];
  }

  return [updateTaskAssignmentStatus(state, taskId, 'done', actor)];
};
