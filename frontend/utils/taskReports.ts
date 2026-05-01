import { BusinessState, TaskAssignment, TaskReport, TaskReportInput, TaskReportSeverity, TaskReportStatus } from '../types';
import { updateTaskAssignmentStatus } from './taskAssignments';

const readString = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : null);

const normalizeKind = (value: unknown): TaskReportInput['kind'] | null => {
    const normalized = readString(value)?.toLowerCase();
    if (!normalized) return null;

    if (normalized === 'note' || normalized === 'nota') return 'note';
    if (normalized === 'incident' || normalized === 'incidencia') return 'incident';
    if (normalized === 'blocker' || normalized === 'blocked' || normalized === 'bloqueo') return 'blocker';
    if (normalized === 'completion' || normalized === 'completed' || normalized === 'closure' || normalized === 'cierre') return 'completion';

    return null;
};

export const normalizeTaskReportInput = (input: TaskReportInput | Record<string, unknown>): TaskReportInput | null => {
    const normalizedKind = normalizeKind((input as Record<string, unknown>).kind ?? (input as Record<string, unknown>).type);
    const summary = readString((input as Record<string, unknown>).summary) || readString((input as Record<string, unknown>).message);
    if (!normalizedKind || !summary) return null;

    const severity = readString((input as Record<string, unknown>).severity) === 'high'
        ? 'high'
        : normalizedKind === 'blocker'
          ? 'high'
          : 'normal';

    const evidence = readString((input as Record<string, unknown>).evidence);
    const detail = readString((input as Record<string, unknown>).detail);
    const nextTaskStatus = (input as Record<string, unknown>).nextTaskStatus;
    const inferredTaskStatus =
        normalizedKind === 'blocker'
            ? 'blocked'
            : normalizedKind === 'completion'
              ? 'done'
              : undefined;

    return {
        kind: normalizedKind,
        summary,
        detail: detail || undefined,
        evidence: evidence || undefined,
        severity,
        nextTaskStatus:
            nextTaskStatus === 'assigned'
            || nextTaskStatus === 'acknowledged'
            || nextTaskStatus === 'in_progress'
            || nextTaskStatus === 'blocked'
            || nextTaskStatus === 'done'
                ? nextTaskStatus
                : inferredTaskStatus,
    };
};

const normalizeTaskReportSeverity = (severity?: TaskReportSeverity): TaskReportSeverity => (severity === 'high' ? 'high' : 'normal');

const normalizeTaskReportStatus = (input: TaskReportInput): TaskReportStatus => {
    if (input.kind === 'blocker' || input.kind === 'incident') {
        return 'open';
    }

    return 'resolved';
};

const shouldEscalateReport = (input: TaskReportInput) =>
    input.kind === 'blocker' || normalizeTaskReportSeverity(input.severity) === 'high';

const findTaskById = (state: BusinessState, taskId: string): TaskAssignment | null =>
    state.taskAssignments.find((task) => task.id === taskId) || null;

export const syncTaskReportsWithTasks = (state: BusinessState): TaskReport[] => {
    if (!state.taskReports.length) return state.taskReports;

    const taskById = new Map(state.taskAssignments.map((task) => [task.id, task]));
    let changed = false;
    const now = new Date();

    const nextReports = state.taskReports.map((report) => {
        if (report.status !== 'open') return report;

        const task = taskById.get(report.taskId);
        if (!task) return report;

        if (report.kind === 'blocker' && task.status !== 'blocked') {
            changed = true;
            const escalationStatus: TaskReport['escalationStatus'] = report.escalationStatus === 'sent' ? 'sent' : 'none';
            return {
                ...report,
                status: 'resolved' as const,
                resolvedAt: report.resolvedAt || now,
                escalationStatus,
            };
        }

        if (report.kind === 'incident' && task.status === 'done') {
            changed = true;
            return {
                ...report,
                status: 'resolved' as const,
                resolvedAt: report.resolvedAt || now,
            };
        }

        return report;
    });

    return changed ? nextReports : state.taskReports;
};

export const submitTaskReportLocally = (
    state: BusinessState,
    taskId: string,
    input: TaskReportInput,
    actor: { employeeId?: string | null; employeeName?: string | null } = {},
): { nextState: BusinessState; report: TaskReport | null } => {
    const task = findTaskById(state, taskId);
    if (!task || !input.summary.trim()) {
        return { nextState: state, report: null };
    }

    const now = new Date();
    const blockReason = input.nextTaskStatus === 'blocked'
        ? input.detail?.trim() || input.summary.trim()
        : undefined;

    const stateWithTaskUpdate = input.nextTaskStatus
        ? updateTaskAssignmentStatus(state, taskId, input.nextTaskStatus, actor, blockReason)
        : state;
    const nextTask = findTaskById(stateWithTaskUpdate, taskId) || task;
    const severity = normalizeTaskReportSeverity(input.severity);
    const status = normalizeTaskReportStatus(input);
    const report: TaskReport = {
        id: `task_report_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        taskId: nextTask.id,
        saleId: nextTask.saleId || null,
        role: nextTask.role,
        employeeId: actor.employeeId ?? nextTask.employeeId ?? null,
        employeeName: actor.employeeName ?? nextTask.employeeName ?? null,
        customerId: nextTask.customerId || null,
        customerName: nextTask.customerName || null,
        taskTitle: nextTask.title,
        kind: input.kind,
        status,
        severity,
        summary: input.summary.trim(),
        detail: input.detail?.trim() || undefined,
        evidence: input.evidence?.trim() || undefined,
        escalationStatus: shouldEscalateReport(input) ? 'pending' : 'none',
        createdAt: now,
        resolvedAt: status === 'resolved' ? now : undefined,
    };

    const nextReports = [report, ...stateWithTaskUpdate.taskReports].sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
    );

    return {
        nextState: {
            ...stateWithTaskUpdate,
            taskReports: nextReports,
        },
        report,
    };
};
