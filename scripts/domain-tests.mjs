import assert from 'node:assert/strict';
import { createInitialState } from '../src/domain/fideoState.js';
import { followUpException, reassignException, resolveException } from '../src/domain/operations/exceptionLoop.js';
import { buildPersistableSnapshot, compactRemoteSnapshot } from '../src/domain/snapshotTransport.js';

const state = createInitialState();
const snapshot = buildPersistableSnapshot(state);
const compact = compactRemoteSnapshot(snapshot, snapshot);

assert.equal(compact.customers, undefined);
assert.equal(compact.suppliers, undefined);
assert.equal(compact.taskAssignments.length, 2);

const exception = {
  id: 'task_report:report-route-sale-2',
  taskId: 'route-sale-2',
  reportId: 'report-route-sale-2',
  severity: 'high',
  title: 'Cambio de horario sin confirmar',
  detail: 'Cliente pidio cambio de horario',
  employeeName: 'Ruta Centro',
};

const beforeReports = state.taskReports.length;
const follow = followUpException(state, exception);
assert.equal(state.taskReports.length, beforeReports + 1);
assert.equal(follow.receipt.kind, 'follow_up');

const reassigned = reassignException(state, exception, 'emp-admin');
assert.equal(reassigned.receipt.status, 'ok');
assert.equal(state.taskAssignments.find((task) => task.taskId === exception.taskId).employeeId, 'emp-admin');

const resolved = resolveException(state, exception);
assert.equal(resolved.receipt.kind, 'resolve');
assert.equal(state.taskReports.find((report) => report.id === exception.reportId).status, 'resolved');

console.log('FideoVue domain tests passed.');

