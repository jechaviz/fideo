const FIDEO_PUSH_ENABLED = $os.getenv('ONESIGNAL_ENABLED') !== '0';
const FIDEO_PUSH_APP_ID = $os.getenv('ONESIGNAL_APP_ID') || $os.getenv('VITE_ONESIGNAL_APP_ID') || '';
const FIDEO_PUSH_REST_API_KEY =
    $os.getenv('ONESIGNAL_REST_API_KEY')
    || $os.getenv('FIDEO_ONESIGNAL_REST_API_KEY')
    || $os.getenv('VITE_ONESIGNAL_REST_API_KEY')
    || '';
const FIDEO_PUSH_URL =
    $os.getenv('FIDEO_APP_URL')
    || $os.getenv('VITE_FIDEO_APP_URL')
    || $os.getenv('VITE_APP_URL')
    || '';
const FIDEO_TASK_ACK_ESCALATION_MINUTES = (() => {
    const parsed = Number($os.getenv('FIDEO_TASK_ACK_ESCALATION_MINUTES') || $os.getenv('TASK_ACK_ESCALATION_MINUTES') || 20);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 20;
})();

function fideoPushText(value, fallback) {
    return value === undefined || value === null || value === '' ? (fallback || '') : String(value);
}

function fideoPushNormalizeText(value) {
    return fideoPushText(value, '').trim().toLowerCase();
}

function fideoPushArray(value) {
    if (Array.isArray(value)) {
        return value;
    }

    if (value !== undefined && value !== null && fideoPushText(value, '').trim()) {
        try {
            const parsed = JSON.parse(String(value));
            return Array.isArray(parsed) ? parsed : [];
        } catch (_) {
            return [];
        }
    }

    return [];
}

function fideoPushObject(value) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        try {
            const normalized = JSON.parse(JSON.stringify(value));
            return normalized && typeof normalized === 'object' && !Array.isArray(normalized) ? normalized : {};
        } catch (_) {
            return value;
        }
    }

    if (value !== undefined && value !== null && fideoPushText(value, '').trim()) {
        try {
            const parsed = JSON.parse(String(value));
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
        } catch (_) {
            return {};
        }
    }

    return {};
}

function fideoPushUnique(values) {
    const seen = {};
    const result = [];

    fideoPushArray(values).forEach((value) => {
        const normalized = fideoPushText(value, '').trim();
        if (!normalized || seen[normalized]) {
            return;
        }

        seen[normalized] = true;
        result.push(normalized);
    });

    return result;
}

function fideoPushEscapeFilterLiteral(value) {
    return fideoPushText(value, '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function fideoPushIsConfigured() {
    return !!(FIDEO_PUSH_ENABLED && FIDEO_PUSH_APP_ID && FIDEO_PUSH_REST_API_KEY);
}

function fideoPushBuildFilters(tags) {
    const filters = [];

    Object.entries(tags || {}).forEach(([key, value]) => {
        const normalized = fideoPushText(value, '').trim();
        if (!normalized) {
            return;
        }

        if (filters.length) {
            filters.push({ operator: 'AND' });
        }

        filters.push({
            field: 'tag',
            key,
            relation: '=',
            value: normalized,
        });
    });

    return filters;
}

function fideoPushParseRawResponse(raw) {
    const rawText = fideoPushText(raw, '');
    if (!rawText.trim()) {
        return {};
    }

    try {
        return JSON.parse(rawText);
    } catch (_) {
        return {};
    }
}

function fideoPushSend(payload) {
    if (!fideoPushIsConfigured()) {
        return { ok: false, skipped: true, reason: 'not_configured' };
    }

    const normalized = fideoPushObject(payload);
    const externalIds = fideoPushUnique(normalized.externalIds);
    const filters = fideoPushArray(normalized.filters);
    if (!externalIds.length && !filters.length) {
        return { ok: false, skipped: true, reason: 'no_audience' };
    }

    const body = {
        app_id: FIDEO_PUSH_APP_ID,
        target_channel: 'push',
        headings: {
            en: fideoPushText(normalized.title, 'Fideo'),
            es: fideoPushText(normalized.title, 'Fideo'),
        },
        contents: {
            en: fideoPushText(normalized.message, ''),
            es: fideoPushText(normalized.message, ''),
        },
        data: fideoPushObject(normalized.data),
    };

    const launchUrl = fideoPushText(normalized.url, FIDEO_PUSH_URL);
    if (launchUrl) {
        body.url = launchUrl;
    }

    if (externalIds.length) {
        body.include_aliases = { external_id: externalIds };
    } else {
        body.filters = filters;
    }

    const response = $http.send({
        url: 'https://api.onesignal.com/notifications',
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: 'Key ' + FIDEO_PUSH_REST_API_KEY,
        },
        body: JSON.stringify(body),
        timeout: 20,
    });

    const responseBody = fideoPushParseRawResponse(response.raw);
    if (response.statusCode >= 400) {
        console.log('[fideo.pb] OneSignal error:', response.statusCode, response.raw);
    }

    return {
        ok: response.statusCode < 400,
        skipped: false,
        reason: '',
        statusCode: response.statusCode,
        responseId: fideoPushText(responseBody.id, ''),
        raw: fideoPushText(response.raw, ''),
    };
}

function fideoPushGetWorkspaceSlug(app, workspaceId) {
    const normalizedWorkspaceId = fideoPushText(workspaceId, '');
    if (!normalizedWorkspaceId) {
        return '';
    }

    try {
        const record = app.findRecordById('fideo_workspaces', normalizedWorkspaceId);
        return fideoPushText(record.get('slug'), '');
    } catch (_) {
        return '';
    }
}

function fideoPushFindWorkspaceUsers(app, workspaceId) {
    const normalizedWorkspaceId = fideoPushText(workspaceId, '');
    if (!normalizedWorkspaceId) {
        return [];
    }

    try {
        return app.findRecordsByFilter(
            'fideo_users',
            "workspace = '" + fideoPushEscapeFilterLiteral(normalizedWorkspaceId) + "'",
            '',
            200,
            0,
        );
    } catch (_) {
        return [];
    }
}

function fideoPushResolveAudience(app, workspaceId, audience) {
    const normalizedAudience = fideoPushObject(audience);
    const workspaceSlug = fideoPushText(
        normalizedAudience.workspaceSlug,
        fideoPushGetWorkspaceSlug(app, workspaceId) || 'main',
    );
    const roles = fideoPushUnique(fideoPushArray(normalizedAudience.roles).map((role) => fideoPushText(role, '')));
    const employeeId = fideoPushText(normalizedAudience.employeeId, '');
    const employeeName = fideoPushText(normalizedAudience.employeeName, '');
    const wantsDispatch = normalizedAudience.dispatch === true;
    const users = fideoPushFindWorkspaceUsers(app, workspaceId);

    let matchedUsers = [];
    if (employeeId) {
        matchedUsers = users.filter((record) => fideoPushText(record.get('employeeId'), '') === employeeId);
    }

    if (!matchedUsers.length && employeeName) {
        matchedUsers = users.filter(
            (record) => fideoPushNormalizeText(record.get('name')) === fideoPushNormalizeText(employeeName),
        );
    }

    if (!matchedUsers.length && roles.length) {
        matchedUsers = users.filter((record) => roles.indexOf(fideoPushText(record.get('role'), '')) >= 0);
    }

    if (!matchedUsers.length && wantsDispatch) {
        matchedUsers = users.filter(
            (record) => fideoPushText(record.get('role'), '') === 'Admin' || !!record.get('canSwitchRoles'),
        );
    }

    const externalIds = fideoPushUnique(
        matchedUsers.map((record) => {
            const explicitExternalId = fideoPushText(record.get('pushExternalId'), '');
            return explicitExternalId || record.id;
        }),
    );

    const tags = Object.assign(
        {
            app: 'fideo',
            workspace_slug: workspaceSlug,
        },
        fideoPushObject(normalizedAudience.tags),
    );

    if (roles.length === 1) {
        tags.role = roles[0];
    } else if (!roles.length && wantsDispatch) {
        tags.role = 'Admin';
    }

    if (employeeId) {
        tags.employee_id = employeeId;
    }

    return {
        workspaceSlug,
        externalIds,
        filters: externalIds.length ? [] : fideoPushBuildFilters(tags),
        tags,
        matchedUsers: matchedUsers.map((record) => ({
            id: record.id,
            name: fideoPushText(record.get('name'), ''),
            role: fideoPushText(record.get('role'), ''),
            employeeId: fideoPushText(record.get('employeeId'), ''),
            pushExternalId: fideoPushText(record.get('pushExternalId'), ''),
        })),
    };
}

function fideoPushFindEmployee(snapshot, employeeId) {
    return (
        fideoPushArray(fideoPushObject(snapshot).employees).find(
            (item) => fideoPushText(item && item.id, '') === fideoPushText(employeeId, ''),
        ) || null
    );
}

function fideoPushParseTime(value) {
    const parsed = Date.parse(fideoPushText(value, ''));
    return Number.isFinite(parsed) ? parsed : 0;
}

function fideoPushFindTaskReport(snapshot, taskId, preferredKinds) {
    const normalizedTaskId = fideoPushText(taskId, '');
    if (!normalizedTaskId) {
        return null;
    }

    const kinds = fideoPushUnique(fideoPushArray(preferredKinds).map((kind) => fideoPushText(kind, '')));
    let best = null;
    let bestTime = 0;

    fideoPushArray(fideoPushObject(snapshot).taskReports).forEach((item) => {
        const report = fideoPushObject(item);
        if (fideoPushText(report.taskId, '') !== normalizedTaskId) {
            return;
        }

        const kind = fideoPushText(report.kind, '');
        if (kinds.length && kinds.indexOf(kind) === -1) {
            return;
        }

        const createdAt = fideoPushParseTime(report.createdAt);
        if (!best || createdAt >= bestTime) {
            best = report;
            bestTime = createdAt;
        }
    });

    return best;
}

function fideoPushShouldEscalateTaskReport(report) {
    const normalized = fideoPushObject(report);
    const kind = fideoPushText(normalized.kind, '');
    const severity = fideoPushText(normalized.severity, 'normal');
    return kind === 'blocker' || kind === 'incident' || severity === 'high';
}

function fideoPushIsTaskAckOverdue(task, nowMs) {
    const normalized = fideoPushObject(task);
    if (fideoPushText(normalized.status, 'assigned') !== 'assigned') {
        return false;
    }

    if (
        fideoPushText(normalized.acknowledgedAt, '')
        || fideoPushText(normalized.startedAt, '')
        || fideoPushText(normalized.blockedAt, '')
        || fideoPushText(normalized.doneAt, '')
        || fideoPushText(normalized.completedAt, '')
    ) {
        return false;
    }

    const assignedAt = fideoPushParseTime(normalized.assignedAt || normalized.createdAt || normalized.updatedAt);
    return assignedAt > 0 && nowMs - assignedAt >= FIDEO_TASK_ACK_ESCALATION_MINUTES * 60 * 1000;
}

function fideoPushBuildOperationalPlans(options) {
    const normalized = fideoPushObject(options);
    const previousSnapshot = fideoPushObject(normalized.previousSnapshot);
    const nextSnapshot = fideoPushObject(normalized.nextSnapshot);
    const previousSalesById = {};
    const previousTaskAssignmentsById = {};
    const nextTaskAssignmentsById = {};
    const previousTaskReportsById = {};
    const plans = [];
    const seen = {};
    const nowMs = Date.now();

    fideoPushArray(previousSnapshot.sales).forEach((sale) => {
        const saleId = fideoPushText(sale && sale.id, '');
        if (saleId) {
            previousSalesById[saleId] = fideoPushObject(sale);
        }
    });

    fideoPushArray(previousSnapshot.taskAssignments).forEach((item) => {
        const task = fideoPushObject(item);
        const taskId = fideoPushText(task.id, '');
        if (taskId) {
            previousTaskAssignmentsById[taskId] = task;
        }
    });

    fideoPushArray(nextSnapshot.taskAssignments).forEach((item) => {
        const task = fideoPushObject(item);
        const taskId = fideoPushText(task.id, '');
        if (taskId) {
            nextTaskAssignmentsById[taskId] = task;
        }
    });

    fideoPushArray(previousSnapshot.taskReports).forEach((item) => {
        const report = fideoPushObject(item);
        const reportId = fideoPushText(report.id, '');
        if (reportId) {
            previousTaskReportsById[reportId] = report;
        }
    });

    fideoPushArray(nextSnapshot.sales).forEach((rawSale) => {
        const sale = fideoPushObject(rawSale);
        const saleId = fideoPushText(sale.id, '');
        if (!saleId) {
            return;
        }

        const previousSale = previousSalesById[saleId] || {};
        const previousStatus = fideoPushText(previousSale.status, '');
        const nextStatus = fideoPushText(sale.status, '');
        const customerName = fideoPushText(sale.customer, 'Cliente');

        if (nextStatus === 'Listo para Entrega' && previousStatus !== 'Listo para Entrega') {
            const key = 'sale_ready::' + saleId;
            if (!seen[key]) {
                seen[key] = true;
                plans.push({
                    audience: { roles: ['Admin'], dispatch: true },
                    title: 'Pedido listo',
                    message: customerName + ' ya esta listo para ruta.',
                    data: {
                        kind: 'sale_ready_for_route',
                        saleId,
                        customer: customerName,
                        assignedEmployeeId: fideoPushText(sale.assignedEmployeeId, ''),
                        status: nextStatus,
                    },
                });
            }
        }

        const previousAssignedEmployeeId = fideoPushText(previousSale.assignedEmployeeId, '');
        const assignedEmployeeId = fideoPushText(sale.assignedEmployeeId, '');
        if (
            assignedEmployeeId
            && assignedEmployeeId !== previousAssignedEmployeeId
            && nextStatus === 'En Ruta'
        ) {
            const employee = fideoPushFindEmployee(nextSnapshot, assignedEmployeeId) || {};
            const employeeName = fideoPushText(employee.name, '');
            const key = 'delivery_assigned::' + saleId + '::' + assignedEmployeeId;
            if (!seen[key]) {
                seen[key] = true;
                plans.push({
                    audience: {
                        roles: ['Repartidor'],
                        employeeId: assignedEmployeeId,
                        employeeName,
                    },
                    title: 'Nueva entrega',
                    message: customerName + ' entra en ruta.',
                    data: {
                        kind: 'delivery_assigned',
                        saleId,
                        customer: customerName,
                        assignedEmployeeId,
                        assignedEmployeeName: employeeName,
                        destination: fideoPushText(sale.destination, ''),
                        status: nextStatus,
                    },
                });
            }
        }
    });

    const systemNotification = fideoPushObject(normalized.systemNotification);
    const systemNotificationText = fideoPushText(systemNotification.text, '');
    if (
        systemNotificationText
        && systemNotification.isError === true
        && fideoPushNormalizeText(systemNotificationText).indexOf('caja') >= 0
    ) {
        plans.push({
            audience: { roles: ['Admin'], dispatch: true },
            title: 'Alerta de caja',
            message: systemNotificationText,
            data: {
                kind: 'cash_alert',
                source: 'system_notification',
            },
        });
    } else {
        const previousActivityIds = {};
        fideoPushArray(previousSnapshot.activityLog).forEach((item) => {
            const activityId = fideoPushText(item && item.id, '');
            if (activityId) {
                previousActivityIds[activityId] = true;
            }
        });

        const cashAlert = fideoPushArray(nextSnapshot.activityLog).find((item) => {
            const activityId = fideoPushText(item && item.id, '');
            if (!activityId || previousActivityIds[activityId]) {
                return false;
            }

            return fideoPushText(item && item.type, '') === 'CAJA_OPERACION';
        });

        if (cashAlert) {
            plans.push({
                audience: { roles: ['Admin'], dispatch: true },
                title: 'Alerta de caja',
                message: fideoPushText(cashAlert.description, 'Hay una incidencia de caja pendiente.'),
                data: {
                    kind: 'cash_alert',
                    source: 'activity_log',
                    activityId: fideoPushText(cashAlert.id, ''),
                },
            });
        }
    }

    fideoPushArray(nextSnapshot.taskReports).forEach((item) => {
        const report = fideoPushObject(item);
        const reportId = fideoPushText(report.id, '');
        const taskId = fideoPushText(report.taskId, '');
        if (!reportId || !taskId) {
            return;
        }

        const previousReport = previousTaskReportsById[reportId] || {};
        const status = fideoPushText(report.status, 'resolved');
        const escalationStatus = fideoPushText(report.escalationStatus, 'none');
        const previousEscalationStatus = fideoPushText(previousReport.escalationStatus, 'none');

        if (
            status !== 'open'
            || escalationStatus !== 'pending'
            || previousEscalationStatus === 'pending'
            || previousEscalationStatus === 'sent'
            || !fideoPushShouldEscalateTaskReport(report)
        ) {
            return;
        }

        const task = nextTaskAssignmentsById[taskId] || {};
        const employeeId = fideoPushText(task.employeeId, fideoPushText(report.employeeId, ''));
        const employee = fideoPushFindEmployee(nextSnapshot, employeeId) || {};
        const employeeName = fideoPushText(
            report.employeeName,
            fideoPushText(task.employeeName, fideoPushText(employee.name, '')),
        );
        const taskTitle = fideoPushText(report.taskTitle, fideoPushText(task.title, 'Tarea operativa'));
        const customerName = fideoPushText(report.customerName, fideoPushText(task.customerName, ''));
        const summary = fideoPushText(report.summary, taskTitle);
        const key = 'task_report_escalation::' + reportId;

        if (seen[key]) {
            return;
        }

        seen[key] = true;
        plans.push({
            audience: { roles: ['Admin'], dispatch: true },
            title: fideoPushText(report.kind, '') === 'blocker' ? 'Bloqueo reportado' : 'Reporte operativo',
            message:
                taskTitle
                + ': '
                + summary
                + (employeeName ? ' (' + employeeName + ')' : '')
                + (customerName ? ' - ' + customerName : ''),
            data: {
                kind: 'task_report_escalation',
                reportId,
                taskId,
                taskTitle,
                reportKind: fideoPushText(report.kind, ''),
                reportSeverity: fideoPushText(report.severity, 'normal'),
                employeeId,
                employeeName,
                customerName,
                saleId: fideoPushText(report.saleId, fideoPushText(task.saleId, '')),
            },
        });
    });

    fideoPushArray(nextSnapshot.taskAssignments).forEach((item) => {
        const task = fideoPushObject(item);
        const taskId = fideoPushText(task.id, '');
        if (!taskId) {
            return;
        }

        const previousTask = previousTaskAssignmentsById[taskId] || {};
        const status = fideoPushText(task.status, 'assigned');
        const previousStatus = fideoPushText(previousTask.status, '');
        const employeeId = fideoPushText(task.employeeId, '');
        const employee = fideoPushFindEmployee(nextSnapshot, employeeId) || {};
        const employeeName = fideoPushText(task.employeeName, fideoPushText(employee.name, ''));
        const customerName = fideoPushText(task.customerName, '');
        const taskTitle = fideoPushText(task.title, 'Tarea operativa');
        const openReport = fideoPushFindTaskReport(nextSnapshot, taskId, ['blocker', 'incident']) || {};
        const reportId = fideoPushText(openReport.id, '');
        const reportEscalationStatus = fideoPushText(openReport.escalationStatus, 'none');
        const blockedAt = fideoPushText(task.blockedAt, '');
        const previousBlockedAt = fideoPushText(previousTask.blockedAt, '');
        const blockedReason = fideoPushText(task.blockedReason, fideoPushText(task.blockReason, fideoPushText(openReport.summary, '')));

        if (
            status === 'blocked'
            && (previousStatus !== 'blocked' || blockedAt !== previousBlockedAt)
            && !(reportId && (reportEscalationStatus === 'pending' || reportEscalationStatus === 'sent'))
        ) {
            const key = 'task_blocked::' + taskId + '::' + blockedAt;
            if (!seen[key]) {
                seen[key] = true;
                plans.push({
                    audience: { roles: ['Admin'], dispatch: true },
                    title: 'Tarea bloqueada',
                    message:
                        taskTitle
                        + ' quedo bloqueada'
                        + (employeeName ? ' por ' + employeeName : '')
                        + (customerName ? ' - ' + customerName : '')
                        + (blockedReason ? ': ' + blockedReason : '.'),
                    data: {
                        kind: 'task_blocked',
                        taskId,
                        taskTitle,
                        employeeId,
                        employeeName,
                        customerName,
                        saleId: fideoPushText(task.saleId, ''),
                        role: fideoPushText(task.role, ''),
                        blockedAt,
                        blockedReason,
                        reportId,
                    },
                });
            }
        }

        const nextAckOverdue = fideoPushIsTaskAckOverdue(task, nowMs);
        const previousAckOverdue = fideoPushIsTaskAckOverdue(previousTask, nowMs);
        if (nextAckOverdue && !previousAckOverdue) {
            const assignedAtRaw = task.assignedAt || task.createdAt || task.updatedAt;
            const assignedAt = fideoPushParseTime(assignedAtRaw);
            const pendingMinutes = assignedAt > 0 ? Math.max(FIDEO_TASK_ACK_ESCALATION_MINUTES, Math.round((nowMs - assignedAt) / 60000)) : FIDEO_TASK_ACK_ESCALATION_MINUTES;
            const key = 'task_ack_timeout::' + taskId;
            if (!seen[key]) {
                seen[key] = true;
                plans.push({
                    audience: { roles: ['Admin'], dispatch: true },
                    title: 'Tarea sin acuse',
                    message:
                        taskTitle
                        + ' sigue sin acuse'
                        + (employeeName ? ' de ' + employeeName : '')
                        + ' tras '
                        + pendingMinutes
                        + ' min.',
                    data: {
                        kind: 'task_ack_timeout',
                        taskId,
                        taskTitle,
                        employeeId,
                        employeeName,
                        customerName,
                        saleId: fideoPushText(task.saleId, ''),
                        role: fideoPushText(task.role, ''),
                        assignedAt: fideoPushText(assignedAtRaw, ''),
                        pendingMinutes,
                    },
                });
            }
        }
    });

    return plans;
}

function fideoPushDispatchOperational(app, options) {
    const normalized = fideoPushObject(options);
    const workspaceId = fideoPushText(normalized.workspaceId, '');
    const plans = fideoPushBuildOperationalPlans(normalized);

    return plans.map((plan) => {
        const audience = fideoPushResolveAudience(
            app,
            workspaceId,
            Object.assign({}, fideoPushObject(plan.audience), {
                workspaceSlug: fideoPushText(normalized.workspaceSlug, ''),
            }),
        );
        const deliveryMode = audience.externalIds.length ? 'external_id' : audience.filters.length ? 'filters' : 'none';
        const response = fideoPushSend({
            title: fideoPushText(plan.title, 'Fideo'),
            message: fideoPushText(plan.message, ''),
            externalIds: audience.externalIds,
            filters: audience.filters,
            data: Object.assign({}, fideoPushObject(plan.data), {
                workspaceId,
                workspaceSlug: audience.workspaceSlug,
            }),
            url: fideoPushText(plan.url, FIDEO_PUSH_URL),
        });

        return {
            kind: fideoPushText(fideoPushObject(plan.data).kind, ''),
            title: fideoPushText(plan.title, 'Fideo'),
            message: fideoPushText(plan.message, ''),
            deliveryMode,
            externalIds: audience.externalIds,
            filters: audience.filters,
            matchedUsers: audience.matchedUsers,
            tags: audience.tags,
            skipped: !!response.skipped,
            reason: fideoPushText(response.reason, ''),
            ok: !!response.ok,
            statusCode: Number(response.statusCode || 0),
            responseId: fideoPushText(response.responseId, ''),
        };
    });
}

routerAdd(
    'POST',
    '/api/fideo/bootstrap',
    (e) => {
        try {
            const authRecord = e.auth || e.requestInfo().auth;
            if (!authRecord) {
                throw new UnauthorizedError('Necesitas autenticarte para cargar Fideo.');
            }

            const body = e.requestInfo().body || {};
            console.log('Bootstrap Request Body:', JSON.stringify(body));
            const workspaceSlug = body.workspaceSlug || 'main';
            const workspaceName = body.workspaceName || 'Fideo Main';


        const buildProfile = (record) => ({
            id: record.id,
            email: record.get('email') || '',
            name: record.get('name') || record.get('email') || 'Fideo User',
            role: record.get('role') || 'Admin',
            workspaceId: record.get('workspace') || null,
            employeeId: record.get('employeeId') || null,
            customerId: record.get('customerId') || null,
            supplierId: record.get('supplierId') || null,
            canSwitchRoles: !!record.get('canSwitchRoles'),
        });

        const findWorkspaceBySlug = (slug) => {
            try {
                return e.app.findFirstRecordByData('fideo_workspaces', 'slug', slug);
            } catch (_) {
                return null;
            }
        };

        const findSnapshotByWorkspace = (workspaceId) => {
            try {
                return e.app.findFirstRecordByData('fideo_state_snapshots', 'workspace', workspaceId);
            } catch (_) {
                return null;
            }
        };

        const writeActionLog = (workspaceId, actorId, action, payload) => {
            const collection = e.app.findCollectionByNameOrId('fideo_action_logs');
            const record = new Record(collection);
            record.set('workspace', workspaceId);
            record.set('actor', actorId || '');
            record.set('action', action);
            record.set('payload', payload || {});
            e.app.save(record);
        };

        const toArray = (value) => (Array.isArray(value) ? value : []);
        const toObject = (value) => {
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                try {
                    const normalized = JSON.parse(JSON.stringify(value));
                    return normalized && typeof normalized === 'object' && !Array.isArray(normalized) ? normalized : {};
                } catch (_) {
                    return value;
                }
            }
            if (value !== undefined && value !== null && String(value).trim()) {
                try {
                    const parsed = JSON.parse(String(value));
                    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
                } catch (_) {
                    return {};
                }
            }
            return {};
        };
        const toText = (value, fallback) => (value === undefined || value === null || value === '' ? (fallback || '') : String(value));
        const toNumber = (value, fallback) => {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : fallback;
        };
        const toBoolean = (value) => value === true || value === 'true' || value === 1;
        const toIsoString = (value) => {
            if (!value) return '';
            if (typeof value === 'string') return value;
            try {
                return new Date(value).toISOString();
            } catch (_) {
                return '';
            }
        };
        const isInternalRole = (role) => ['Admin', 'Empacador', 'Repartidor', 'Cajero'].indexOf(toText(role, 'Admin')) >= 0;
        const canAccessFullWorkspace = (record) => !!record.get('canSwitchRoles') || isInternalRole(record.get('role'));
        const buildPriceKey = (item) => [
            toText(item.varietyId, ''),
            toText(item.size, ''),
            toText(item.quality, ''),
            toText(item.state, ''),
        ].join('::');
        const getWorkspaceRecords = (collectionName, workspaceId) =>
            e.app.findRecordsByFilter(collectionName, "workspace = '" + workspaceId + "'", '', 2000, 0);
        const sortByIsoDesc = (items, key) =>
            items.slice().sort((left, right) => {
                const leftTime = Date.parse(toText(left[key], '')) || 0;
                const rightTime = Date.parse(toText(right[key], '')) || 0;
                return rightTime - leftTime;
            });

        const replaceWorkspaceCollectionByExternalId = (collectionName, workspaceId, items, assignRecord) => {
            const collection = e.app.findCollectionByNameOrId(collectionName);
            const existingRecords = getWorkspaceRecords(collectionName, workspaceId);
            const existingByExternalId = {};
            existingRecords.forEach((record) => {
                existingByExternalId[toText(record.get('externalId'), '')] = record;
            });

            const seen = {};
            toArray(items).forEach((item) => {
                const externalId = toText(item && item.id, '');
                if (!externalId) return;

                seen[externalId] = true;
                const record = existingByExternalId[externalId] || new Record(collection);
                record.set('workspace', workspaceId);
                record.set('externalId', externalId);
                assignRecord(record, item || {});
                e.app.save(record);
            });

            existingRecords.forEach((record) => {
                const externalId = toText(record.get('externalId'), '');
                if (!seen[externalId]) {
                    e.app.delete(record);
                }
            });
        };

        const replaceWorkspacePriceCollection = (workspaceId, items) => {
            const collectionName = 'fideo_prices';
            const collection = e.app.findCollectionByNameOrId(collectionName);
            const existingRecords = getWorkspaceRecords(collectionName, workspaceId);
            const existingByKey = {};
            existingRecords.forEach((record) => {
                existingByKey[buildPriceKey({
                    varietyId: record.get('varietyId'),
                    size: record.get('size'),
                    quality: record.get('quality'),
                    state: record.get('state'),
                })] = record;
            });

            const seen = {};
            toArray(items).forEach((item) => {
                const key = buildPriceKey(item || {});
                if (!key.replace(/:/g, '')) return;

                seen[key] = true;
                const record = existingByKey[key] || new Record(collection);
                record.set('workspace', workspaceId);
                record.set('varietyId', toText(item.varietyId, ''));
                record.set('size', toText(item.size, ''));
                record.set('quality', toText(item.quality, ''));
                record.set('state', toText(item.state, ''));
                record.set('price', toNumber(item.price, 0));
                e.app.save(record);
            });

            existingRecords.forEach((record) => {
                const key = buildPriceKey({
                    varietyId: record.get('varietyId'),
                    size: record.get('size'),
                    quality: record.get('quality'),
                    state: record.get('state'),
                });
                if (!seen[key]) {
                    e.app.delete(record);
                }
            });
        };
        const normalizeTaskAssignmentsForSync = (items) =>
            toArray(items)
                .map((item) => {
                    const normalizedItem = toObject(item);
                    const fallbackId = [toText(normalizedItem.taskId, ''), toText(normalizedItem.employeeId, '')]
                        .filter((value) => !!value)
                        .join('::');
                    const externalId = toText(normalizedItem.id, fallbackId);
                    return externalId ? Object.assign({}, normalizedItem, { id: externalId }) : null;
                })
                .filter((item) => !!item);
        const normalizeTaskReportsForSync = (items) =>
            toArray(items)
                .map((item) => {
                    const normalizedItem = toObject(item);
                    const fallbackId = [
                        toText(normalizedItem.taskId, ''),
                        toText(normalizedItem.createdAt, ''),
                        toText(normalizedItem.kind, ''),
                        toText(normalizedItem.employeeId, ''),
                    ]
                        .filter((value) => !!value)
                        .join('::');
                    const externalId = toText(normalizedItem.id, fallbackId);
                    return externalId ? Object.assign({}, normalizedItem, { id: externalId }) : null;
                })
                .filter((item) => !!item);

        const syncNormalizedFromSnapshot = (workspaceId, snapshot) => {
            replaceWorkspaceCollectionByExternalId('fideo_product_groups', workspaceId, snapshot.productGroups, (record, item) => {
                record.set('name', toText(item.name, ''));
                record.set('icon', toText(item.icon, ''));
                record.set('category', toText(item.category, ''));
                record.set('unit', toText(item.unit, 'cajas'));
                record.set('archived', toBoolean(item.archived));
                record.set('varieties', toArray(item.varieties));
            });

            replaceWorkspaceCollectionByExternalId('fideo_warehouses', workspaceId, snapshot.warehouses, (record, item) => {
                record.set('name', toText(item.name, ''));
                record.set('icon', toText(item.icon, ''));
                record.set('archived', toBoolean(item.archived));
            });

            replaceWorkspacePriceCollection(workspaceId, snapshot.prices);

            replaceWorkspaceCollectionByExternalId('fideo_inventory_batches', workspaceId, snapshot.inventory, (record, item) => {
                record.set('varietyId', toText(item.varietyId, ''));
                record.set('size', toText(item.size, ''));
                record.set('quality', toText(item.quality, ''));
                record.set('quantity', toNumber(item.quantity, 0));
                record.set('state', toText(item.state, ''));
                record.set('location', toText(item.location, ''));
                record.set('warehouseId', toText(item.warehouseId, ''));
                record.set('packagingId', toText(item.packagingId, ''));
                record.set('entryDate', toIsoString(item.entryDate));
            });

            replaceWorkspaceCollectionByExternalId('fideo_customers', workspaceId, snapshot.customers, (record, item) => {
                record.set('name', toText(item.name, ''));
                record.set('contacts', toArray(item.contacts));
                record.set('specialPrices', toArray(item.specialPrices));
                record.set('schedule', item.schedule ? toObject(item.schedule) : null);
                record.set('deliveryNotes', toText(item.deliveryNotes, ''));
                record.set('creditStatus', toText(item.creditStatus, 'Confiable'));
                if (item.creditLimit === undefined || item.creditLimit === null || item.creditLimit === '') {
                    record.set('creditLimit', null);
                } else {
                    record.set('creditLimit', toNumber(item.creditLimit, 0));
                }
            });

            replaceWorkspaceCollectionByExternalId('fideo_suppliers', workspaceId, snapshot.suppliers, (record, item) => {
                record.set('name', toText(item.name, ''));
                record.set('contact', toText(item.contact, ''));
                record.set('supplies', toArray(item.supplies));
            });

            replaceWorkspaceCollectionByExternalId('fideo_purchase_orders', workspaceId, snapshot.purchaseOrders, (record, item) => {
                record.set('supplierId', toText(item.supplierId, ''));
                record.set('varietyId', toText(item.varietyId, ''));
                record.set('size', toText(item.size, ''));
                record.set('packaging', toText(item.packaging, ''));
                record.set('quantity', toNumber(item.quantity, 0));
                record.set('totalCost', toNumber(item.totalCost, 0));
                record.set('status', toText(item.status, 'Pendiente'));
                record.set('orderDate', toIsoString(item.orderDate));
                record.set('expectedArrivalDate', toIsoString(item.expectedArrivalDate));
                record.set('paymentMethod', toText(item.paymentMethod, 'N/A'));
            });

            replaceWorkspaceCollectionByExternalId('fideo_sales', workspaceId, snapshot.sales, (record, item) => {
                record.set('productGroupId', toText(item.productGroupId, ''));
                record.set('varietyId', toText(item.varietyId, ''));
                record.set('customerId', toText(item.customerId, ''));
                record.set('productGroupName', toText(item.productGroupName, ''));
                record.set('varietyName', toText(item.varietyName, ''));
                record.set('size', toText(item.size, ''));
                record.set('quality', toText(item.quality, ''));
                record.set('state', toText(item.state, ''));
                record.set('quantity', toNumber(item.quantity, 0));
                record.set('price', toNumber(item.price, 0));
                record.set('cogs', toNumber(item.cogs, 0));
                record.set('unit', toText(item.unit, ''));
                record.set('customer', toText(item.customer, ''));
                record.set('destination', toText(item.destination, ''));
                record.set('locationQuery', toText(item.locationQuery, ''));
                record.set('status', toText(item.status, 'Pendiente de Empaque'));
                record.set('paymentStatus', toText(item.paymentStatus, 'Pendiente'));
                record.set('paymentMethod', toText(item.paymentMethod, 'N/A'));
                record.set('paymentNotes', toText(item.paymentNotes, ''));
                record.set('assignedEmployeeId', toText(item.assignedEmployeeId, ''));
                record.set('timestamp', toIsoString(item.timestamp));
                record.set('deliveryDeadline', toIsoString(item.deliveryDeadline));
            });

            replaceWorkspaceCollectionByExternalId('fideo_payments', workspaceId, snapshot.payments, (record, item) => {
                record.set('customerId', toText(item.customerId, ''));
                record.set('amount', toNumber(item.amount, 0));
                record.set('date', toIsoString(item.date));
                record.set('saleId', toText(item.saleId, ''));
            });

            replaceWorkspaceCollectionByExternalId('fideo_crate_loans', workspaceId, snapshot.crateLoans, (record, item) => {
                record.set('customerId', toText(item.customerId, ''));
                record.set('customer', toText(item.customer, ''));
                record.set('crateTypeId', toText(item.crateTypeId, ''));
                record.set('quantity', toNumber(item.quantity, 0));
                record.set('timestamp', toIsoString(item.timestamp));
                record.set('dueDate', toIsoString(item.dueDate));
                record.set('status', toText(item.status, 'Prestado'));
            });

            replaceWorkspaceCollectionByExternalId('fideo_employee_activities', workspaceId, snapshot.activities, (record, item) => {
                record.set('employee', toText(item.employee, ''));
                record.set('activity', toText(item.activity, ''));
                record.set('timestamp', toIsoString(item.timestamp));
            });

            replaceWorkspaceCollectionByExternalId('fideo_activity_logs', workspaceId, snapshot.activityLog, (record, item) => {
                const details = toObject(item.details);
                record.set('type', toText(item.type, 'NAVEGACION'));
                record.set('timestamp', toIsoString(item.timestamp));
                record.set('description', toText(item.description, ''));
                record.set('details', Object.keys(details).length > 0 ? details : null);
            });

            replaceWorkspaceCollectionByExternalId('fideo_cash_drawers', workspaceId, snapshot.cashDrawers, (record, item) => {
                record.set('name', toText(item.name, ''));
                record.set('balance', toNumber(item.balance, 0));
                record.set('status', toText(item.status, 'Cerrada'));
                record.set('lastOpened', toIsoString(item.lastOpened));
                record.set('lastClosed', toIsoString(item.lastClosed));
            });

            replaceWorkspaceCollectionByExternalId('fideo_cash_drawer_activities', workspaceId, snapshot.cashDrawerActivities, (record, item) => {
                record.set('drawerId', toText(item.drawerId, ''));
                record.set('type', toText(item.type, 'SALDO_INICIAL'));
                record.set('amount', toNumber(item.amount, 0));
                record.set('timestamp', toIsoString(item.timestamp));
                record.set('notes', toText(item.notes, ''));
                record.set('relatedId', toText(item.relatedId, ''));
            });

            replaceWorkspaceCollectionByExternalId('fideo_task_assignments', workspaceId, normalizeTaskAssignmentsForSync(snapshot.taskAssignments), (record, item) => {
                const payload = toObject(item);
                record.set('taskId', toText(item.taskId, ''));
                record.set('employeeId', toText(item.employeeId, ''));
                record.set('role', toText(item.role, ''));
                record.set('status', toText(item.status, 'assigned'));
                record.set('assignedAt', toIsoString(item.assignedAt));
                record.set('acknowledgedAt', toIsoString(item.acknowledgedAt));
                record.set('startedAt', toIsoString(item.startedAt));
                record.set('blockedAt', toIsoString(item.blockedAt));
                record.set('doneAt', toIsoString(item.doneAt));
                record.set('blockedReason', toText(item.blockedReason, ''));
                record.set('payload', Object.keys(payload).length > 0 ? payload : null);
            });

            replaceWorkspaceCollectionByExternalId('fideo_task_reports', workspaceId, normalizeTaskReportsForSync(snapshot.taskReports), (record, item) => {
                const payload = toObject(item);
                record.set('taskId', toText(item.taskId, ''));
                record.set('saleId', toText(item.saleId, ''));
                record.set('role', toText(item.role, ''));
                record.set('employeeId', toText(item.employeeId, ''));
                record.set('employeeName', toText(item.employeeName, ''));
                record.set('customerId', toText(item.customerId, ''));
                record.set('customerName', toText(item.customerName, ''));
                record.set('taskTitle', toText(item.taskTitle, ''));
                record.set('kind', toText(item.kind, 'note'));
                record.set('status', toText(item.status, 'resolved'));
                record.set('severity', toText(item.severity, 'normal'));
                record.set('summary', toText(item.summary, ''));
                record.set('detail', toText(item.detail, ''));
                record.set('evidence', toText(item.evidence, ''));
                record.set('escalationStatus', toText(item.escalationStatus, 'none'));
                record.set('createdAt', toIsoString(item.createdAt));
                record.set('resolvedAt', toIsoString(item.resolvedAt));
                record.set('escalatedAt', toIsoString(item.escalatedAt));
                record.set('payload', Object.keys(payload).length > 0 ? payload : null);
            });
        };

        const loadNormalizedSlice = (workspaceId) => {
            const productGroups = getWorkspaceRecords('fideo_product_groups', workspaceId).map((record) => ({
                id: toText(record.get('externalId'), ''),
                name: toText(record.get('name'), ''),
                icon: toText(record.get('icon'), ''),
                category: toText(record.get('category'), ''),
                unit: toText(record.get('unit'), 'cajas'),
                archived: toBoolean(record.get('archived')),
                varieties: toArray(record.get('varieties')),
            }));

            const warehouses = getWorkspaceRecords('fideo_warehouses', workspaceId).map((record) => ({
                id: toText(record.get('externalId'), ''),
                name: toText(record.get('name'), ''),
                icon: toText(record.get('icon'), ''),
                archived: toBoolean(record.get('archived')),
            }));

            const prices = getWorkspaceRecords('fideo_prices', workspaceId).map((record) => ({
                varietyId: toText(record.get('varietyId'), ''),
                size: toText(record.get('size'), ''),
                quality: toText(record.get('quality'), ''),
                state: toText(record.get('state'), ''),
                price: toNumber(record.get('price'), 0),
            }));

            const inventory = getWorkspaceRecords('fideo_inventory_batches', workspaceId).map((record) => ({
                id: toText(record.get('externalId'), ''),
                varietyId: toText(record.get('varietyId'), ''),
                size: toText(record.get('size'), ''),
                quality: toText(record.get('quality'), ''),
                quantity: toNumber(record.get('quantity'), 0),
                state: toText(record.get('state'), ''),
                location: toText(record.get('location'), ''),
                warehouseId: toText(record.get('warehouseId'), ''),
                packagingId: toText(record.get('packagingId'), ''),
                entryDate: toText(record.get('entryDate'), ''),
            }));

            const customers = getWorkspaceRecords('fideo_customers', workspaceId).map((record) => {
                const mapped = {
                    id: toText(record.get('externalId'), ''),
                    name: toText(record.get('name'), ''),
                    contacts: toArray(record.get('contacts')),
                    specialPrices: toArray(record.get('specialPrices')),
                    deliveryNotes: toText(record.get('deliveryNotes'), ''),
                    creditStatus: toText(record.get('creditStatus'), 'Confiable'),
                };

                const schedule = toObject(record.get('schedule'));
                const creditLimit = record.get('creditLimit');

                if (Object.keys(schedule).length > 0) {
                    mapped.schedule = schedule;
                }

                if (creditLimit !== null && creditLimit !== undefined && creditLimit !== '') {
                    mapped.creditLimit = toNumber(creditLimit, 0);
                }

                return mapped;
            });

            const suppliers = getWorkspaceRecords('fideo_suppliers', workspaceId).map((record) => ({
                id: toText(record.get('externalId'), ''),
                name: toText(record.get('name'), ''),
                contact: toText(record.get('contact'), ''),
                supplies: toArray(record.get('supplies')),
            }));

            const purchaseOrders = sortByIsoDesc(getWorkspaceRecords('fideo_purchase_orders', workspaceId).map((record) => {
                const mapped = {
                    id: toText(record.get('externalId'), ''),
                    supplierId: toText(record.get('supplierId'), ''),
                    varietyId: toText(record.get('varietyId'), ''),
                    size: toText(record.get('size'), ''),
                    packaging: toText(record.get('packaging'), ''),
                    quantity: toNumber(record.get('quantity'), 0),
                    totalCost: toNumber(record.get('totalCost'), 0),
                    status: toText(record.get('status'), 'Pendiente'),
                    orderDate: toText(record.get('orderDate'), ''),
                    paymentMethod: toText(record.get('paymentMethod'), 'N/A'),
                };

                const expectedArrivalDate = toText(record.get('expectedArrivalDate'), '');
                if (expectedArrivalDate) {
                    mapped.expectedArrivalDate = expectedArrivalDate;
                }

                return mapped;
            }), 'orderDate');

            const sales = sortByIsoDesc(getWorkspaceRecords('fideo_sales', workspaceId).map((record) => {
                const mapped = {
                    id: toText(record.get('externalId'), ''),
                    productGroupId: toText(record.get('productGroupId'), ''),
                    varietyId: toText(record.get('varietyId'), ''),
                    productGroupName: toText(record.get('productGroupName'), ''),
                    varietyName: toText(record.get('varietyName'), ''),
                    size: toText(record.get('size'), ''),
                    quality: toText(record.get('quality'), ''),
                    state: toText(record.get('state'), ''),
                    quantity: toNumber(record.get('quantity'), 0),
                    price: toNumber(record.get('price'), 0),
                    cogs: toNumber(record.get('cogs'), 0),
                    unit: toText(record.get('unit'), ''),
                    customer: toText(record.get('customer'), ''),
                    destination: toText(record.get('destination'), ''),
                    status: toText(record.get('status'), 'Pendiente de Empaque'),
                    paymentStatus: toText(record.get('paymentStatus'), 'Pendiente'),
                    paymentMethod: toText(record.get('paymentMethod'), 'N/A'),
                    timestamp: toText(record.get('timestamp'), ''),
                    deliveryDeadline: toText(record.get('deliveryDeadline'), ''),
                };

                const locationQuery = toText(record.get('locationQuery'), '');
                const customerId = toText(record.get('customerId'), '');
                const paymentNotes = toText(record.get('paymentNotes'), '');
                const assignedEmployeeId = toText(record.get('assignedEmployeeId'), '');

                if (customerId) {
                    mapped.customerId = customerId;
                }

                if (locationQuery) {
                    mapped.locationQuery = locationQuery;
                }

                if (paymentNotes) {
                    mapped.paymentNotes = paymentNotes;
                }

                if (assignedEmployeeId) {
                    mapped.assignedEmployeeId = assignedEmployeeId;
                }

                return mapped;
            }), 'timestamp');

            const payments = sortByIsoDesc(getWorkspaceRecords('fideo_payments', workspaceId).map((record) => {
                const mapped = {
                    id: toText(record.get('externalId'), ''),
                    customerId: toText(record.get('customerId'), ''),
                    amount: toNumber(record.get('amount'), 0),
                    date: toText(record.get('date'), ''),
                };

                const saleId = toText(record.get('saleId'), '');
                if (saleId) {
                    mapped.saleId = saleId;
                }

                return mapped;
            }), 'date');

            const crateLoans = sortByIsoDesc(getWorkspaceRecords('fideo_crate_loans', workspaceId).map((record) => {
                const mapped = {
                    id: toText(record.get('externalId'), ''),
                    customer: toText(record.get('customer'), ''),
                    crateTypeId: toText(record.get('crateTypeId'), ''),
                    quantity: toNumber(record.get('quantity'), 0),
                    timestamp: toText(record.get('timestamp'), ''),
                    dueDate: toText(record.get('dueDate'), ''),
                    status: toText(record.get('status'), 'Prestado'),
                };

                const customerId = toText(record.get('customerId'), '');
                if (customerId) {
                    mapped.customerId = customerId;
                }

                return mapped;
            }), 'timestamp');

            const activities = sortByIsoDesc(getWorkspaceRecords('fideo_employee_activities', workspaceId).map((record) => ({
                id: toText(record.get('externalId'), ''),
                employee: toText(record.get('employee'), ''),
                activity: toText(record.get('activity'), ''),
                timestamp: toText(record.get('timestamp'), ''),
            })), 'timestamp');

            const activityLog = sortByIsoDesc(getWorkspaceRecords('fideo_activity_logs', workspaceId).map((record) => ({
                id: toText(record.get('externalId'), ''),
                type: toText(record.get('type'), 'NAVEGACION'),
                timestamp: toText(record.get('timestamp'), ''),
                description: toText(record.get('description'), ''),
                details: toObject(record.get('details')),
            })), 'timestamp');

            const cashDrawers = getWorkspaceRecords('fideo_cash_drawers', workspaceId).map((record) => {
                const mapped = {
                    id: toText(record.get('externalId'), ''),
                    name: toText(record.get('name'), ''),
                    balance: toNumber(record.get('balance'), 0),
                    status: toText(record.get('status'), 'Cerrada'),
                };

                const lastOpened = toText(record.get('lastOpened'), '');
                const lastClosed = toText(record.get('lastClosed'), '');

                if (lastOpened) {
                    mapped.lastOpened = lastOpened;
                }

                if (lastClosed) {
                    mapped.lastClosed = lastClosed;
                }

                return mapped;
            });

            const cashDrawerActivities = sortByIsoDesc(getWorkspaceRecords('fideo_cash_drawer_activities', workspaceId).map((record) => {
                const mapped = {
                    id: toText(record.get('externalId'), ''),
                    drawerId: toText(record.get('drawerId'), ''),
                    type: toText(record.get('type'), 'SALDO_INICIAL'),
                    amount: toNumber(record.get('amount'), 0),
                    timestamp: toText(record.get('timestamp'), ''),
                };

                const notes = toText(record.get('notes'), '');
                const relatedId = toText(record.get('relatedId'), '');

                if (notes) {
                    mapped.notes = notes;
                }

                if (relatedId) {
                    mapped.relatedId = relatedId;
                }

                return mapped;
            }), 'timestamp');

            const taskAssignments = sortByIsoDesc(getWorkspaceRecords('fideo_task_assignments', workspaceId).map((record) => {
                const payload = toObject(record.get('payload'));
                const mapped = Object.assign({}, payload, {
                    id: toText(record.get('externalId'), toText(payload.id, '')),
                    taskId: toText(record.get('taskId'), toText(payload.taskId, '')),
                    employeeId: toText(record.get('employeeId'), toText(payload.employeeId, '')),
                    role: toText(record.get('role'), toText(payload.role, '')),
                    status: toText(record.get('status'), toText(payload.status, 'assigned')),
                });

                const assignedAt = toText(record.get('assignedAt'), toText(payload.assignedAt, ''));
                const acknowledgedAt = toText(record.get('acknowledgedAt'), toText(payload.acknowledgedAt, ''));
                const startedAt = toText(record.get('startedAt'), toText(payload.startedAt, ''));
                const blockedAt = toText(record.get('blockedAt'), toText(payload.blockedAt, ''));
                const doneAt = toText(record.get('doneAt'), toText(payload.doneAt, ''));
                const blockedReason = toText(record.get('blockedReason'), toText(payload.blockedReason, ''));

                if (assignedAt) {
                    mapped.assignedAt = assignedAt;
                }

                if (acknowledgedAt) {
                    mapped.acknowledgedAt = acknowledgedAt;
                }

                if (startedAt) {
                    mapped.startedAt = startedAt;
                }

                if (blockedAt) {
                    mapped.blockedAt = blockedAt;
                }

                if (doneAt) {
                    mapped.doneAt = doneAt;
                }

                if (blockedReason) {
                    mapped.blockedReason = blockedReason;
                }

                return mapped;
            }), 'assignedAt');

            const taskReports = sortByIsoDesc(getWorkspaceRecords('fideo_task_reports', workspaceId).map((record) => {
                const payload = toObject(record.get('payload'));
                const mapped = Object.assign({}, payload, {
                    id: toText(record.get('externalId'), toText(payload.id, '')),
                    taskId: toText(record.get('taskId'), toText(payload.taskId, '')),
                    role: toText(record.get('role'), toText(payload.role, '')),
                    taskTitle: toText(record.get('taskTitle'), toText(payload.taskTitle, '')),
                    kind: toText(record.get('kind'), toText(payload.kind, 'note')),
                    status: toText(record.get('status'), toText(payload.status, 'resolved')),
                    severity: toText(record.get('severity'), toText(payload.severity, 'normal')),
                    summary: toText(record.get('summary'), toText(payload.summary, '')),
                    escalationStatus: toText(record.get('escalationStatus'), toText(payload.escalationStatus, 'none')),
                });

                const saleId = toText(record.get('saleId'), toText(payload.saleId, ''));
                const employeeId = toText(record.get('employeeId'), toText(payload.employeeId, ''));
                const employeeName = toText(record.get('employeeName'), toText(payload.employeeName, ''));
                const customerId = toText(record.get('customerId'), toText(payload.customerId, ''));
                const customerName = toText(record.get('customerName'), toText(payload.customerName, ''));
                const detail = toText(record.get('detail'), toText(payload.detail, ''));
                const evidence = toText(record.get('evidence'), toText(payload.evidence, ''));
                const createdAt = toText(record.get('createdAt'), toText(payload.createdAt, ''));
                const resolvedAt = toText(record.get('resolvedAt'), toText(payload.resolvedAt, ''));
                const escalatedAt = toText(record.get('escalatedAt'), toText(payload.escalatedAt, ''));

                if (saleId) {
                    mapped.saleId = saleId;
                }

                if (employeeId) {
                    mapped.employeeId = employeeId;
                }

                if (employeeName) {
                    mapped.employeeName = employeeName;
                }

                if (customerId) {
                    mapped.customerId = customerId;
                }

                if (customerName) {
                    mapped.customerName = customerName;
                }

                if (detail) {
                    mapped.detail = detail;
                }

                if (evidence) {
                    mapped.evidence = evidence;
                }

                if (createdAt) {
                    mapped.createdAt = createdAt;
                }

                if (resolvedAt) {
                    mapped.resolvedAt = resolvedAt;
                }

                if (escalatedAt) {
                    mapped.escalatedAt = escalatedAt;
                }

                return mapped;
            }), 'createdAt');

            return {
                productGroups,
                warehouses,
                prices,
                inventory,
                customers,
                suppliers,
                purchaseOrders,
                sales,
                payments,
                crateLoans,
                activities,
                activityLog,
                cashDrawers,
                cashDrawerActivities,
                taskAssignments,
                taskReports,
            };
        };

        const hasNormalizedData = (slice) =>
            slice.productGroups.length > 0
            || slice.warehouses.length > 0
            || slice.prices.length > 0
            || slice.inventory.length > 0
            || slice.customers.length > 0
            || slice.suppliers.length > 0
            || slice.purchaseOrders.length > 0
            || slice.sales.length > 0
            || slice.payments.length > 0
            || slice.crateLoans.length > 0
            || slice.activities.length > 0
            || slice.activityLog.length > 0
            || slice.cashDrawers.length > 0
            || slice.cashDrawerActivities.length > 0
            || slice.taskAssignments.length > 0
            || slice.taskReports.length > 0;

        const mergeNormalizedSlice = (baseSnapshot, slice) => {
            const merged = Object.assign({}, baseSnapshot);
            const keys = [
                'productGroups',
                'warehouses',
                'prices',
                'inventory',
                'customers',
                'suppliers',
                'purchaseOrders',
                'sales',
                'payments',
                'crateLoans',
                'activities',
                'activityLog',
                'cashDrawers',
                'cashDrawerActivities',
                'taskAssignments',
                'taskReports',
            ];

            keys.forEach((key) => {
                const value = slice[key];
                if (Array.isArray(value)) {
                    if (value.length > 0) {
                        merged[key] = value;
                    }
                    return;
                }

                if (value && typeof value === 'object' && Object.keys(value).length > 0) {
                    merged[key] = value;
                }
            });

            return merged;
        };
        const backfillCustomerRefsInSnapshot = (snapshot) => {
            const normalized = Object.assign({}, toObject(snapshot));
            const customers = toArray(normalized.customers);
            const uniqueCustomersByName = {};
            const duplicateNames = {};

            customers.forEach((customer) => {
                const name = toText(customer && customer.name, '');
                if (!name) return;
                if (uniqueCustomersByName[name]) {
                    duplicateNames[name] = true;
                    return;
                }
                uniqueCustomersByName[name] = customer;
            });

            Object.keys(duplicateNames).forEach((name) => {
                delete uniqueCustomersByName[name];
            });

            normalized.sales = toArray(normalized.sales).map((item) => {
                const customerId = toText(item && item.customerId, '');
                if (customerId) return item;
                const customer = uniqueCustomersByName[toText(item && item.customer, '')];
                if (!customer) return item;
                return Object.assign({}, item, { customerId: toText(customer.id, '') });
            });

            normalized.crateLoans = toArray(normalized.crateLoans).map((item) => {
                const customerId = toText(item && item.customerId, '');
                if (customerId) return item;
                const customer = uniqueCustomersByName[toText(item && item.customer, '')];
                if (!customer) return item;
                return Object.assign({}, item, { customerId: toText(customer.id, '') });
            });

            return normalized;
        };
        const scopeSnapshotForProfile = (snapshot, record) => {
            if (canAccessFullWorkspace(record)) {
                return snapshot;
            }

            const profile = buildProfile(record);
            const baseSnapshot = Object.assign({}, snapshot);

            if (profile.role === 'Cliente') {
                if (!profile.customerId) {
                    throw new ForbiddenError('Tu perfil de cliente no tiene customerId asignado.');
                }

                const customer = toArray(baseSnapshot.customers).find((item) => toText(item && item.id, '') === profile.customerId);
                if (!customer) {
                    throw new ForbiddenError('No encontramos el cliente asignado a este usuario.');
                }

                const customerName = toText(customer.name, '');
                baseSnapshot.customers = [customer];
                baseSnapshot.sales = toArray(baseSnapshot.sales).filter((item) => {
                    const customerId = toText(item && item.customerId, '');
                    return customerId ? customerId === profile.customerId : toText(item && item.customer, '') === customerName;
                });
                baseSnapshot.payments = toArray(baseSnapshot.payments).filter((item) => toText(item && item.customerId, '') === profile.customerId);
                baseSnapshot.crateLoans = toArray(baseSnapshot.crateLoans).filter((item) => {
                    const customerId = toText(item && item.customerId, '');
                    return customerId ? customerId === profile.customerId : toText(item && item.customer, '') === customerName;
                });
                baseSnapshot.suppliers = [];
                baseSnapshot.purchaseOrders = [];
                baseSnapshot.inventory = [];
                baseSnapshot.prices = [];
                baseSnapshot.employees = [];
                baseSnapshot.warehouses = [];
                baseSnapshot.crateInventory = [];
                baseSnapshot.activities = [];
                baseSnapshot.activityLog = [];
                baseSnapshot.messages = [];
                baseSnapshot.systemPrompt = '';
                baseSnapshot.fixedAssets = [];
                baseSnapshot.expenses = [];
                baseSnapshot.categoryIcons = {};
                baseSnapshot.sizes = {};
                baseSnapshot.qualities = {};
                baseSnapshot.stateIcons = {};
                baseSnapshot.ripeningRules = [];
                baseSnapshot.inventoryRecommendations = [];
                baseSnapshot.actionItems = [];
                baseSnapshot.cashDrawers = [];
                baseSnapshot.cashDrawerActivities = [];
                baseSnapshot.taskAssignments = [];
                baseSnapshot.taskReports = [];
                baseSnapshot.messageTemplates = [];
                baseSnapshot.aiCustomerSummary = null;
                baseSnapshot.isGeneratingSummary = false;
                return baseSnapshot;
            }

            if (profile.role === 'Proveedor') {
                if (!profile.supplierId) {
                    throw new ForbiddenError('Tu perfil de proveedor no tiene supplierId asignado.');
                }

                const supplier = toArray(baseSnapshot.suppliers).find((item) => toText(item && item.id, '') === profile.supplierId);
                if (!supplier) {
                    throw new ForbiddenError('No encontramos el proveedor asignado a este usuario.');
                }

                baseSnapshot.customers = [];
                baseSnapshot.sales = [];
                baseSnapshot.payments = [];
                baseSnapshot.crateLoans = [];
                baseSnapshot.suppliers = [supplier];
                baseSnapshot.purchaseOrders = toArray(baseSnapshot.purchaseOrders).filter((item) => toText(item && item.supplierId, '') === profile.supplierId);
                baseSnapshot.inventory = [];
                baseSnapshot.prices = [];
                baseSnapshot.employees = [];
                baseSnapshot.warehouses = [];
                baseSnapshot.crateTypes = [];
                baseSnapshot.crateInventory = [];
                baseSnapshot.activities = [];
                baseSnapshot.activityLog = [];
                baseSnapshot.messages = [];
                baseSnapshot.systemPrompt = '';
                baseSnapshot.fixedAssets = [];
                baseSnapshot.expenses = [];
                baseSnapshot.categoryIcons = {};
                baseSnapshot.sizes = {};
                baseSnapshot.qualities = {};
                baseSnapshot.stateIcons = {};
                baseSnapshot.ripeningRules = [];
                baseSnapshot.inventoryRecommendations = [];
                baseSnapshot.actionItems = [];
                baseSnapshot.cashDrawers = [];
                baseSnapshot.cashDrawerActivities = [];
                baseSnapshot.taskAssignments = [];
                baseSnapshot.taskReports = [];
                baseSnapshot.messageTemplates = [];
                baseSnapshot.aiCustomerSummary = null;
                baseSnapshot.isGeneratingSummary = false;
                return baseSnapshot;
            }

            return snapshot;
        };

        let workspaceId = authRecord.get('workspace') || '';
        let workspace = null;
        console.log('User Workspace ID:', workspaceId);
        console.log('Auth Record ID:', authRecord.id);

        if (workspaceId) {
            try {
                workspace = e.app.findRecordById('fideo_workspaces', workspaceId);
                console.log('Found Workspace by ID:', workspace.id);
            } catch (err) {
                console.log('Error finding workspace by ID:', err.message);
                workspace = null;
            }
        }
        
        if (!workspace) {
            workspace = findWorkspaceBySlug(workspaceSlug);
            if (workspace) {
                 console.log('Found Workspace by Slug:', workspace.id);
            }
            if (!workspace) {
                console.log('Creating Workspace:', workspaceSlug);
                const workspaceCollection = e.app.findCollectionByNameOrId('fideo_workspaces');
                workspace = new Record(workspaceCollection);
                workspace.set('name', workspaceName || 'Fideo Main');
                workspace.set('slug', workspaceSlug || 'main');
                e.app.save(workspace);
            }

            authRecord.set('workspace', workspace.id);
            e.app.save(authRecord);
        }

        let snapshotRecord = findSnapshotByWorkspace(workspace.id);
        if (!snapshotRecord) {
            const snapshotCollection = e.app.findCollectionByNameOrId('fideo_state_snapshots');
            snapshotRecord = new Record(snapshotCollection);
            snapshotRecord.set('workspace', workspace.id);
            snapshotRecord.set('snapshot', body.seedSnapshot || {});
            snapshotRecord.set('version', 1);
            snapshotRecord.set('updatedBy', authRecord.id);
            e.app.save(snapshotRecord);
        }

        let responseSnapshot = Object.assign({}, toObject(body.seedSnapshot), toObject(snapshotRecord.get('snapshot')));
        const normalizedSlice = loadNormalizedSlice(workspace.id);

        if (hasNormalizedData(normalizedSlice)) {
            responseSnapshot = mergeNormalizedSlice(responseSnapshot, normalizedSlice);
            responseSnapshot = backfillCustomerRefsInSnapshot(responseSnapshot);
            snapshotRecord.set('snapshot', responseSnapshot);
            snapshotRecord.set('updatedBy', authRecord.id);
            e.app.save(snapshotRecord);
            syncNormalizedFromSnapshot(workspace.id, responseSnapshot);
        } else {
            responseSnapshot = backfillCustomerRefsInSnapshot(responseSnapshot);
            snapshotRecord.set('snapshot', responseSnapshot);
            snapshotRecord.set('updatedBy', authRecord.id);
            e.app.save(snapshotRecord);
            syncNormalizedFromSnapshot(workspace.id, responseSnapshot);
        }

        const scopedSnapshot = scopeSnapshotForProfile(responseSnapshot, authRecord);

        writeActionLog(workspace.id, authRecord.id, 'bootstrap', {
            version: snapshotRecord.get('version') || 1,
            normalized: true,
            scope: canAccessFullWorkspace(authRecord) ? 'full' : buildProfile(authRecord).role,
        });

        return e.json(200, {
            profile: buildProfile(authRecord),
            workspaceId: workspace.id,
            workspaceSlug: workspace.get('slug'),
            snapshotRecordId: snapshotRecord.id,
            version: snapshotRecord.get('version') || 1,
            snapshot: scopedSnapshot,
        });
        } catch (err) {
            console.log('BOOTSTRAP ERROR:', err.message);
            if (err.stack) console.log(err.stack);
            throw err;
        }
    },
    $apis.requireAuth('fideo_users'),
);

routerAdd(
    'POST',
    '/api/fideo/state/persist',
    (e) => {
        const authRecord = e.auth || e.requestInfo().auth;
        if (!authRecord) {
            throw new UnauthorizedError('Necesitas autenticarte para guardar Fideo.');
        }

        const body = e.requestInfo().body || {};
        const workspaceId = body.workspaceId || '';
        const expectedVersion = Number(body.expectedVersion || 0);
        const snapshot = body.snapshot || {};
        const authWorkspaceId = authRecord.get('workspace') || '';
        const toText = (value, fallback) => (value === undefined || value === null || value === '' ? (fallback || '') : String(value));
        const canPersistWorkspaceSnapshot = () => {
            const role = toText(authRecord.get('role'), 'Admin');
            return !!authRecord.get('canSwitchRoles') || ['Admin', 'Empacador', 'Repartidor', 'Cajero'].indexOf(role) >= 0;
        };

        const findSnapshotByWorkspace = (targetWorkspaceId) => {
            try {
                return e.app.findFirstRecordByData('fideo_state_snapshots', 'workspace', targetWorkspaceId);
            } catch (_) {
                return null;
            }
        };

        const writeActionLog = (targetWorkspaceId, actorId, action, payload) => {
            const collection = e.app.findCollectionByNameOrId('fideo_action_logs');
            const record = new Record(collection);
            record.set('workspace', targetWorkspaceId);
            record.set('actor', actorId || '');
            record.set('action', action);
            record.set('payload', payload || {});
            e.app.save(record);
            return record;
        };

        const toArray = (value) => (Array.isArray(value) ? value : []);
        const toObject = (value) => {
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                return value;
            }
            if (typeof value === 'string' && value.trim()) {
                try {
                    const parsed = JSON.parse(value);
                    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
                } catch (_) {
                    return {};
                }
            }
            return {};
        };
        const toNumber = (value, fallback) => {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : fallback;
        };
        const toBoolean = (value) => value === true || value === 'true' || value === 1;
        const toIsoString = (value) => {
            if (!value) return '';
            if (typeof value === 'string') return value;
            try {
                return new Date(value).toISOString();
            } catch (_) {
                return '';
            }
        };
        const backfillCustomerRefsInSnapshot = (sourceSnapshot) => {
            const normalized = Object.assign({}, toObject(sourceSnapshot));
            const customers = toArray(normalized.customers);
            const uniqueCustomersByName = {};
            const duplicateNames = {};

            customers.forEach((customer) => {
                const name = toText(customer && customer.name, '');
                if (!name) return;
                if (uniqueCustomersByName[name]) {
                    duplicateNames[name] = true;
                    return;
                }
                uniqueCustomersByName[name] = customer;
            });

            Object.keys(duplicateNames).forEach((name) => {
                delete uniqueCustomersByName[name];
            });

            normalized.sales = toArray(normalized.sales).map((item) => {
                const customerId = toText(item && item.customerId, '');
                if (customerId) return item;
                const customer = uniqueCustomersByName[toText(item && item.customer, '')];
                if (!customer) return item;
                return Object.assign({}, item, { customerId: toText(customer.id, '') });
            });

            normalized.crateLoans = toArray(normalized.crateLoans).map((item) => {
                const customerId = toText(item && item.customerId, '');
                if (customerId) return item;
                const customer = uniqueCustomersByName[toText(item && item.customer, '')];
                if (!customer) return item;
                return Object.assign({}, item, { customerId: toText(customer.id, '') });
            });

            return normalized;
        };
        const buildPriceKey = (item) => [
            toText(item.varietyId, ''),
            toText(item.size, ''),
            toText(item.quality, ''),
            toText(item.state, ''),
        ].join('::');
        const getWorkspaceRecords = (collectionName, targetWorkspaceId) =>
            e.app.findRecordsByFilter(collectionName, "workspace = '" + targetWorkspaceId + "'", '', 2000, 0);

        const replaceWorkspaceCollectionByExternalId = (collectionName, targetWorkspaceId, items, assignRecord) => {
            const collection = e.app.findCollectionByNameOrId(collectionName);
            const existingRecords = getWorkspaceRecords(collectionName, targetWorkspaceId);
            const existingByExternalId = {};
            existingRecords.forEach((record) => {
                existingByExternalId[toText(record.get('externalId'), '')] = record;
            });

            const seen = {};
            toArray(items).forEach((item) => {
                const externalId = toText(item && item.id, '');
                if (!externalId) return;

                seen[externalId] = true;
                const record = existingByExternalId[externalId] || new Record(collection);
                record.set('workspace', targetWorkspaceId);
                record.set('externalId', externalId);
                assignRecord(record, item || {});
                e.app.save(record);
            });

            existingRecords.forEach((record) => {
                const externalId = toText(record.get('externalId'), '');
                if (!seen[externalId]) {
                    e.app.delete(record);
                }
            });
        };

        const replaceWorkspacePriceCollection = (targetWorkspaceId, items) => {
            const collectionName = 'fideo_prices';
            const collection = e.app.findCollectionByNameOrId(collectionName);
            const existingRecords = getWorkspaceRecords(collectionName, targetWorkspaceId);
            const existingByKey = {};
            existingRecords.forEach((record) => {
                existingByKey[buildPriceKey({
                    varietyId: record.get('varietyId'),
                    size: record.get('size'),
                    quality: record.get('quality'),
                    state: record.get('state'),
                })] = record;
            });

            const seen = {};
            toArray(items).forEach((item) => {
                const key = buildPriceKey(item || {});
                if (!key.replace(/:/g, '')) return;

                seen[key] = true;
                const record = existingByKey[key] || new Record(collection);
                record.set('workspace', targetWorkspaceId);
                record.set('varietyId', toText(item.varietyId, ''));
                record.set('size', toText(item.size, ''));
                record.set('quality', toText(item.quality, ''));
                record.set('state', toText(item.state, ''));
                record.set('price', toNumber(item.price, 0));
                e.app.save(record);
            });

            existingRecords.forEach((record) => {
                const key = buildPriceKey({
                    varietyId: record.get('varietyId'),
                    size: record.get('size'),
                    quality: record.get('quality'),
                    state: record.get('state'),
                });
                if (!seen[key]) {
                    e.app.delete(record);
                }
            });
        };
        const normalizeTaskAssignmentsForSync = (items) =>
            toArray(items)
                .map((item) => {
                    const normalizedItem = toObject(item);
                    const fallbackId = [toText(normalizedItem.taskId, ''), toText(normalizedItem.employeeId, '')]
                        .filter((value) => !!value)
                        .join('::');
                    const externalId = toText(normalizedItem.id, fallbackId);
                    return externalId ? Object.assign({}, normalizedItem, { id: externalId }) : null;
                })
                .filter((item) => !!item);
        const normalizeTaskReportsForSync = (items) =>
            toArray(items)
                .map((item) => {
                    const normalizedItem = toObject(item);
                    const fallbackId = [
                        toText(normalizedItem.taskId, ''),
                        toText(normalizedItem.createdAt, ''),
                        toText(normalizedItem.kind, ''),
                        toText(normalizedItem.employeeId, ''),
                    ]
                        .filter((value) => !!value)
                        .join('::');
                    const externalId = toText(normalizedItem.id, fallbackId);
                    return externalId ? Object.assign({}, normalizedItem, { id: externalId }) : null;
                })
                .filter((item) => !!item);

        const syncNormalizedFromSnapshot = (targetWorkspaceId, sourceSnapshot) => {
            const normalizedSnapshot = toObject(sourceSnapshot);

            replaceWorkspaceCollectionByExternalId('fideo_product_groups', targetWorkspaceId, normalizedSnapshot.productGroups, (record, item) => {
                record.set('name', toText(item.name, ''));
                record.set('icon', toText(item.icon, ''));
                record.set('category', toText(item.category, ''));
                record.set('unit', toText(item.unit, 'cajas'));
                record.set('archived', toBoolean(item.archived));
                record.set('varieties', toArray(item.varieties));
            });

            replaceWorkspaceCollectionByExternalId('fideo_warehouses', targetWorkspaceId, normalizedSnapshot.warehouses, (record, item) => {
                record.set('name', toText(item.name, ''));
                record.set('icon', toText(item.icon, ''));
                record.set('archived', toBoolean(item.archived));
            });

            replaceWorkspacePriceCollection(targetWorkspaceId, normalizedSnapshot.prices);

            replaceWorkspaceCollectionByExternalId('fideo_inventory_batches', targetWorkspaceId, normalizedSnapshot.inventory, (record, item) => {
                record.set('varietyId', toText(item.varietyId, ''));
                record.set('size', toText(item.size, ''));
                record.set('quality', toText(item.quality, ''));
                record.set('quantity', toNumber(item.quantity, 0));
                record.set('state', toText(item.state, ''));
                record.set('location', toText(item.location, ''));
                record.set('warehouseId', toText(item.warehouseId, ''));
                record.set('packagingId', toText(item.packagingId, ''));
                record.set('entryDate', toIsoString(item.entryDate));
            });

            replaceWorkspaceCollectionByExternalId('fideo_customers', targetWorkspaceId, normalizedSnapshot.customers, (record, item) => {
                record.set('name', toText(item.name, ''));
                record.set('contacts', toArray(item.contacts));
                record.set('specialPrices', toArray(item.specialPrices));
                record.set('schedule', item.schedule ? toObject(item.schedule) : null);
                record.set('deliveryNotes', toText(item.deliveryNotes, ''));
                record.set('creditStatus', toText(item.creditStatus, 'Confiable'));
                if (item.creditLimit === undefined || item.creditLimit === null || item.creditLimit === '') {
                    record.set('creditLimit', null);
                } else {
                    record.set('creditLimit', toNumber(item.creditLimit, 0));
                }
            });

            replaceWorkspaceCollectionByExternalId('fideo_suppliers', targetWorkspaceId, normalizedSnapshot.suppliers, (record, item) => {
                record.set('name', toText(item.name, ''));
                record.set('contact', toText(item.contact, ''));
                record.set('supplies', toArray(item.supplies));
            });

            replaceWorkspaceCollectionByExternalId('fideo_purchase_orders', targetWorkspaceId, normalizedSnapshot.purchaseOrders, (record, item) => {
                record.set('supplierId', toText(item.supplierId, ''));
                record.set('varietyId', toText(item.varietyId, ''));
                record.set('size', toText(item.size, ''));
                record.set('packaging', toText(item.packaging, ''));
                record.set('quantity', toNumber(item.quantity, 0));
                record.set('totalCost', toNumber(item.totalCost, 0));
                record.set('status', toText(item.status, 'Pendiente'));
                record.set('orderDate', toIsoString(item.orderDate));
                record.set('expectedArrivalDate', toIsoString(item.expectedArrivalDate));
                record.set('paymentMethod', toText(item.paymentMethod, 'N/A'));
            });

            replaceWorkspaceCollectionByExternalId('fideo_sales', targetWorkspaceId, normalizedSnapshot.sales, (record, item) => {
                record.set('productGroupId', toText(item.productGroupId, ''));
                record.set('varietyId', toText(item.varietyId, ''));
                record.set('customerId', toText(item.customerId, ''));
                record.set('productGroupName', toText(item.productGroupName, ''));
                record.set('varietyName', toText(item.varietyName, ''));
                record.set('size', toText(item.size, ''));
                record.set('quality', toText(item.quality, ''));
                record.set('state', toText(item.state, ''));
                record.set('quantity', toNumber(item.quantity, 0));
                record.set('price', toNumber(item.price, 0));
                record.set('cogs', toNumber(item.cogs, 0));
                record.set('unit', toText(item.unit, ''));
                record.set('customer', toText(item.customer, ''));
                record.set('destination', toText(item.destination, ''));
                record.set('locationQuery', toText(item.locationQuery, ''));
                record.set('status', toText(item.status, 'Pendiente de Empaque'));
                record.set('paymentStatus', toText(item.paymentStatus, 'Pendiente'));
                record.set('paymentMethod', toText(item.paymentMethod, 'N/A'));
                record.set('paymentNotes', toText(item.paymentNotes, ''));
                record.set('assignedEmployeeId', toText(item.assignedEmployeeId, ''));
                record.set('timestamp', toIsoString(item.timestamp));
                record.set('deliveryDeadline', toIsoString(item.deliveryDeadline));
            });

            replaceWorkspaceCollectionByExternalId('fideo_payments', targetWorkspaceId, normalizedSnapshot.payments, (record, item) => {
                record.set('customerId', toText(item.customerId, ''));
                record.set('amount', toNumber(item.amount, 0));
                record.set('date', toIsoString(item.date));
                record.set('saleId', toText(item.saleId, ''));
            });

            replaceWorkspaceCollectionByExternalId('fideo_crate_loans', targetWorkspaceId, normalizedSnapshot.crateLoans, (record, item) => {
                record.set('customerId', toText(item.customerId, ''));
                record.set('customer', toText(item.customer, ''));
                record.set('crateTypeId', toText(item.crateTypeId, ''));
                record.set('quantity', toNumber(item.quantity, 0));
                record.set('timestamp', toIsoString(item.timestamp));
                record.set('dueDate', toIsoString(item.dueDate));
                record.set('status', toText(item.status, 'Prestado'));
            });

            replaceWorkspaceCollectionByExternalId('fideo_employee_activities', targetWorkspaceId, normalizedSnapshot.activities, (record, item) => {
                record.set('employee', toText(item.employee, ''));
                record.set('activity', toText(item.activity, ''));
                record.set('timestamp', toIsoString(item.timestamp));
            });

            replaceWorkspaceCollectionByExternalId('fideo_activity_logs', targetWorkspaceId, normalizedSnapshot.activityLog, (record, item) => {
                const details = toObject(item.details);
                record.set('type', toText(item.type, 'NAVEGACION'));
                record.set('timestamp', toIsoString(item.timestamp));
                record.set('description', toText(item.description, ''));
                record.set('details', Object.keys(details).length > 0 ? details : null);
            });

            replaceWorkspaceCollectionByExternalId('fideo_cash_drawers', targetWorkspaceId, normalizedSnapshot.cashDrawers, (record, item) => {
                record.set('name', toText(item.name, ''));
                record.set('balance', toNumber(item.balance, 0));
                record.set('status', toText(item.status, 'Cerrada'));
                record.set('lastOpened', toIsoString(item.lastOpened));
                record.set('lastClosed', toIsoString(item.lastClosed));
            });

            replaceWorkspaceCollectionByExternalId('fideo_cash_drawer_activities', targetWorkspaceId, normalizedSnapshot.cashDrawerActivities, (record, item) => {
                record.set('drawerId', toText(item.drawerId, ''));
                record.set('type', toText(item.type, 'SALDO_INICIAL'));
                record.set('amount', toNumber(item.amount, 0));
                record.set('timestamp', toIsoString(item.timestamp));
                record.set('notes', toText(item.notes, ''));
                record.set('relatedId', toText(item.relatedId, ''));
            });

            replaceWorkspaceCollectionByExternalId('fideo_task_assignments', targetWorkspaceId, normalizeTaskAssignmentsForSync(normalizedSnapshot.taskAssignments), (record, item) => {
                const payload = toObject(item);
                record.set('taskId', toText(item.taskId, ''));
                record.set('employeeId', toText(item.employeeId, ''));
                record.set('role', toText(item.role, ''));
                record.set('status', toText(item.status, 'assigned'));
                record.set('assignedAt', toIsoString(item.assignedAt));
                record.set('acknowledgedAt', toIsoString(item.acknowledgedAt));
                record.set('startedAt', toIsoString(item.startedAt));
                record.set('blockedAt', toIsoString(item.blockedAt));
                record.set('doneAt', toIsoString(item.doneAt));
                record.set('blockedReason', toText(item.blockedReason, ''));
                record.set('payload', Object.keys(payload).length > 0 ? payload : null);
            });

            replaceWorkspaceCollectionByExternalId('fideo_task_reports', targetWorkspaceId, normalizeTaskReportsForSync(normalizedSnapshot.taskReports), (record, item) => {
                const payload = toObject(item);
                record.set('taskId', toText(item.taskId, ''));
                record.set('saleId', toText(item.saleId, ''));
                record.set('role', toText(item.role, ''));
                record.set('employeeId', toText(item.employeeId, ''));
                record.set('employeeName', toText(item.employeeName, ''));
                record.set('customerId', toText(item.customerId, ''));
                record.set('customerName', toText(item.customerName, ''));
                record.set('taskTitle', toText(item.taskTitle, ''));
                record.set('kind', toText(item.kind, 'note'));
                record.set('status', toText(item.status, 'resolved'));
                record.set('severity', toText(item.severity, 'normal'));
                record.set('summary', toText(item.summary, ''));
                record.set('detail', toText(item.detail, ''));
                record.set('evidence', toText(item.evidence, ''));
                record.set('escalationStatus', toText(item.escalationStatus, 'none'));
                record.set('createdAt', toIsoString(item.createdAt));
                record.set('resolvedAt', toIsoString(item.resolvedAt));
                record.set('escalatedAt', toIsoString(item.escalatedAt));
                record.set('payload', Object.keys(payload).length > 0 ? payload : null);
            });
        };

        if (!workspaceId || authWorkspaceId !== workspaceId) {
            throw new ForbiddenError('No tienes acceso a este workspace.');
        }

        if (!canPersistWorkspaceSnapshot()) {
            throw new ForbiddenError('Este perfil es de solo lectura y no puede persistir cambios en el workspace.');
        }

        let snapshotRecord = findSnapshotByWorkspace(workspaceId);
        if (!snapshotRecord) {
            const collection = e.app.findCollectionByNameOrId('fideo_state_snapshots');
            snapshotRecord = new Record(collection);
            snapshotRecord.set('workspace', workspaceId);
            snapshotRecord.set('version', 1);
        }

        const currentVersion = Number(snapshotRecord.get('version') || 0);
        if (expectedVersion && currentVersion && expectedVersion < currentVersion) {
            return e.json(409, {
                message: 'El snapshot remoto ya cambio. Recarga antes de volver a guardar.',
                version: currentVersion,
                snapshotRecordId: snapshotRecord.id,
            });
        }

        const previousSnapshot = backfillCustomerRefsInSnapshot(snapshotRecord.get('snapshot'));
        const normalizedSnapshot = backfillCustomerRefsInSnapshot(snapshot);

        snapshotRecord.set('snapshot', normalizedSnapshot);
        snapshotRecord.set('version', currentVersion > 0 ? currentVersion + 1 : 1);
        snapshotRecord.set('updatedBy', authRecord.id);
        e.app.save(snapshotRecord);

        syncNormalizedFromSnapshot(workspaceId, normalizedSnapshot);

        const pushNotifications = fideoPushDispatchOperational(e.app, {
            workspaceId: workspaceId,
            workspaceSlug: fideoPushGetWorkspaceSlug(e.app, workspaceId),
            previousSnapshot: previousSnapshot,
            nextSnapshot: normalizedSnapshot,
        });

        writeActionLog(workspaceId, authRecord.id, 'persist_state', {
            version: snapshotRecord.get('version'),
            normalized: true,
            pushNotifications: pushNotifications,
        });

        return e.json(200, {
            version: snapshotRecord.get('version'),
            snapshotRecordId: snapshotRecord.id,
            updatedAt: new Date().toISOString(),
            pushNotifications: pushNotifications,
        });
    },
    $apis.requireAuth('fideo_users'),
);

routerAdd(
    'POST',
    '/api/fideo/tasks/report',
    (e) => {
        const authRecord = e.auth || e.requestInfo().auth;
        if (!authRecord) {
            throw new UnauthorizedError('Necesitas autenticarte para reportar tareas de Fideo.');
        }

        const body = e.requestInfo().body || {};
        const workspaceId = body.workspaceId || '';
        const expectedVersion = Number(body.expectedVersion || 0);
        const snapshot = body.snapshot || {};
        const taskId = body.taskId || '';
        const reportInput = body.report || {};
        const authWorkspaceId = authRecord.get('workspace') || '';

        const toText = (value, fallback) => (value === undefined || value === null || value === '' ? (fallback || '') : String(value));
        const toArray = (value) => (Array.isArray(value) ? value : []);
        const toObject = (value) => {
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                try {
                    const normalized = JSON.parse(JSON.stringify(value));
                    return normalized && typeof normalized === 'object' && !Array.isArray(normalized) ? normalized : {};
                } catch (_) {
                    return value;
                }
            }
            if (typeof value === 'string' && value.trim()) {
                try {
                    const parsed = JSON.parse(value);
                    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
                } catch (_) {
                    return {};
                }
            }
            return {};
        };
        const toNumber = (value, fallback) => {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : fallback;
        };
        const toBoolean = (value) => value === true || value === 'true' || value === 1;
        const toIsoString = (value) => {
            if (!value) return '';
            if (typeof value === 'string') return value;
            try {
                return new Date(value).toISOString();
            } catch (_) {
                return '';
            }
        };
        const cloneValue = (value, fallback) => JSON.parse(JSON.stringify(value === undefined ? fallback : value));
        const canPersistWorkspaceSnapshot = () => {
            const role = toText(authRecord.get('role'), 'Admin');
            return !!authRecord.get('canSwitchRoles') || ['Admin', 'Empacador', 'Repartidor', 'Cajero'].indexOf(role) >= 0;
        };
        const findSnapshotByWorkspace = (targetWorkspaceId) => {
            try {
                return e.app.findFirstRecordByData('fideo_state_snapshots', 'workspace', targetWorkspaceId);
            } catch (_) {
                return null;
            }
        };
        const writeActionLog = (targetWorkspaceId, actorId, action, payload) => {
            const collection = e.app.findCollectionByNameOrId('fideo_action_logs');
            const record = new Record(collection);
            record.set('workspace', targetWorkspaceId);
            record.set('actor', actorId || '');
            record.set('action', action);
            record.set('payload', payload || {});
            e.app.save(record);
            return record;
        };
        const backfillCustomerRefsInSnapshot = (sourceSnapshot) => {
            const normalized = Object.assign({}, toObject(sourceSnapshot));
            const customers = toArray(normalized.customers);
            const uniqueCustomersByName = {};
            const duplicateNames = {};

            customers.forEach((customer) => {
                const name = toText(customer && customer.name, '');
                if (!name) return;
                if (uniqueCustomersByName[name]) {
                    duplicateNames[name] = true;
                    return;
                }
                uniqueCustomersByName[name] = customer;
            });

            Object.keys(duplicateNames).forEach((name) => {
                delete uniqueCustomersByName[name];
            });

            normalized.sales = toArray(normalized.sales).map((item) => {
                const customerId = toText(item && item.customerId, '');
                if (customerId) return item;
                const customer = uniqueCustomersByName[toText(item && item.customer, '')];
                if (!customer) return item;
                return Object.assign({}, item, { customerId: toText(customer.id, '') });
            });

            normalized.crateLoans = toArray(normalized.crateLoans).map((item) => {
                const customerId = toText(item && item.customerId, '');
                if (customerId) return item;
                const customer = uniqueCustomersByName[toText(item && item.customer, '')];
                if (!customer) return item;
                return Object.assign({}, item, { customerId: toText(customer.id, '') });
            });

            return normalized;
        };
        const getWorkspaceRecords = (collectionName, targetWorkspaceId) =>
            e.app.findRecordsByFilter(collectionName, "workspace = '" + targetWorkspaceId + "'", '', 2000, 0);
        const replaceWorkspaceCollectionByExternalId = (collectionName, targetWorkspaceId, items, assignRecord) => {
            const collection = e.app.findCollectionByNameOrId(collectionName);
            const existingRecords = getWorkspaceRecords(collectionName, targetWorkspaceId);
            const existingByExternalId = {};
            existingRecords.forEach((record) => {
                existingByExternalId[toText(record.get('externalId'), '')] = record;
            });

            const seen = {};
            toArray(items).forEach((item) => {
                const externalId = toText(item && item.id, '');
                if (!externalId) return;
                seen[externalId] = true;
                const record = existingByExternalId[externalId] || new Record(collection);
                record.set('workspace', targetWorkspaceId);
                record.set('externalId', externalId);
                assignRecord(record, item || {});
                e.app.save(record);
            });

            existingRecords.forEach((record) => {
                const externalId = toText(record.get('externalId'), '');
                if (!seen[externalId]) {
                    e.app.delete(record);
                }
            });
        };
        const normalizeTaskAssignmentsForSync = (items) =>
            toArray(items)
                .map((item) => {
                    const normalizedItem = toObject(item);
                    const fallbackId = [toText(normalizedItem.taskId, ''), toText(normalizedItem.employeeId, '')]
                        .filter((value) => !!value)
                        .join('::');
                    const externalId = toText(normalizedItem.id, fallbackId);
                    return externalId ? Object.assign({}, normalizedItem, { id: externalId }) : null;
                })
                .filter((item) => !!item);
        const normalizeTaskReportsForSync = (items) =>
            toArray(items)
                .map((item) => {
                    const normalizedItem = toObject(item);
                    const fallbackId = [
                        toText(normalizedItem.taskId, ''),
                        toText(normalizedItem.createdAt, ''),
                        toText(normalizedItem.kind, ''),
                        toText(normalizedItem.employeeId, ''),
                    ]
                        .filter((value) => !!value)
                        .join('::');
                    const externalId = toText(normalizedItem.id, fallbackId);
                    return externalId ? Object.assign({}, normalizedItem, { id: externalId }) : null;
                })
                .filter((item) => !!item);
        const syncTaskSlices = (targetWorkspaceId, sourceSnapshot) => {
            replaceWorkspaceCollectionByExternalId('fideo_task_assignments', targetWorkspaceId, normalizeTaskAssignmentsForSync(sourceSnapshot.taskAssignments), (record, item) => {
                const payload = toObject(item);
                record.set('taskId', toText(item.taskId, ''));
                record.set('employeeId', toText(item.employeeId, ''));
                record.set('role', toText(item.role, ''));
                record.set('status', toText(item.status, 'assigned'));
                record.set('assignedAt', toIsoString(item.assignedAt || item.createdAt));
                record.set('acknowledgedAt', toIsoString(item.acknowledgedAt));
                record.set('startedAt', toIsoString(item.startedAt));
                record.set('blockedAt', toIsoString(item.blockedAt));
                record.set('doneAt', toIsoString(item.doneAt || item.completedAt));
                record.set('blockedReason', toText(item.blockedReason, ''));
                record.set('payload', Object.keys(payload).length > 0 ? payload : null);
            });

            replaceWorkspaceCollectionByExternalId('fideo_task_reports', targetWorkspaceId, normalizeTaskReportsForSync(sourceSnapshot.taskReports), (record, item) => {
                const payload = toObject(item);
                record.set('taskId', toText(item.taskId, ''));
                record.set('saleId', toText(item.saleId, ''));
                record.set('role', toText(item.role, ''));
                record.set('employeeId', toText(item.employeeId, ''));
                record.set('employeeName', toText(item.employeeName, ''));
                record.set('customerId', toText(item.customerId, ''));
                record.set('customerName', toText(item.customerName, ''));
                record.set('taskTitle', toText(item.taskTitle, ''));
                record.set('kind', toText(item.kind, 'note'));
                record.set('status', toText(item.status, 'resolved'));
                record.set('severity', toText(item.severity, 'normal'));
                record.set('summary', toText(item.summary, ''));
                record.set('detail', toText(item.detail, ''));
                record.set('evidence', toText(item.evidence, ''));
                record.set('escalationStatus', toText(item.escalationStatus, 'none'));
                record.set('createdAt', toIsoString(item.createdAt));
                record.set('resolvedAt', toIsoString(item.resolvedAt));
                record.set('escalatedAt', toIsoString(item.escalatedAt));
                record.set('payload', Object.keys(payload).length > 0 ? payload : null);
            });
        };
        const normalizeReportKind = (value) => {
            const normalized = toText(value, '').trim().toLowerCase();
            if (normalized === 'note' || normalized === 'nota') return 'note';
            if (normalized === 'incident' || normalized === 'incidencia') return 'incident';
            if (normalized === 'blocker' || normalized === 'blocked' || normalized === 'bloqueo') return 'blocker';
            if (normalized === 'completion' || normalized === 'completed' || normalized === 'closure' || normalized === 'cierre') return 'completion';
            return '';
        };

        if (!workspaceId || authWorkspaceId !== workspaceId) {
            throw new ForbiddenError('No tienes acceso a este workspace.');
        }

        if (!canPersistWorkspaceSnapshot()) {
            throw new ForbiddenError('Este perfil es de solo lectura y no puede reportar tareas en el workspace.');
        }

        if (!taskId) {
            throw new BadRequestError('Necesitas indicar el taskId del reporte.');
        }

        let snapshotRecord = findSnapshotByWorkspace(workspaceId);
        if (!snapshotRecord) {
            const collection = e.app.findCollectionByNameOrId('fideo_state_snapshots');
            snapshotRecord = new Record(collection);
            snapshotRecord.set('workspace', workspaceId);
            snapshotRecord.set('version', 1);
        }

        const currentVersion = Number(snapshotRecord.get('version') || 0);
        if (expectedVersion && currentVersion && expectedVersion < currentVersion) {
            return e.json(409, {
                message: 'El snapshot remoto ya cambio. Recarga antes de volver a reportar.',
                version: currentVersion,
                snapshotRecordId: snapshotRecord.id,
            });
        }

        const previousSnapshot = backfillCustomerRefsInSnapshot(cloneValue(snapshotRecord.get('snapshot'), {}));
        const workingSnapshot = backfillCustomerRefsInSnapshot(cloneValue(snapshot, {}));
        const tasks = cloneValue(toArray(workingSnapshot.taskAssignments), []);
        const taskIndex = tasks.findIndex((item) => toText(item && item.id, '') === toText(taskId, ''));
        if (taskIndex < 0) {
            throw new BadRequestError('No encontre la tarea indicada dentro del snapshot.');
        }

        const rawReport = toObject(reportInput);
        const kind = normalizeReportKind(rawReport.kind || rawReport.type);
        const summary = toText(rawReport.summary, toText(rawReport.message, '')).trim();
        if (!kind || !summary) {
            throw new BadRequestError('El reporte necesita al menos kind/type y summary/message.');
        }

        const nowIso = new Date().toISOString();
        const task = toObject(tasks[taskIndex]);
        const nextTaskStatus = (() => {
            const explicit = toText(rawReport.nextTaskStatus, '');
            if (['assigned', 'acknowledged', 'in_progress', 'blocked', 'done'].indexOf(explicit) >= 0) return explicit;
            if (kind === 'blocker') return 'blocked';
            if (kind === 'completion') return 'done';
            return '';
        })();

        const updatedTask = {
            ...task,
            status: nextTaskStatus || toText(task.status, 'assigned'),
            employeeId: toText(rawReport.employeeId, toText(task.employeeId, toText(authRecord.get('employeeId'), ''))),
            employeeName: toText(rawReport.employeeName, toText(task.employeeName, toText(authRecord.get('name'), ''))),
            updatedAt: nowIso,
            blockedAt: nextTaskStatus === 'blocked' ? nowIso : (nextTaskStatus === 'done' ? '' : toText(task.blockedAt, '')),
            blockedReason: nextTaskStatus === 'blocked'
                ? toText(rawReport.detail, summary)
                : (nextTaskStatus === 'done' ? '' : toText(task.blockedReason, '')),
            completedAt: nextTaskStatus === 'done' ? nowIso : toText(task.completedAt, ''),
        };
        tasks[taskIndex] = updatedTask;

        const severity = toText(rawReport.severity, kind === 'blocker' ? 'high' : 'normal');
        const reportStatus = kind === 'note' || kind === 'completion' ? 'resolved' : toText(rawReport.status, 'open');
        const escalationStatus = toText(rawReport.escalationStatus, (kind === 'blocker' || severity === 'high') ? 'pending' : 'none');
        const report = {
            id: toText(rawReport.id, 'task_report_' + Date.now() + '_' + Math.round(Math.random() * 100000)),
            taskId: toText(task.id, taskId),
            saleId: toText(task.saleId, ''),
            role: toText(task.role, 'Admin'),
            employeeId: toText(rawReport.employeeId, toText(updatedTask.employeeId, '')),
            employeeName: toText(rawReport.employeeName, toText(updatedTask.employeeName, '')),
            customerId: toText(task.customerId, ''),
            customerName: toText(task.customerName, ''),
            taskTitle: toText(task.title, ''),
            kind: kind,
            status: reportStatus,
            severity: severity,
            summary: summary,
            detail: toText(rawReport.detail, ''),
            evidence: toText(rawReport.evidence, ''),
            escalationStatus: escalationStatus,
            createdAt: toIsoString(rawReport.createdAt || nowIso),
            resolvedAt: reportStatus === 'resolved' ? toIsoString(rawReport.resolvedAt || nowIso) : '',
            escalatedAt: toIsoString(rawReport.escalatedAt),
        };

        const nextSnapshot = backfillCustomerRefsInSnapshot({
            ...workingSnapshot,
            taskAssignments: tasks,
            taskReports: [report].concat(toArray(workingSnapshot.taskReports)),
        });

        snapshotRecord.set('snapshot', nextSnapshot);
        snapshotRecord.set('version', currentVersion > 0 ? currentVersion + 1 : 1);
        snapshotRecord.set('updatedBy', authRecord.id);
        e.app.save(snapshotRecord);

        syncTaskSlices(workspaceId, nextSnapshot);

        const pushNotifications = fideoPushDispatchOperational(e.app, {
            workspaceId: workspaceId,
            workspaceSlug: fideoPushGetWorkspaceSlug(e.app, workspaceId),
            previousSnapshot: previousSnapshot,
            nextSnapshot: nextSnapshot,
        });

        const actionLogRecord = writeActionLog(workspaceId, authRecord.id, 'submit_task_report', {
            taskId: taskId,
            report: cloneValue(report, {}),
            taskAssignment: cloneValue(updatedTask, {}),
            previousTaskAssignment: cloneValue(task, {}),
            version: snapshotRecord.get('version'),
            previousVersion: currentVersion || 0,
            pushNotifications: pushNotifications,
        });

        return e.json(200, {
            version: snapshotRecord.get('version'),
            snapshotRecordId: snapshotRecord.id,
            updatedAt: new Date().toISOString(),
            snapshot: nextSnapshot,
            report: report,
            taskAssignment: updatedTask,
            actionLogId: actionLogRecord.id,
            notification: kind === 'blocker'
                ? { text: 'Bloqueo reportado para ' + toText(task.customerName, toText(task.title, 'la tarea')), isError: true }
                : null,
            pushNotifications: pushNotifications,
        });
    },
    $apis.requireAuth('fideo_users'),
);

routerAdd(
    'POST',
    '/api/fideo/messages/interpret',
    (e) => {
        const authRecord = e.auth || e.requestInfo().auth;
        if (!authRecord) {
            throw new UnauthorizedError('Necesitas autenticarte para interpretar mensajes de Fideo.');
        }

        const body = e.requestInfo().body || {};
        const workspaceId = body.workspaceId || '';
        const expectedVersion = Number(body.expectedVersion || 0);
        const snapshot = body.snapshot || {};
        const messageId = body.messageId || '';
        const incomingMessage = body.message || {};
        const forceInterpretation = body.force === true || body.force === 'true' || body.force === 1;
        const authWorkspaceId = authRecord.get('workspace') || '';

        const parseJsonLike = (value) => {
            if (typeof value !== 'string') {
                return value;
            }

            const trimmed = value.trim();
            if (!trimmed) {
                return value;
            }

            if (
                (trimmed.charAt(0) === '{' && trimmed.charAt(trimmed.length - 1) === '}') ||
                (trimmed.charAt(0) === '[' && trimmed.charAt(trimmed.length - 1) === ']')
            ) {
                try {
                    return JSON.parse(trimmed);
                } catch (_) {
                    return value;
                }
            }

            return value;
        };
        const toArray = (value) => {
            const normalized = parseJsonLike(value);
            return Array.isArray(normalized) ? normalized : [];
        };
        const toObject = (value) => {
            const normalized = parseJsonLike(value);
            return normalized && typeof normalized === 'object' && !Array.isArray(normalized) ? normalized : {};
        };
        const toText = (value, fallback) => (value === undefined || value === null || value === '' ? (fallback || '') : String(value));
        const toBoolean = (value) => value === true || value === 'true' || value === 1;
        const toIsoString = (value) => {
            if (!value) return '';
            if (typeof value === 'string') return value;
            try {
                return new Date(value).toISOString();
            } catch (_) {
                return '';
            }
        };
        const cloneValue = (value, fallback) => JSON.parse(JSON.stringify(value === undefined ? fallback : value));
        const pickDefined = (...values) => {
            for (let index = 0; index < values.length; index += 1) {
                if (values[index] !== undefined) {
                    return values[index];
                }
            }
            return undefined;
        };
        const canPersistWorkspaceSnapshot = () => {
            const role = toText(authRecord.get('role'), 'Admin');
            return !!authRecord.get('canSwitchRoles') || ['Admin', 'Empacador', 'Repartidor', 'Cajero'].indexOf(role) >= 0;
        };
        const findSnapshotByWorkspace = (targetWorkspaceId) => {
            try {
                return e.app.findFirstRecordByData('fideo_state_snapshots', 'workspace', targetWorkspaceId);
            } catch (_) {
                return null;
            }
        };
        const writeActionLog = (targetWorkspaceId, actorId, action, payload) => {
            const collection = e.app.findCollectionByNameOrId('fideo_action_logs');
            const record = new Record(collection);
            record.set('workspace', targetWorkspaceId);
            record.set('actor', actorId || '');
            record.set('action', action);
            record.set('payload', payload || {});
            e.app.save(record);
            return record;
        };
        const backfillCustomerRefsInSnapshot = (sourceSnapshot) => {
            const normalized = Object.assign({}, toObject(sourceSnapshot));
            const customers = toArray(normalized.customers);
            const uniqueCustomersByName = {};
            const duplicateNames = {};

            customers.forEach((customer) => {
                const name = toText(customer && customer.name, '');
                if (!name) return;
                if (uniqueCustomersByName[name]) {
                    duplicateNames[name] = true;
                    return;
                }
                uniqueCustomersByName[name] = customer;
            });

            Object.keys(duplicateNames).forEach((name) => {
                delete uniqueCustomersByName[name];
            });

            normalized.sales = toArray(normalized.sales).map((item) => {
                const customerId = toText(item && item.customerId, '');
                if (customerId) return item;
                const customer = uniqueCustomersByName[toText(item && item.customer, '')];
                if (!customer) return item;
                return Object.assign({}, item, { customerId: toText(customer.id, '') });
            });

            normalized.crateLoans = toArray(normalized.crateLoans).map((item) => {
                const customerId = toText(item && item.customerId, '');
                if (customerId) return item;
                const customer = uniqueCustomersByName[toText(item && item.customer, '')];
                if (!customer) return item;
                return Object.assign({}, item, { customerId: toText(customer.id, '') });
            });

            return normalized;
        };
        const buildUnknownInterpretation = (messageText, sender, explanation) => ({
            type: 'DESCONOCIDO',
            originalMessage: messageText,
            certainty: 0.1,
            explanation: toText(
                explanation,
                'No estoy seguro de como procesar tu solicitud en este momento. Por favor, intentalo de nuevo con otras palabras.',
            ),
            data: {},
            sender: sender,
        });
        const normalizeInterpretation = (rawInterpretation, messageText, sender, fallbackExplanation) => {
            const interpreted = toObject(rawInterpretation);
            const type = toText(interpreted.type, 'DESCONOCIDO');
            const certaintyValue = Number(interpreted.certainty);
            return {
                type: type,
                originalMessage: messageText,
                certainty: Number.isFinite(certaintyValue)
                    ? Math.max(0, Math.min(1, certaintyValue))
                    : (type === 'DESCONOCIDO' ? 0.1 : 0.65),
                explanation: toText(interpreted.explanation, fallbackExplanation || 'Interpretacion procesada por el servidor.'),
                data: toObject(interpreted.data),
                sender: sender,
            };
        };
        const stripMarkdownFence = (value) => {
            let normalized = toText(value, '').trim();
            if (normalized.indexOf('```') !== 0) {
                return normalized;
            }

            const firstLineBreak = normalized.indexOf('\n');
            const lastFence = normalized.lastIndexOf('```');
            if (firstLineBreak >= 0 && lastFence > firstLineBreak) {
                normalized = normalized.substring(firstLineBreak + 1, lastFence).trim();
            }

            return normalized;
        };
        const normalizeSearchText = (value) =>
            toText(value, '')
                .toLowerCase()
                .replace(/[\u00e1\u00e0\u00e4\u00e2]/g, 'a')
                .replace(/[\u00e9\u00e8\u00eb\u00ea]/g, 'e')
                .replace(/[\u00ed\u00ec\u00ef\u00ee]/g, 'i')
                .replace(/[\u00f3\u00f2\u00f6\u00f4]/g, 'o')
                .replace(/[\u00fa\u00f9\u00fc\u00fb]/g, 'u')
                .replace(/\u00f1/g, 'n');
        const shouldEnableGoogleMaps = (messageText) => {
            const normalized = normalizeSearchText(messageText);
            const keywords = [
                'direccion',
                'ubicacion',
                'ubica',
                'mapa',
                'maps',
                'calle',
                'avenida',
                'colonia',
                'entrega',
                'lleva',
                'llevale',
                'envia',
                'local',
                'mercado',
                'central',
                'destino',
            ];

            return keywords.some((keyword) => normalized.indexOf(keyword) >= 0);
        };
        const resolveGeminiApiKey = () => {
            const envKeys = [
                'FIDEO_GEMINI_API_KEY',
                'GEMINI_API_KEY',
                'GOOGLE_API_KEY',
                'API_KEY',
                'VITE_GEMINI_API_KEY',
            ];

            for (let index = 0; index < envKeys.length; index += 1) {
                const value = toText($os.getenv(envKeys[index]), '').trim();
                if (value) {
                    return {
                        env: envKeys[index],
                        value: value,
                    };
                }
            }

            return null;
        };
        const resolveGeminiModel = () => {
            const configuredModel = toText(
                $os.getenv('FIDEO_GEMINI_MODEL') || $os.getenv('GEMINI_MODEL'),
                '',
            ).trim();
            return configuredModel || 'gemini-2.5-flash';
        };
        const extractGeminiResponseText = (payload) => {
            const candidates = toArray(payload && payload.candidates);
            for (let candidateIndex = 0; candidateIndex < candidates.length; candidateIndex += 1) {
                const candidate = toObject(candidates[candidateIndex]);
                const content = toObject(candidate.content);
                const parts = toArray(content.parts);

                for (let partIndex = 0; partIndex < parts.length; partIndex += 1) {
                    const part = toObject(parts[partIndex]);
                    const text = toText(part.text, '').trim();
                    if (text) {
                        return text;
                    }
                }

                const fallbackText = toText(candidate.text, '').trim();
                if (fallbackText) {
                    return fallbackText;
                }
            }

            return '';
        };
        const requestGeminiInterpretation = (messageText, sender, systemPrompt) => {
            const apiKey = resolveGeminiApiKey();
            if (!apiKey) {
                return {
                    interpretation: buildUnknownInterpretation(
                        messageText,
                        sender,
                        'La API de IA no esta configurada en PocketBase. El mensaje quedo centralizado en el backend, pero requiere una API key para interpretar con Gemini.',
                    ),
                    meta: {
                        provider: 'fallback',
                        mode: 'missing_api_key',
                        model: null,
                        apiKeyEnv: null,
                        usedGoogleMaps: false,
                        error: null,
                    },
                };
            }

            const model = resolveGeminiModel();
            const usedGoogleMaps = shouldEnableGoogleMaps(messageText);
            const payload = {
                contents: [
                    {
                        role: 'user',
                        parts: [
                            {
                                text: 'Mensaje del usuario "' + sender + '": "' + messageText + '"',
                            },
                        ],
                    },
                ],
                generationConfig: {
                    responseMimeType: 'application/json',
                    temperature: 0.1,
                },
            };

            if (systemPrompt) {
                payload.systemInstruction = {
                    role: 'system',
                    parts: [
                        {
                            text: systemPrompt,
                        },
                    ],
                };
            }

            if (usedGoogleMaps) {
                payload.tools = [{ googleMaps: {} }];
            }

            try {
                // PocketBase JSVM is not a full Node runtime, so Gemini is called through REST instead of @google/genai.
                const response = $http.send({
                    url: 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent',
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-goog-api-key': apiKey.value,
                    },
                    body: JSON.stringify(payload),
                    timeout: 45,
                });

                if (response.statusCode < 200 || response.statusCode >= 300) {
                    throw new Error(
                        'Gemini devolvio HTTP ' + response.statusCode + (response.raw ? ': ' + response.raw.substring(0, 400) : ''),
                    );
                }

                const responseText = stripMarkdownFence(extractGeminiResponseText(response.json));
                if (!responseText) {
                    throw new Error('Gemini no devolvio una respuesta interpretable.');
                }

                const parsed = JSON.parse(responseText);
                return {
                    interpretation: normalizeInterpretation(
                        parsed,
                        messageText,
                        sender,
                        'Interpretacion generada por Gemini desde el backend.',
                    ),
                    meta: {
                        provider: 'gemini-rest',
                        mode: 'remote',
                        model: model,
                        apiKeyEnv: apiKey.env,
                        usedGoogleMaps: usedGoogleMaps,
                        error: null,
                    },
                };
            } catch (error) {
                const errorMessage = toText(error && error.message, toText(error, ''));
                return {
                    interpretation: buildUnknownInterpretation(
                        messageText,
                        sender,
                        'No pude interpretar este mensaje desde el backend en este momento. Revisa la configuracion de Gemini y vuelve a intentarlo.',
                    ),
                    meta: {
                        provider: 'fallback',
                        mode: 'gemini_error',
                        model: model,
                        apiKeyEnv: apiKey.env,
                        usedGoogleMaps: usedGoogleMaps,
                        error: errorMessage,
                    },
                };
            }
        };
        const upsertMessageOnSnapshot = (sourceSnapshot, overrides) => {
            const normalizedOverrides = toObject(overrides);
            const messages = cloneValue(toArray(sourceSnapshot.messages), []);
            const existingIndex = messages.findIndex((item) => toText(item.id, '') === toText(messageId, ''));
            const existingMessage = existingIndex >= 0 ? toObject(messages[existingIndex]) : {};
            const normalizedMessage = {
                ...existingMessage,
                ...toObject(incomingMessage),
                ...normalizedOverrides,
                id: toText(messageId, ''),
                sender: toText(pickDefined(normalizedOverrides.sender, incomingMessage.sender, existingMessage.sender), 'Sistema'),
                text: toText(pickDefined(normalizedOverrides.text, incomingMessage.text, existingMessage.text), ''),
                timestamp: toIsoString(
                    pickDefined(normalizedOverrides.timestamp, incomingMessage.timestamp, existingMessage.timestamp, new Date().toISOString()),
                ),
                status: toText(pickDefined(normalizedOverrides.status, incomingMessage.status, existingMessage.status), 'pending'),
                interpretation: toObject(
                    pickDefined(normalizedOverrides.interpretation, incomingMessage.interpretation, existingMessage.interpretation),
                ),
                isSystemNotification: toBoolean(
                    pickDefined(
                        normalizedOverrides.isSystemNotification,
                        incomingMessage.isSystemNotification,
                        existingMessage.isSystemNotification,
                    ),
                ),
            };

            if (existingIndex >= 0) {
                messages[existingIndex] = normalizedMessage;
            } else {
                messages.push(normalizedMessage);
            }

            return {
                snapshot: { ...sourceSnapshot, messages: messages },
                message: normalizedMessage,
                existingMessage: existingMessage,
            };
        };

        if (!workspaceId || authWorkspaceId !== workspaceId) {
            throw new ForbiddenError('No tienes acceso a este workspace.');
        }

        if (!canPersistWorkspaceSnapshot()) {
            throw new ForbiddenError('Este perfil es de solo lectura y no puede interpretar mensajes en el workspace.');
        }

        if (!messageId) {
            throw new BadRequestError('Necesitas indicar el messageId que vas a interpretar.');
        }

        let snapshotRecord = findSnapshotByWorkspace(workspaceId);
        if (!snapshotRecord) {
            const collection = e.app.findCollectionByNameOrId('fideo_state_snapshots');
            snapshotRecord = new Record(collection);
            snapshotRecord.set('workspace', workspaceId);
            snapshotRecord.set('version', 1);
        }

        const currentVersion = Number(snapshotRecord.get('version') || 0);
        if (expectedVersion && currentVersion && expectedVersion < currentVersion) {
            return e.json(409, {
                message: 'El snapshot remoto ya cambio. Recarga antes de volver a interpretar.',
                version: currentVersion,
                snapshotRecordId: snapshotRecord.id,
            });
        }

        const storedSnapshot = toObject(snapshotRecord.get('snapshot'));
        const workingBaseSnapshot = Object.keys(toObject(snapshot)).length > 0 ? snapshot : storedSnapshot;
        let workingSnapshot = backfillCustomerRefsInSnapshot(cloneValue(workingBaseSnapshot, {}));
        const preparedMessageState = upsertMessageOnSnapshot(workingSnapshot);
        workingSnapshot = preparedMessageState.snapshot;

        if (!toText(preparedMessageState.message.text, '').trim()) {
            throw new BadRequestError('Necesitas enviar el texto del mensaje que vas a interpretar.');
        }

        const existingInterpretation = toObject(preparedMessageState.existingMessage.interpretation);
        const existingStatus = toText(preparedMessageState.existingMessage.status, '');
        if (existingStatus === 'approved') {
            return e.json(200, {
                version: currentVersion || 1,
                snapshotRecordId: snapshotRecord.id,
                updatedAt: new Date().toISOString(),
                snapshot: workingSnapshot,
                message: preparedMessageState.message,
                interpretation: preparedMessageState.message.interpretation || null,
                meta: {
                    provider: 'snapshot',
                    mode: 'already_approved',
                    model: null,
                    apiKeyEnv: null,
                    usedGoogleMaps: false,
                    error: null,
                },
            });
        }

        if (
            !forceInterpretation &&
            toText(existingInterpretation.type, '') &&
            existingStatus === 'interpreted' &&
            toText(preparedMessageState.existingMessage.text, '') === toText(preparedMessageState.message.text, '')
        ) {
            return e.json(200, {
                version: currentVersion || 1,
                snapshotRecordId: snapshotRecord.id,
                updatedAt: new Date().toISOString(),
                snapshot: workingSnapshot,
                message: preparedMessageState.message,
                interpretation: preparedMessageState.message.interpretation || null,
                meta: {
                    provider: 'snapshot',
                    mode: 'already_interpreted',
                    model: null,
                    apiKeyEnv: null,
                    usedGoogleMaps: false,
                    error: null,
                },
            });
        }

        const systemPrompt = toText(workingSnapshot.systemPrompt, toText(storedSnapshot.systemPrompt, ''));
        const interpretationResult = requestGeminiInterpretation(
            toText(preparedMessageState.message.text, ''),
            toText(preparedMessageState.message.sender, 'Sistema'),
            systemPrompt,
        );
        const interpretedMessageState = upsertMessageOnSnapshot(workingSnapshot, {
            status: 'interpreted',
            interpretation: interpretationResult.interpretation,
        });
        const finalSnapshot = backfillCustomerRefsInSnapshot(interpretedMessageState.snapshot);

        snapshotRecord.set('snapshot', finalSnapshot);
        snapshotRecord.set('version', currentVersion > 0 ? currentVersion + 1 : 1);
        snapshotRecord.set('updatedBy', authRecord.id);
        e.app.save(snapshotRecord);

        writeActionLog(workspaceId, authRecord.id, 'interpret_message', {
            messageId: messageId,
            interpretationType: toText(interpretationResult.interpretation.type, 'DESCONOCIDO'),
            provider: toText(interpretationResult.meta.provider, ''),
            mode: toText(interpretationResult.meta.mode, ''),
            model: toText(interpretationResult.meta.model, ''),
            apiKeyEnv: toText(interpretationResult.meta.apiKeyEnv, ''),
            usedGoogleMaps: !!interpretationResult.meta.usedGoogleMaps,
            error: toText(interpretationResult.meta.error, ''),
            version: snapshotRecord.get('version'),
        });

        return e.json(200, {
            version: snapshotRecord.get('version'),
            snapshotRecordId: snapshotRecord.id,
            updatedAt: new Date().toISOString(),
            snapshot: finalSnapshot,
            message: interpretedMessageState.message,
            interpretation: interpretedMessageState.message.interpretation || null,
            meta: interpretationResult.meta,
        });
    },
    $apis.requireAuth('fideo_users'),
);

routerAdd(
    'POST',
    '/api/fideo/messages/approve',
    (e) => {
        const authRecord = e.auth || e.requestInfo().auth;
        if (!authRecord) {
            throw new UnauthorizedError('Necesitas autenticarte para aprobar acciones de Fideo.');
        }

        const body = e.requestInfo().body || {};
        const workspaceId = body.workspaceId || '';
        const expectedVersion = Number(body.expectedVersion || 0);
        const snapshot = body.snapshot || {};
        const messageId = body.messageId || '';
        const incomingMessage = body.message || {};
        const authWorkspaceId = authRecord.get('workspace') || '';

        const toArray = (value) => {
            if (Array.isArray(value)) {
                return value;
            }
            if (value !== undefined && value !== null && String(value).trim()) {
                try {
                    const parsed = JSON.parse(String(value));
                    return Array.isArray(parsed) ? parsed : [];
                } catch (_) {
                    return [];
                }
            }
            return [];
        };
        const toObject = (value) => {
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                try {
                    const normalized = JSON.parse(JSON.stringify(value));
                    return normalized && typeof normalized === 'object' && !Array.isArray(normalized) ? normalized : {};
                } catch (_) {
                    return value;
                }
            }
            if (value !== undefined && value !== null && String(value).trim()) {
                try {
                    const parsed = JSON.parse(String(value));
                    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
                } catch (_) {
                    return {};
                }
            }
            return {};
        };
        const toText = (value, fallback) => (value === undefined || value === null || value === '' ? (fallback || '') : String(value));
        const toNumber = (value, fallback) => {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : fallback;
        };
        const toBoolean = (value) => value === true || value === 'true' || value === 1;
        const toIsoString = (value) => {
            if (!value) return '';
            if (typeof value === 'string') return value;
            try {
                return new Date(value).toISOString();
            } catch (_) {
                return '';
            }
        };
        const cloneValue = (value, fallback) => JSON.parse(JSON.stringify(value === undefined ? fallback : value));
        const canPersistWorkspaceSnapshot = () => {
            const role = toText(authRecord.get('role'), 'Admin');
            return !!authRecord.get('canSwitchRoles') || ['Admin', 'Empacador', 'Repartidor', 'Cajero'].indexOf(role) >= 0;
        };
        const findSnapshotByWorkspace = (targetWorkspaceId) => {
            try {
                return e.app.findFirstRecordByData('fideo_state_snapshots', 'workspace', targetWorkspaceId);
            } catch (_) {
                return null;
            }
        };
        const writeActionLog = (targetWorkspaceId, actorId, action, payload) => {
            const collection = e.app.findCollectionByNameOrId('fideo_action_logs');
            const record = new Record(collection);
            record.set('workspace', targetWorkspaceId);
            record.set('actor', actorId || '');
            record.set('action', action);
            record.set('payload', payload || {});
            e.app.save(record);
            return record;
        };
        const backfillCustomerRefsInSnapshot = (sourceSnapshot) => {
            const normalized = Object.assign({}, toObject(sourceSnapshot));
            const customers = toArray(normalized.customers);
            const uniqueCustomersByName = {};
            const duplicateNames = {};

            customers.forEach((customer) => {
                const name = toText(customer && customer.name, '');
                if (!name) return;
                if (uniqueCustomersByName[name]) {
                    duplicateNames[name] = true;
                    return;
                }
                uniqueCustomersByName[name] = customer;
            });

            Object.keys(duplicateNames).forEach((name) => {
                delete uniqueCustomersByName[name];
            });

            normalized.sales = toArray(normalized.sales).map((item) => {
                const customerId = toText(item && item.customerId, '');
                if (customerId) return item;
                const customer = uniqueCustomersByName[toText(item && item.customer, '')];
                if (!customer) return item;
                return Object.assign({}, item, { customerId: toText(customer.id, '') });
            });

            normalized.crateLoans = toArray(normalized.crateLoans).map((item) => {
                const customerId = toText(item && item.customerId, '');
                if (customerId) return item;
                const customer = uniqueCustomersByName[toText(item && item.customer, '')];
                if (!customer) return item;
                return Object.assign({}, item, { customerId: toText(customer.id, '') });
            });

            return normalized;
        };
        const buildPriceKey = (item) => [
            toText(item.varietyId, ''),
            toText(item.size, ''),
            toText(item.quality, ''),
            toText(item.state, ''),
        ].join('::');
        const getWorkspaceRecords = (collectionName, targetWorkspaceId) =>
            e.app.findRecordsByFilter(collectionName, "workspace = '" + targetWorkspaceId + "'", '', 2000, 0);
        const replaceWorkspaceCollectionByExternalId = (collectionName, targetWorkspaceId, items, assignRecord) => {
            const collection = e.app.findCollectionByNameOrId(collectionName);
            const existingRecords = getWorkspaceRecords(collectionName, targetWorkspaceId);
            const existingByExternalId = {};
            existingRecords.forEach((record) => {
                existingByExternalId[toText(record.get('externalId'), '')] = record;
            });

            const seen = {};
            toArray(items).forEach((item) => {
                const externalId = toText(item && item.id, '');
                if (!externalId) return;

                seen[externalId] = true;
                const record = existingByExternalId[externalId] || new Record(collection);
                record.set('workspace', targetWorkspaceId);
                record.set('externalId', externalId);
                assignRecord(record, item || {});
                e.app.save(record);
            });

            existingRecords.forEach((record) => {
                const externalId = toText(record.get('externalId'), '');
                if (!seen[externalId]) {
                    e.app.delete(record);
                }
            });
        };
        const replaceWorkspacePriceCollection = (targetWorkspaceId, items) => {
            const collectionName = 'fideo_prices';
            const collection = e.app.findCollectionByNameOrId(collectionName);
            const existingRecords = getWorkspaceRecords(collectionName, targetWorkspaceId);
            const existingByKey = {};
            existingRecords.forEach((record) => {
                existingByKey[buildPriceKey({
                    varietyId: record.get('varietyId'),
                    size: record.get('size'),
                    quality: record.get('quality'),
                    state: record.get('state'),
                })] = record;
            });

            const seen = {};
            toArray(items).forEach((item) => {
                const key = buildPriceKey(item || {});
                if (!key.replace(/:/g, '')) return;

                seen[key] = true;
                const record = existingByKey[key] || new Record(collection);
                record.set('workspace', targetWorkspaceId);
                record.set('varietyId', toText(item.varietyId, ''));
                record.set('size', toText(item.size, ''));
                record.set('quality', toText(item.quality, ''));
                record.set('state', toText(item.state, ''));
                record.set('price', toNumber(item.price, 0));
                e.app.save(record);
            });

            existingRecords.forEach((record) => {
                const key = buildPriceKey({
                    varietyId: record.get('varietyId'),
                    size: record.get('size'),
                    quality: record.get('quality'),
                    state: record.get('state'),
                });
                if (!seen[key]) {
                    e.app.delete(record);
                }
            });
        };
        const normalizeTaskAssignmentsForSync = (items) =>
            toArray(items)
                .map((item) => {
                    const normalizedItem = toObject(item);
                    const fallbackId = [toText(normalizedItem.taskId, ''), toText(normalizedItem.employeeId, '')]
                        .filter((value) => !!value)
                        .join('::');
                    const externalId = toText(normalizedItem.id, fallbackId);
                    return externalId ? Object.assign({}, normalizedItem, { id: externalId }) : null;
                })
                .filter((item) => !!item);
        const normalizeTaskReportsForSync = (items) =>
            toArray(items)
                .map((item) => {
                    const normalizedItem = toObject(item);
                    const fallbackId = [
                        toText(normalizedItem.taskId, ''),
                        toText(normalizedItem.createdAt, ''),
                        toText(normalizedItem.kind, ''),
                        toText(normalizedItem.employeeId, ''),
                    ]
                        .filter((value) => !!value)
                        .join('::');
                    const externalId = toText(normalizedItem.id, fallbackId);
                    return externalId ? Object.assign({}, normalizedItem, { id: externalId }) : null;
                })
                .filter((item) => !!item);
        const syncTouchedCollections = (targetWorkspaceId, sourceSnapshot, touchedCollections) => {
            if (touchedCollections.sales) {
                replaceWorkspaceCollectionByExternalId('fideo_sales', targetWorkspaceId, sourceSnapshot.sales, (record, item) => {
                    record.set('productGroupId', toText(item.productGroupId, ''));
                    record.set('varietyId', toText(item.varietyId, ''));
                    record.set('customerId', toText(item.customerId, ''));
                    record.set('productGroupName', toText(item.productGroupName, ''));
                    record.set('varietyName', toText(item.varietyName, ''));
                    record.set('size', toText(item.size, ''));
                    record.set('quality', toText(item.quality, ''));
                    record.set('state', toText(item.state, ''));
                    record.set('quantity', toNumber(item.quantity, 0));
                    record.set('price', toNumber(item.price, 0));
                    record.set('cogs', toNumber(item.cogs, 0));
                    record.set('unit', toText(item.unit, ''));
                    record.set('customer', toText(item.customer, ''));
                    record.set('destination', toText(item.destination, ''));
                    record.set('locationQuery', toText(item.locationQuery, ''));
                    record.set('status', toText(item.status, 'Pendiente de Empaque'));
                    record.set('paymentStatus', toText(item.paymentStatus, 'Pendiente'));
                    record.set('paymentMethod', toText(item.paymentMethod, 'N/A'));
                    record.set('paymentNotes', toText(item.paymentNotes, ''));
                    record.set('assignedEmployeeId', toText(item.assignedEmployeeId, ''));
                    record.set('timestamp', toIsoString(item.timestamp));
                    record.set('deliveryDeadline', toIsoString(item.deliveryDeadline));
                });
            }

            if (touchedCollections.inventory) {
                replaceWorkspaceCollectionByExternalId('fideo_inventory_batches', targetWorkspaceId, sourceSnapshot.inventory, (record, item) => {
                    record.set('varietyId', toText(item.varietyId, ''));
                    record.set('size', toText(item.size, ''));
                    record.set('quality', toText(item.quality, ''));
                    record.set('quantity', toNumber(item.quantity, 0));
                    record.set('state', toText(item.state, ''));
                    record.set('location', toText(item.location, ''));
                    record.set('warehouseId', toText(item.warehouseId, ''));
                    record.set('packagingId', toText(item.packagingId, ''));
                    record.set('entryDate', toIsoString(item.entryDate));
                });
            }

            if (touchedCollections.payments) {
                replaceWorkspaceCollectionByExternalId('fideo_payments', targetWorkspaceId, sourceSnapshot.payments, (record, item) => {
                    record.set('customerId', toText(item.customerId, ''));
                    record.set('amount', toNumber(item.amount, 0));
                    record.set('date', toIsoString(item.date));
                    record.set('saleId', toText(item.saleId, ''));
                });
            }

            if (touchedCollections.purchaseOrders) {
                replaceWorkspaceCollectionByExternalId('fideo_purchase_orders', targetWorkspaceId, sourceSnapshot.purchaseOrders, (record, item) => {
                    record.set('supplierId', toText(item.supplierId, ''));
                    record.set('varietyId', toText(item.varietyId, ''));
                    record.set('size', toText(item.size, ''));
                    record.set('packaging', toText(item.packaging, ''));
                    record.set('quantity', toNumber(item.quantity, 0));
                    record.set('totalCost', toNumber(item.totalCost, 0));
                    record.set('status', toText(item.status, 'Pendiente'));
                    record.set('orderDate', toIsoString(item.orderDate));
                    record.set('expectedArrivalDate', toIsoString(item.expectedArrivalDate));
                    record.set('paymentMethod', toText(item.paymentMethod, 'N/A'));
                });
            }

            if (touchedCollections.prices) {
                replaceWorkspacePriceCollection(targetWorkspaceId, sourceSnapshot.prices);
            }

            if (touchedCollections.crateLoans) {
                replaceWorkspaceCollectionByExternalId('fideo_crate_loans', targetWorkspaceId, sourceSnapshot.crateLoans, (record, item) => {
                    record.set('customerId', toText(item.customerId, ''));
                    record.set('customer', toText(item.customer, ''));
                    record.set('crateTypeId', toText(item.crateTypeId, ''));
                    record.set('quantity', toNumber(item.quantity, 0));
                    record.set('timestamp', toIsoString(item.timestamp));
                    record.set('dueDate', toIsoString(item.dueDate));
                    record.set('status', toText(item.status, 'Prestado'));
                });
            }

            if (touchedCollections.activities) {
                replaceWorkspaceCollectionByExternalId('fideo_employee_activities', targetWorkspaceId, sourceSnapshot.activities, (record, item) => {
                    record.set('employee', toText(item.employee, ''));
                    record.set('activity', toText(item.activity, ''));
                    record.set('timestamp', toIsoString(item.timestamp));
                });
            }

            if (touchedCollections.activityLog) {
                replaceWorkspaceCollectionByExternalId('fideo_activity_logs', targetWorkspaceId, sourceSnapshot.activityLog, (record, item) => {
                    const details = toObject(item.details);
                    record.set('type', toText(item.type, 'NAVEGACION'));
                    record.set('timestamp', toIsoString(item.timestamp));
                    record.set('description', toText(item.description, ''));
                    record.set('details', Object.keys(details).length > 0 ? details : null);
                });
            }

            if (touchedCollections.cashDrawers) {
                replaceWorkspaceCollectionByExternalId('fideo_cash_drawers', targetWorkspaceId, sourceSnapshot.cashDrawers, (record, item) => {
                    record.set('name', toText(item.name, ''));
                    record.set('balance', toNumber(item.balance, 0));
                    record.set('status', toText(item.status, 'Cerrada'));
                    record.set('lastOpened', toIsoString(item.lastOpened));
                    record.set('lastClosed', toIsoString(item.lastClosed));
                });
            }

            if (touchedCollections.cashDrawerActivities) {
                replaceWorkspaceCollectionByExternalId('fideo_cash_drawer_activities', targetWorkspaceId, sourceSnapshot.cashDrawerActivities, (record, item) => {
                    record.set('drawerId', toText(item.drawerId, ''));
                    record.set('type', toText(item.type, 'SALDO_INICIAL'));
                    record.set('amount', toNumber(item.amount, 0));
                    record.set('timestamp', toIsoString(item.timestamp));
                    record.set('notes', toText(item.notes, ''));
                    record.set('relatedId', toText(item.relatedId, ''));
                });
            }

            if (touchedCollections.taskAssignments) {
                replaceWorkspaceCollectionByExternalId('fideo_task_assignments', targetWorkspaceId, normalizeTaskAssignmentsForSync(sourceSnapshot.taskAssignments), (record, item) => {
                    const payload = toObject(item);
                    record.set('taskId', toText(item.taskId, ''));
                    record.set('employeeId', toText(item.employeeId, ''));
                    record.set('role', toText(item.role, ''));
                    record.set('status', toText(item.status, 'assigned'));
                    record.set('assignedAt', toIsoString(item.assignedAt));
                    record.set('acknowledgedAt', toIsoString(item.acknowledgedAt));
                    record.set('startedAt', toIsoString(item.startedAt));
                    record.set('blockedAt', toIsoString(item.blockedAt));
                    record.set('doneAt', toIsoString(item.doneAt));
                    record.set('blockedReason', toText(item.blockedReason, ''));
                    record.set('payload', Object.keys(payload).length > 0 ? payload : null);
                });
            }

            if (touchedCollections.taskReports) {
                replaceWorkspaceCollectionByExternalId('fideo_task_reports', targetWorkspaceId, normalizeTaskReportsForSync(sourceSnapshot.taskReports), (record, item) => {
                    const payload = toObject(item);
                    record.set('taskId', toText(item.taskId, ''));
                    record.set('saleId', toText(item.saleId, ''));
                    record.set('role', toText(item.role, ''));
                    record.set('employeeId', toText(item.employeeId, ''));
                    record.set('employeeName', toText(item.employeeName, ''));
                    record.set('customerId', toText(item.customerId, ''));
                    record.set('customerName', toText(item.customerName, ''));
                    record.set('taskTitle', toText(item.taskTitle, ''));
                    record.set('kind', toText(item.kind, 'note'));
                    record.set('status', toText(item.status, 'resolved'));
                    record.set('severity', toText(item.severity, 'normal'));
                    record.set('summary', toText(item.summary, ''));
                    record.set('detail', toText(item.detail, ''));
                    record.set('evidence', toText(item.evidence, ''));
                    record.set('escalationStatus', toText(item.escalationStatus, 'none'));
                    record.set('createdAt', toIsoString(item.createdAt));
                    record.set('resolvedAt', toIsoString(item.resolvedAt));
                    record.set('escalatedAt', toIsoString(item.escalatedAt));
                    record.set('payload', Object.keys(payload).length > 0 ? payload : null);
                });
            }
        };
        const createActionResult = (nextState, notification) => ({ nextState, notification: notification || null });
        const findVarietyInState = (currentState, productGroupQuery, varietyQuery) => {
            const normalizedGroupQuery = toText(productGroupQuery, '').toLowerCase();
            const normalizedVarietyQuery = toText(varietyQuery, '').toLowerCase();
            const group = toArray(currentState.productGroups).find(
                (item) => !item.archived && toText(item.name, '').toLowerCase().indexOf(normalizedGroupQuery) >= 0,
            );
            if (!group) return null;
            const variety = toArray(group.varieties).find(
                (item) =>
                    !item.archived &&
                    (
                        toText(item.name, '').toLowerCase().indexOf(normalizedVarietyQuery) >= 0 ||
                        toArray(item.aliases).some((alias) => normalizedVarietyQuery.indexOf(toText(alias, '').toLowerCase()) >= 0)
                    ),
            );
            return variety ? { group: group, variety: variety } : null;
        };
        const addPayment = (currentState, customerId, amount, saleId) => {
            const paymentId = 'pay_' + Date.now();
            const nowIso = new Date().toISOString();
            const customer = toArray(currentState.customers).find((item) => item.id === customerId);
            const newPayment = { id: paymentId, customerId: customerId, amount: amount, date: nowIso, saleId: saleId || '' };
            const newLog = {
                id: 'log_pay_' + Date.now(),
                type: 'PAYMENT_CRUD',
                timestamp: nowIso,
                description: 'Abono registrado de ' + toText(customer && customer.name, 'N/A'),
                details: { Monto: amount },
            };
            return {
                ...currentState,
                payments: [newPayment].concat(toArray(currentState.payments)),
                activityLog: [newLog].concat(toArray(currentState.activityLog)),
            };
        };
        const addSaleAction = (currentState, interpretation) => {
            const saleData = toObject(interpretation.data);
            const productInfo = findVarietyInState(currentState, saleData.productGroup, saleData.variety);
            const customerInfo = toArray(currentState.customers).find((item) => toText(item.name, '') === toText(saleData.customer, ''));

            if (!customerInfo) {
                return createActionResult(currentState, { text: 'Cliente no encontrado: ' + toText(saleData.customer, ''), isError: true });
            }

            if (toText(customerInfo.creditStatus, '') === 'Contado Solamente' && saleData.suggestedPayment === undefined) {
                const newLog = {
                    id: 'log_credit_reject_' + Date.now(),
                    type: 'CREDIT_REJECTED',
                    timestamp: new Date().toISOString(),
                    description: 'Venta a crÃ©dito rechazada para ' + toText(customerInfo.name, ''),
                    details: { Motivo: 'Cliente configurado para solo contado.' },
                };
                return createActionResult(
                    { ...currentState, activityLog: [newLog].concat(toArray(currentState.activityLog)) },
                    { text: 'Venta a crÃ©dito rechazada. ' + toText(customerInfo.name, '') + ' es cliente de solo contado.', isError: true },
                );
            }

            if (!productInfo) {
                return createActionResult(
                    currentState,
                    { text: 'Producto no encontrado: ' + toText(saleData.productGroup, '') + ' ' + toText(saleData.variety, ''), isError: true },
                );
            }

            const quality = toText(saleData.quality, 'Normal');
            const specialPriceInfo = toArray(customerInfo.specialPrices).find(
                (item) =>
                    toText(item.varietyId, '') === toText(productInfo.variety.id, '') &&
                    toText(item.size, '') === toText(saleData.size, '') &&
                    toText(item.quality, '') === quality &&
                    toText(item.state, '') === toText(saleData.state, ''),
            );
            const regularPriceRecord = toArray(currentState.prices).find(
                (item) =>
                    toText(item.varietyId, '') === toText(productInfo.variety.id, '') &&
                    toText(item.size, '') === toText(saleData.size, '') &&
                    toText(item.quality, '') === quality &&
                    toText(item.state, '') === toText(saleData.state, ''),
            );
            const finalPricePerUnit = specialPriceInfo ? toNumber(specialPriceInfo.price, undefined) : toNumber(regularPriceRecord && regularPriceRecord.price, undefined);

            if (finalPricePerUnit === undefined) {
                return createActionResult(
                    currentState,
                    {
                        text:
                            'Precio no encontrado para ' +
                            toText(productInfo.group.name, '') +
                            ' ' +
                            toText(productInfo.variety.name, '') +
                            ' ' +
                            toText(saleData.size, '') +
                            ' ' +
                            quality +
                            ' ' +
                            toText(saleData.state, ''),
                        isError: true,
                    },
                );
            }

            const totalAvailable = toArray(currentState.inventory)
                .filter(
                    (item) =>
                        toText(item.varietyId, '') === toText(productInfo.variety.id, '') &&
                        toText(item.size, '') === toText(saleData.size, '') &&
                        toText(item.quality, '') === quality &&
                        toText(item.state, '') === toText(saleData.state, ''),
                )
                .reduce((sum, item) => sum + toNumber(item.quantity, 0), 0);

            if (totalAvailable < toNumber(saleData.quantity, 0)) {
                return createActionResult(
                    currentState,
                    {
                        text: 'Stock insuficiente. Requerido: ' + toNumber(saleData.quantity, 0) + ', Disponible: ' + totalAvailable,
                        isError: true,
                    },
                );
            }

            let nextState = cloneValue(currentState, {});
            if (toNumber(saleData.suggestedPayment, 0) > 0) {
                nextState = addPayment(nextState, customerInfo.id, toNumber(saleData.suggestedPayment, 0));
            }

            let cogsPerUnit = 0;
            const supplierInfo = toArray(nextState.suppliers).find((supplier) =>
                toArray(supplier.supplies).some((supply) => toText(supply.varietyId, '') === toText(productInfo.variety.id, '')),
            );
            if (supplierInfo) {
                const suppliedProduct = toArray(supplierInfo.supplies).find((supply) => toText(supply.varietyId, '') === toText(productInfo.variety.id, ''));
                if (suppliedProduct) {
                    const packagingOptions = toArray(suppliedProduct.packagingOptions);
                    const avgPackagingCost =
                        packagingOptions.reduce((sum, item) => sum + toNumber(item.cost, 0), 0) /
                        (packagingOptions.length || 1);
                    cogsPerUnit = toNumber(suppliedProduct.baseCost, 0) + toNumber(suppliedProduct.freightCost, 0) + avgPackagingCost;
                }
            }
            if (cogsPerUnit === 0) {
                cogsPerUnit = finalPricePerUnit * 0.7;
            }

            const now = new Date();
            const nowIso = now.toISOString();
            const deliveryDeadlineIso = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();
            const paymentMethod = toText(customerInfo.creditStatus, '') === 'Contado Solamente' ? 'Efectivo' : 'CrÃ©dito';

            const newSale = {
                id: 's_' + Date.now(),
                productGroupId: productInfo.group.id,
                varietyId: productInfo.variety.id,
                customerId: customerInfo.id,
                productGroupName: toText(productInfo.group.name, ''),
                varietyName: toText(productInfo.variety.name, ''),
                size: toText(saleData.size, ''),
                quality: quality,
                state: toText(saleData.state, ''),
                quantity: toNumber(saleData.quantity, 0),
                price: finalPricePerUnit * toNumber(saleData.quantity, 0),
                cogs: cogsPerUnit * toNumber(saleData.quantity, 0),
                unit: toText(saleData.unit, ''),
                customer: toText(saleData.customer, ''),
                destination: toText(saleData.destination, 'Sin destino'),
                locationQuery: toText(saleData.locationQuery, ''),
                status: 'Pendiente de Empaque',
                paymentStatus: paymentMethod === 'Efectivo' ? 'Pagado' : 'Pendiente',
                paymentMethod: paymentMethod,
                timestamp: nowIso,
                deliveryDeadline: deliveryDeadlineIso,
            };

            let quantityToDecrement = toNumber(saleData.quantity, 0);
            const updatedInventory = cloneValue(nextState.inventory, []);
            const availableBatches = toArray(updatedInventory)
                .filter(
                    (item) =>
                        toText(item.varietyId, '') === toText(productInfo.variety.id, '') &&
                        toText(item.size, '') === toText(saleData.size, '') &&
                        toText(item.quality, '') === quality &&
                        toText(item.state, '') === toText(saleData.state, ''),
                )
                .sort((left, right) => (Date.parse(toText(left.entryDate, '')) || 0) - (Date.parse(toText(right.entryDate, '')) || 0));

            availableBatches.forEach((batch) => {
                if (quantityToDecrement <= 0) return;
                const decrementAmount = Math.min(quantityToDecrement, toNumber(batch.quantity, 0));
                batch.quantity = toNumber(batch.quantity, 0) - decrementAmount;
                quantityToDecrement -= decrementAmount;
            });

            const saleLog = {
                id: 'log_sale_' + Date.now(),
                type: 'VENTA',
                timestamp: nowIso,
                description: 'Venta a ' + toText(newSale.customer, ''),
                details: {
                    Producto: toText(newSale.productGroupName, '') + ' ' + toText(newSale.varietyName, '') + ' ' + toText(newSale.size, ''),
                    Cantidad: toNumber(newSale.quantity, 0),
                    Total: toNumber(newSale.price, 0),
                },
            };
            const ticketLog = {
                id: 'log_ticket_' + Date.now(),
                type: 'TICKET_ENVIADO',
                timestamp: nowIso,
                description: 'Ticket de venta enviado a ' + toText(newSale.customer, ''),
                details: { Cliente: toText(newSale.customer, ''), Monto: toNumber(newSale.price, 0) },
            };

            let finalState = {
                ...nextState,
                sales: [newSale].concat(toArray(nextState.sales)),
                inventory: toArray(updatedInventory).filter((item) => toNumber(item.quantity, 0) > 0),
                activityLog: [ticketLog, saleLog].concat(toArray(nextState.activityLog)),
            };
            let notification = null;

            if (newSale.paymentMethod === 'Efectivo') {
                const openDrawer = toArray(finalState.cashDrawers).find((item) => toText(item.status, '') === 'Abierta');
                if (openDrawer) {
                    const cashActivity = {
                        id: 'cda_' + Date.now(),
                        drawerId: openDrawer.id,
                        type: 'INGRESO_VENTA',
                        amount: toNumber(newSale.price, 0),
                        timestamp: nowIso,
                        relatedId: newSale.id,
                        notes: 'Venta a ' + toText(newSale.customer, ''),
                    };
                    finalState = {
                        ...finalState,
                        cashDrawerActivities: [cashActivity].concat(toArray(finalState.cashDrawerActivities)),
                        cashDrawers: toArray(finalState.cashDrawers).map((item) =>
                            item.id === openDrawer.id ? { ...item, balance: toNumber(item.balance, 0) + toNumber(newSale.price, 0) } : item,
                        ),
                    };
                } else {
                    notification = {
                        text: 'Venta en efectivo a ' + toText(newSale.customer, '') + ' no se pudo registrar en caja porque estÃ¡ cerrada.',
                        isError: true,
                    };
                }
            }

            return createActionResult(finalState, notification);
        };
        const addFixedAssetSaleAction = (currentState, interpretation) => {
            const data = toObject(interpretation.data);
            const customer = toArray(currentState.customers).find((item) => toText(item.name, '') === toText(data.customer, ''));
            if (!customer) {
                return createActionResult(currentState, { text: 'Cliente no encontrado: ' + toText(data.customer, ''), isError: true });
            }

            const crateType = toArray(currentState.crateTypes).find((item) => toText(item.name, '').toLowerCase() === toText(data.assetName, '').toLowerCase());
            if (!crateType) {
                return createActionResult(currentState, { text: 'Tipo de caja no encontrado: ' + toText(data.assetName, ''), isError: true });
            }

            const crateInventoryItem = toArray(currentState.crateInventory).find((item) => toText(item.crateTypeId, '') === toText(crateType.id, ''));
            const currentQuantity = crateInventoryItem ? toNumber(crateInventoryItem.quantityOwned, 0) : 0;
            if (currentQuantity < toNumber(data.quantity, 0)) {
                return createActionResult(currentState, { text: 'Stock de activo insuficiente: ' + toText(crateType.name, ''), isError: true });
            }

            const totalCost = toNumber(crateType.cost, 0) * toNumber(data.quantity, 0);
            const nowIso = new Date().toISOString();
            const newSale = {
                id: 's_asset_' + Date.now(),
                productGroupId: 'asset',
                varietyId: crateType.id,
                customerId: customer.id,
                productGroupName: 'Activos',
                varietyName: toText(crateType.name, ''),
                size: toText(crateType.size, ''),
                quality: 'Normal',
                state: 'Verde',
                quantity: toNumber(data.quantity, 0),
                price: totalCost,
                cogs: 0,
                unit: 'unidades',
                customer: toText(customer.name, ''),
                destination: 'Cliente',
                status: 'Completado',
                paymentStatus: 'En Deuda',
                paymentMethod: 'CrÃ©dito',
                timestamp: nowIso,
                deliveryDeadline: nowIso,
            };

            const updatedCrateInventory = toArray(currentState.crateInventory).map((item) =>
                toText(item.crateTypeId, '') === toText(crateType.id, '')
                    ? { ...item, quantityOwned: toNumber(item.quantityOwned, 0) - toNumber(data.quantity, 0) }
                    : item,
            );
            const newLog = {
                id: 'log_asset_sale_' + Date.now(),
                type: 'VENTA_ACTIVO_CRUD',
                timestamp: nowIso,
                description: 'Venta de activo a ' + toText(customer.name, ''),
                details: { Activo: toText(crateType.name, ''), Cantidad: toNumber(data.quantity, 0), Total: totalCost },
            };

            return createActionResult({
                ...currentState,
                sales: [newSale].concat(toArray(currentState.sales)),
                crateInventory: updatedCrateInventory,
                activityLog: [newLog].concat(toArray(currentState.activityLog)),
            });
        };
        const addPurchaseOrderAction = (currentState, interpretation) => {
            const data = toObject(interpretation.data);
            const supplier = toArray(currentState.suppliers).find((item) => toText(item.name, '') === toText(data.supplierName, ''));
            const productInfo = findVarietyInState(currentState, data.productGroup, data.variety);

            if (!supplier || !productInfo) {
                return createActionResult(currentState, { text: 'Proveedor o producto no encontrado para la orden de compra', isError: true });
            }

            const suppliedProduct = toArray(supplier.supplies).find((item) => toText(item.varietyId, '') === toText(productInfo.variety.id, ''));
            if (!suppliedProduct) {
                return createActionResult(
                    currentState,
                    { text: 'El proveedor ' + toText(supplier.name, '') + ' no surte ' + toText(productInfo.group.name, '') + ' ' + toText(productInfo.variety.name, ''), isError: true },
                );
            }

            const packaging = toArray(suppliedProduct.packagingOptions).find((item) => toText(item.name, '') === toText(data.packaging, ''));
            if (!packaging) {
                return createActionResult(currentState, { text: 'Empaque no encontrado: ' + toText(data.packaging, ''), isError: true });
            }

            const totalCost =
                (toNumber(suppliedProduct.baseCost, 0) + toNumber(suppliedProduct.freightCost, 0) + toNumber(packaging.cost, 0)) *
                toNumber(data.quantity, 0);
            const nowIso = new Date().toISOString();
            const newOrder = {
                id: 'po_' + Date.now(),
                supplierId: supplier.id,
                varietyId: productInfo.variety.id,
                size: toText(data.size, ''),
                packaging: toText(data.packaging, ''),
                quantity: toNumber(data.quantity, 0),
                totalCost: totalCost,
                status: 'Pendiente',
                orderDate: nowIso,
                paymentMethod: 'CrÃ©dito',
            };
            const newLog = {
                id: 'log_po_' + Date.now(),
                type: 'ORDEN_COMPRA_CRUD',
                timestamp: nowIso,
                description: 'Orden de compra creada para ' + toText(supplier.name, ''),
                details: {
                    Producto: toText(productInfo.group.name, '') + ' ' + toText(productInfo.variety.name, ''),
                    Cantidad: toNumber(data.quantity, 0) + ' ' + toText(data.packaging, ''),
                    Costo: totalCost,
                },
            };
            return createActionResult({
                ...currentState,
                purchaseOrders: [newOrder].concat(toArray(currentState.purchaseOrders)),
                activityLog: [newLog].concat(toArray(currentState.activityLog)),
            });
        };
        const updatePriceAction = (currentState, interpretation) => {
            const data = toObject(interpretation.data);
            const productInfo = findVarietyInState(currentState, data.productGroup, data.variety);
            if (!productInfo) {
                return createActionResult(
                    currentState,
                    { text: 'Producto no encontrado para actualizar precio: ' + toText(data.productGroup, '') + ' ' + toText(data.variety, ''), isError: true },
                );
            }

            const newPrices = cloneValue(currentState.prices, []);
            const existingIndex = newPrices.findIndex(
                (item) =>
                    toText(item.varietyId, '') === toText(productInfo.variety.id, '') &&
                    toText(item.size, '') === toText(data.size, '') &&
                    toText(item.quality, '') === toText(data.quality, '') &&
                    toText(item.state, '') === toText(data.state, ''),
            );

            if (existingIndex >= 0) {
                newPrices[existingIndex] = { ...newPrices[existingIndex], price: toNumber(data.price, 0) };
            } else {
                newPrices.push({
                    varietyId: productInfo.variety.id,
                    size: toText(data.size, ''),
                    quality: toText(data.quality, ''),
                    state: toText(data.state, ''),
                    price: toNumber(data.price, 0),
                });
            }

            const newLog = {
                id: 'log_' + Date.now(),
                type: 'ACTUALIZACION_PRECIO',
                timestamp: new Date().toISOString(),
                description: 'Precio actualizado para ' + toText(productInfo.group.name, '') + ' ' + toText(productInfo.variety.name, ''),
                details: {
                    Tamano: toText(data.size, ''),
                    Calidad: toText(data.quality, ''),
                    Estado: toText(data.state, ''),
                    NuevoPrecio: toNumber(data.price, 0),
                },
            };

            return createActionResult({ ...currentState, prices: newPrices, activityLog: [newLog].concat(toArray(currentState.activityLog)) });
        };
        const changeProductStateAction = (currentState, interpretation) => {
            const data = toObject(interpretation.data);
            const productInfo = findVarietyInState(currentState, data.productGroup, data.variety);
            if (!productInfo) return currentState;

            const fromWarehouse =
                toArray(currentState.warehouses).find((item) => toText(item.name, '') === 'Bodega Principal') ||
                toArray(currentState.warehouses)[0];
            if (!fromWarehouse) return currentState;

            const updatedInventory = cloneValue(currentState.inventory, []);
            const sourceBatches = toArray(updatedInventory)
                .filter(
                    (item) =>
                        toText(item.varietyId, '') === toText(productInfo.variety.id, '') &&
                        toText(item.size, '') === toText(data.size, '') &&
                        toText(item.quality, '') === toText(data.quality, '') &&
                        toText(item.state, '') === toText(data.fromState, '') &&
                        toText(item.warehouseId, '') === toText(fromWarehouse.id, ''),
                )
                .sort((left, right) => (Date.parse(toText(left.entryDate, '')) || 0) - (Date.parse(toText(right.entryDate, '')) || 0));
            const totalAvailable = sourceBatches.reduce((sum, item) => sum + toNumber(item.quantity, 0), 0);
            const quantityToMove = toNumber(data.quantity, 0);

            if (totalAvailable < quantityToMove) return currentState;

            let remainingToMove = quantityToMove;
            sourceBatches.forEach((batch) => {
                if (remainingToMove <= 0) return;
                const decrementAmount = Math.min(remainingToMove, toNumber(batch.quantity, 0));
                batch.quantity = toNumber(batch.quantity, 0) - decrementAmount;
                remainingToMove -= decrementAmount;

                const toState = toText(data.toState, '');
                const newLocation = toState === 'Verde' ? 'CÃ¡mara FrÃ­a' : (toState === 'Entrado' ? 'MaduraciÃ³n' : 'Piso de Venta');
                let destinationBatch = toArray(updatedInventory).find(
                    (item) =>
                        toText(item.varietyId, '') === toText(productInfo.variety.id, '') &&
                        toText(item.size, '') === toText(data.size, '') &&
                        toText(item.quality, '') === toText(data.quality, '') &&
                        toText(item.state, '') === toState &&
                        toText(item.warehouseId, '') === toText(fromWarehouse.id, '') &&
                        toText(item.location, '') === newLocation,
                );
                if (destinationBatch) {
                    destinationBatch.quantity = toNumber(destinationBatch.quantity, 0) + decrementAmount;
                } else {
                    updatedInventory.push({
                        id: 'b_' + Date.now() + '_' + Math.round(Math.random() * 100000),
                        varietyId: productInfo.variety.id,
                        size: toText(data.size, ''),
                        quality: toText(data.quality, ''),
                        quantity: decrementAmount,
                        state: toState,
                        location: newLocation,
                        warehouseId: fromWarehouse.id,
                        entryDate: new Date().toISOString(),
                        packagingId: toText(batch.packagingId, ''),
                    });
                }
            });

            const newLog = {
                id: 'log_' + Date.now(),
                type: 'MOVIMIENTO_ESTADO',
                timestamp: new Date().toISOString(),
                description: 'Movimiento de ' + toText(productInfo.group.name, '') + ' ' + toText(productInfo.variety.name, ''),
                details: { Cantidad: quantityToMove, De: toText(data.fromState, ''), A: toText(data.toState, ''), Tamano: toText(data.size, '') },
            };

            return {
                ...currentState,
                inventory: toArray(updatedInventory).filter((item) => toNumber(item.quantity, 0) > 0),
                activityLog: [newLog].concat(toArray(currentState.activityLog)),
            };
        };
        const assignDeliveryAction = (currentState, interpretation) => {
            const data = toObject(interpretation.data);
            const employee = toArray(currentState.employees).find((item) => toText(item.name, '') === toText(data.employeeName, ''));
            if (!employee) return currentState;

            const saleToAssign = toArray(currentState.sales)
                .filter((item) => toText(item.customer, '') === toText(data.customerName, '') && toText(item.status, '') === 'Listo para Entrega')
                .sort((left, right) => (Date.parse(toText(right.timestamp, '')) || 0) - (Date.parse(toText(left.timestamp, '')) || 0))[0];
            if (!saleToAssign) return currentState;

            const newLog = {
                id: 'log_' + Date.now(),
                type: 'ASIGNACION_ENTREGA',
                timestamp: new Date().toISOString(),
                description: 'Pedido asignado a ' + toText(data.employeeName, ''),
                details: { PedidoID: toText(saleToAssign.id, '').substring(2, 8), Cliente: toText(data.customerName, ''), Repartidor: toText(data.employeeName, '') },
            };
            const newSales = toArray(currentState.sales).map((item) =>
                item.id === saleToAssign.id ? { ...item, status: 'En Ruta', assignedEmployeeId: employee.id } : item,
            );
            return { ...currentState, sales: newSales, activityLog: [newLog].concat(toArray(currentState.activityLog)) };
        };
        const transferWarehouseAction = (currentState, interpretation) => {
            const data = toObject(interpretation.data);
            const productInfo = findVarietyInState(currentState, data.productGroup, data.variety);
            if (!productInfo) return currentState;

            const fromWarehouse = toArray(currentState.warehouses).find((item) => toText(item.name, '') === toText(data.fromWarehouseName, ''));
            const toWarehouse = toArray(currentState.warehouses).find((item) => toText(item.name, '') === toText(data.toWarehouseName, ''));
            if (!fromWarehouse || !toWarehouse) return currentState;

            let quantityToTransfer = toNumber(data.quantity, 0);
            const updatedInventory = cloneValue(currentState.inventory, []);
            const sourceBatches = toArray(updatedInventory)
                .filter(
                    (item) =>
                        toText(item.varietyId, '') === toText(productInfo.variety.id, '') &&
                        toText(item.size, '') === toText(data.size, '') &&
                        toText(item.quality, '') === toText(data.quality, '') &&
                        toText(item.state, '') === toText(data.state, '') &&
                        toText(item.warehouseId, '') === toText(fromWarehouse.id, ''),
                )
                .sort((left, right) => (Date.parse(toText(left.entryDate, '')) || 0) - (Date.parse(toText(right.entryDate, '')) || 0));
            const totalAvailable = sourceBatches.reduce((sum, item) => sum + toNumber(item.quantity, 0), 0);
            if (totalAvailable < quantityToTransfer) return currentState;

            sourceBatches.forEach((batch) => {
                if (quantityToTransfer <= 0) return;
                const amountToTake = Math.min(quantityToTransfer, toNumber(batch.quantity, 0));
                batch.quantity = toNumber(batch.quantity, 0) - amountToTake;
                quantityToTransfer -= amountToTake;

                let destinationBatch = toArray(updatedInventory).find(
                    (item) =>
                        toText(item.varietyId, '') === toText(productInfo.variety.id, '') &&
                        toText(item.size, '') === toText(data.size, '') &&
                        toText(item.quality, '') === toText(data.quality, '') &&
                        toText(item.state, '') === toText(data.state, '') &&
                        toText(item.warehouseId, '') === toText(toWarehouse.id, '') &&
                        toText(item.location, '') === toText(batch.location, '') &&
                        toText(item.packagingId, '') === toText(batch.packagingId, ''),
                );
                if (destinationBatch) {
                    destinationBatch.quantity = toNumber(destinationBatch.quantity, 0) + amountToTake;
                } else {
                    updatedInventory.push({
                        id: 'b_' + Date.now() + '_' + Math.round(Math.random() * 100000),
                        varietyId: productInfo.variety.id,
                        size: toText(data.size, ''),
                        quality: toText(data.quality, ''),
                        quantity: amountToTake,
                        state: toText(data.state, ''),
                        location: toText(batch.location, ''),
                        warehouseId: toWarehouse.id,
                        entryDate: toIsoString(batch.entryDate),
                        packagingId: toText(batch.packagingId, ''),
                    });
                }
            });

            const newLog = {
                id: 'log_' + Date.now(),
                type: 'TRANSFERENCIA_BODEGA',
                timestamp: new Date().toISOString(),
                description: 'Transferencia de ' + toText(productInfo.group.name, '') + ' ' + toText(productInfo.variety.name, ''),
                details: {
                    Cantidad: toNumber(data.quantity, 0),
                    De: toText(fromWarehouse.name, ''),
                    A: toText(toWarehouse.name, ''),
                    Producto: toText(data.size, '') + ' ' + toText(data.quality, '') + ' ' + toText(data.state, ''),
                },
            };
            return {
                ...currentState,
                inventory: toArray(updatedInventory).filter((item) => toNumber(item.quantity, 0) > 0),
                activityLog: [newLog].concat(toArray(currentState.activityLog)),
            };
        };
        const addCrateLoanAction = (currentState, interpretation) => {
            const data = toObject(interpretation.data);
            const crateType = toArray(currentState.crateTypes).find((item) => toText(item.name, '').toLowerCase() === toText(data.description, '').toLowerCase());
            const customer = toArray(currentState.customers).find((item) => toText(item.name, '') === toText(data.customer, ''));
            if (!crateType) {
                return createActionResult(currentState, { text: 'Crate type not found: ' + toText(data.description, ''), isError: true });
            }

            const now = new Date();
            const dueDateIso = data.dueDate ? toIsoString(data.dueDate) : new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
            const newLoan = {
                id: 'l_' + Date.now(),
                customerId: customer ? customer.id : '',
                customer: toText(data.customer, ''),
                crateTypeId: crateType.id,
                quantity: toNumber(data.quantity, 0),
                timestamp: now.toISOString(),
                dueDate: dueDateIso,
                status: 'Prestado',
            };
            const newLog = {
                id: 'log_' + Date.now(),
                type: 'PRESTAMO_CAJA',
                timestamp: now.toISOString(),
                description: 'PrÃ©stamo de cajas a ' + toText(data.customer, ''),
                details: { Cantidad: toNumber(data.quantity, 0), Descripcion: toText(crateType.name, '') },
            };
            return createActionResult({
                ...currentState,
                crateLoans: [newLoan].concat(toArray(currentState.crateLoans)),
                activityLog: [newLog].concat(toArray(currentState.activityLog)),
            });
        };
        const addActivityAction = (currentState, interpretation) => {
            const data = toObject(interpretation.data);
            const nowIso = new Date().toISOString();
            const newActivity = { id: 'e_' + Date.now(), employee: toText(data.employee, ''), activity: 'Empleado llegÃ³', timestamp: nowIso };
            const newLog = {
                id: 'log_' + Date.now(),
                type: 'LLEGADA_EMPLEADO',
                timestamp: nowIso,
                description: 'Llegada de ' + toText(data.employee, ''),
                details: { Empleado: toText(data.employee, '') },
            };
            return { ...currentState, activities: [newActivity].concat(toArray(currentState.activities)), activityLog: [newLog].concat(toArray(currentState.activityLog)) };
        };
        const changeViewActionServer = (currentState, interpretation) => {
            const data = toObject(interpretation.data);
            const newLog = {
                id: 'log_' + Date.now(),
                type: 'NAVEGACION',
                timestamp: new Date().toISOString(),
                description: 'Navegando a la vista ' + toText(data.view, ''),
                details: { Vista: toText(data.view, '') },
            };
            return { ...currentState, activityLog: [newLog].concat(toArray(currentState.activityLog)) };
        };
        const applyFilterActionServer = (currentState, interpretation) => {
            const data = toObject(interpretation.data);
            const newLog = {
                id: 'log_' + Date.now(),
                type: 'FILTRO',
                timestamp: new Date().toISOString(),
                description: 'Filtro aplicado en ' + toText(data.targetView, ''),
                details: { Filtro: toText(data.filterType, ''), Valor: toText(data.filterValue, '') },
            };
            return { ...currentState, activityLog: [newLog].concat(toArray(currentState.activityLog)) };
        };
        const createOfferAction = (currentState, interpretation) => {
            const data = toObject(interpretation.data);
            const newLog = {
                id: 'log_offer_' + Date.now(),
                type: 'OFERTA_ENVIADA',
                timestamp: new Date().toISOString(),
                description: 'Oferta creada para ' + toText(data.targetAudience, ''),
                details: {
                    Producto: toText(data.productDescription, ''),
                    Precio: toNumber(data.price, 0),
                    Audiencia: toText(data.targetAudience, ''),
                },
            };
            return { ...currentState, activityLog: [newLog].concat(toArray(currentState.activityLog)) };
        };
        const ensureMessageOnSnapshot = (sourceSnapshot) => {
            const messages = cloneValue(toArray(sourceSnapshot.messages), []);
            const existingIndex = messages.findIndex((item) => toText(item.id, '') === toText(messageId, ''));
            const existingMessage = existingIndex >= 0 ? toObject(messages[existingIndex]) : {};
            const normalizedMessage = {
                ...existingMessage,
                ...toObject(incomingMessage),
                id: toText(messageId, ''),
                sender: toText(incomingMessage.sender, toText(existingMessage.sender, 'Sistema')),
                text: toText(incomingMessage.text, toText(existingMessage.text, '')),
                timestamp: toIsoString(incomingMessage.timestamp || existingMessage.timestamp || new Date().toISOString()),
                status: toText(incomingMessage.status, toText(existingMessage.status, 'interpreted')),
                interpretation: toObject(incomingMessage.interpretation || existingMessage.interpretation),
                isSystemNotification: toBoolean(incomingMessage.isSystemNotification || existingMessage.isSystemNotification),
            };

            if (existingIndex >= 0) {
                messages[existingIndex] = normalizedMessage;
            } else {
                messages.push(normalizedMessage);
            }

            return { ...sourceSnapshot, messages: messages, _approvalMessage: normalizedMessage };
        };

        if (!workspaceId || authWorkspaceId !== workspaceId) {
            throw new ForbiddenError('No tienes acceso a este workspace.');
        }

        if (!canPersistWorkspaceSnapshot()) {
            throw new ForbiddenError('Este perfil es de solo lectura y no puede aprobar acciones en el workspace.');
        }

        if (!messageId) {
            throw new BadRequestError('Necesitas indicar el messageId que vas a aprobar.');
        }

        let snapshotRecord = findSnapshotByWorkspace(workspaceId);
        if (!snapshotRecord) {
            const collection = e.app.findCollectionByNameOrId('fideo_state_snapshots');
            snapshotRecord = new Record(collection);
            snapshotRecord.set('workspace', workspaceId);
            snapshotRecord.set('version', 1);
        }

        const currentVersion = Number(snapshotRecord.get('version') || 0);
        if (expectedVersion && currentVersion && expectedVersion < currentVersion) {
            return e.json(409, {
                message: 'El snapshot remoto ya cambio. Recarga antes de volver a aprobar.',
                version: currentVersion,
                snapshotRecordId: snapshotRecord.id,
            });
        }

        const storedSnapshot = backfillCustomerRefsInSnapshot(cloneValue(snapshotRecord.get('snapshot'), {}));
        let workingSnapshot = backfillCustomerRefsInSnapshot(cloneValue(snapshot, {}));
        workingSnapshot = ensureMessageOnSnapshot(workingSnapshot);
        const approvalMessage = workingSnapshot._approvalMessage;
        delete workingSnapshot._approvalMessage;

        if (!approvalMessage || !approvalMessage.interpretation || !approvalMessage.interpretation.type) {
            throw new BadRequestError('La aprobacion requiere un mensaje con interpretacion valida.');
        }

        if (toText(approvalMessage.status, '') === 'approved') {
            return e.json(200, {
                version: currentVersion || 1,
                snapshotRecordId: snapshotRecord.id,
                updatedAt: new Date().toISOString(),
                snapshot: workingSnapshot,
                notification: null,
            });
        }

        const interpretation = approvalMessage.interpretation;
        const touchedCollections = {
            sales: false,
            inventory: false,
            payments: false,
            purchaseOrders: false,
            prices: false,
            crateLoans: false,
            activities: false,
            activityLog: false,
            cashDrawers: false,
            cashDrawerActivities: false,
            taskAssignments: false,
            taskReports: false,
        };

        let result = createActionResult(workingSnapshot, null);
        switch (toText(interpretation.type, '')) {
            case 'VENTA':
                result = addSaleAction(workingSnapshot, interpretation);
                touchedCollections.sales = true;
                touchedCollections.inventory = true;
                touchedCollections.payments = true;
                touchedCollections.activityLog = true;
                touchedCollections.cashDrawers = true;
                touchedCollections.cashDrawerActivities = true;
                break;
            case 'ORDEN_COMPRA':
                result = addPurchaseOrderAction(workingSnapshot, interpretation);
                touchedCollections.purchaseOrders = true;
                touchedCollections.activityLog = true;
                break;
            case 'VENTA_ACTIVO_FIJO':
                result = addFixedAssetSaleAction(workingSnapshot, interpretation);
                touchedCollections.sales = true;
                touchedCollections.activityLog = true;
                break;
            case 'ACTUALIZACION_PRECIO':
                result = updatePriceAction(workingSnapshot, interpretation);
                touchedCollections.prices = true;
                touchedCollections.activityLog = true;
                break;
            case 'MOVIMIENTO_ESTADO':
                result = createActionResult(changeProductStateAction(workingSnapshot, interpretation), null);
                touchedCollections.inventory = true;
                touchedCollections.activityLog = true;
                break;
            case 'TRANSFERENCIA_BODEGA':
                result = createActionResult(transferWarehouseAction(workingSnapshot, interpretation), null);
                touchedCollections.inventory = true;
                touchedCollections.activityLog = true;
                break;
            case 'ASIGNACION_ENTREGA':
                result = createActionResult(assignDeliveryAction(workingSnapshot, interpretation), null);
                touchedCollections.sales = true;
                touchedCollections.activityLog = true;
                break;
            case 'PRESTAMO_CAJA':
                result = addCrateLoanAction(workingSnapshot, interpretation);
                touchedCollections.crateLoans = true;
                touchedCollections.activityLog = true;
                break;
            case 'LLEGADA_EMPLEADO':
                result = createActionResult(addActivityAction(workingSnapshot, interpretation), null);
                touchedCollections.activities = true;
                touchedCollections.activityLog = true;
                break;
            case 'CAMBIO_VISTA':
                result = createActionResult(changeViewActionServer(workingSnapshot, interpretation), null);
                touchedCollections.activityLog = true;
                break;
            case 'APLICAR_FILTRO':
                result = createActionResult(applyFilterActionServer(workingSnapshot, interpretation), null);
                touchedCollections.activityLog = true;
                break;
            case 'CREAR_OFERTA':
                result = createActionResult(createOfferAction(workingSnapshot, interpretation), null);
                touchedCollections.activityLog = true;
                break;
        }

        if (JSON.stringify(toArray(workingSnapshot.taskAssignments)) !== JSON.stringify(toArray(result.nextState.taskAssignments))) {
            touchedCollections.taskAssignments = true;
        }

        if (JSON.stringify(toArray(storedSnapshot.taskReports)) !== JSON.stringify(toArray(result.nextState.taskReports))) {
            touchedCollections.taskReports = true;
        }

        const finalMessages = toArray(result.nextState.messages).map((item) =>
            toText(item.id, '') === toText(messageId, '') ? { ...item, status: 'approved' } : item,
        );
        if (result.notification) {
            finalMessages.push({
                id: 'msg_sys_' + Date.now(),
                sender: 'Sistema',
                text: toText(result.notification.text, ''),
                timestamp: new Date().toISOString(),
                status: 'approved',
                isSystemNotification: true,
            });
        }

        const finalSnapshot = backfillCustomerRefsInSnapshot({
            ...result.nextState,
            messages: finalMessages,
        });
        const finalApprovalMessage =
            toArray(finalSnapshot.messages).find((item) => toText(item.id, '') === toText(messageId, '')) || null;

        snapshotRecord.set('snapshot', finalSnapshot);
        snapshotRecord.set('version', currentVersion > 0 ? currentVersion + 1 : 1);
        snapshotRecord.set('updatedBy', authRecord.id);
        e.app.save(snapshotRecord);

        syncTouchedCollections(workspaceId, finalSnapshot, touchedCollections);

        const pushNotifications = fideoPushDispatchOperational(e.app, {
            workspaceId: workspaceId,
            workspaceSlug: fideoPushGetWorkspaceSlug(e.app, workspaceId),
            previousSnapshot: workingSnapshot,
            nextSnapshot: finalSnapshot,
            systemNotification: result.notification,
        });

        const actionLogRecord = writeActionLog(workspaceId, authRecord.id, 'approve_interpretation', {
            messageId: messageId,
            previousStatus: toText(approvalMessage.status, 'interpreted'),
            nextStatus: 'approved',
            previousInterpretationType: toText(toObject(approvalMessage.interpretation).type, ''),
            interpretationType: toText(interpretation.type, ''),
            version: snapshotRecord.get('version'),
            previousVersion: currentVersion || 0,
            previousMessage: cloneValue(approvalMessage, null),
            message: cloneValue(finalApprovalMessage, null),
            undo: {
                eligible: true,
                messageId: messageId,
                previousVersion: currentVersion || 0,
                nextVersion: snapshotRecord.get('version'),
                previousSnapshot: cloneValue(workingSnapshot, {}),
                nextSnapshot: cloneValue(finalSnapshot, {}),
                previousMessage: cloneValue(approvalMessage, null),
                message: cloneValue(finalApprovalMessage, null),
                touchedCollections: cloneValue(touchedCollections, {}),
            },
            pushNotifications: pushNotifications,
        });

        return e.json(200, {
            version: snapshotRecord.get('version'),
            snapshotRecordId: snapshotRecord.id,
            updatedAt: new Date().toISOString(),
            snapshot: finalSnapshot,
            notification: result.notification,
            actionLogId: actionLogRecord.id,
            pushNotifications: pushNotifications,
        });
    },
    $apis.requireAuth('fideo_users'),
);

routerAdd(
    'POST',
    '/api/fideo/messages/correct',
    (e) => {
        const authRecord = e.auth || e.requestInfo().auth;
        if (!authRecord) {
            throw new UnauthorizedError('Necesitas autenticarte para corregir interpretaciones de Fideo.');
        }

        const body = e.requestInfo().body || {};
        const workspaceId = body.workspaceId || '';
        const expectedVersion = Number(body.expectedVersion || 0);
        const snapshot = body.snapshot || {};
        const messageId = body.messageId || '';
        const incomingMessage = body.message || {};
        const authWorkspaceId = authRecord.get('workspace') || '';

        const toArray = (value) => (Array.isArray(value) ? value : []);
        const toObject = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {});
        const toText = (value, fallback) => (value === undefined || value === null || value === '' ? (fallback || '') : String(value));
        const toBoolean = (value) => value === true || value === 'true' || value === 1;
        const toIsoString = (value) => {
            if (!value) return '';
            if (typeof value === 'string') return value;
            try {
                return new Date(value).toISOString();
            } catch (_) {
                return '';
            }
        };
        const cloneValue = (value, fallback) => JSON.parse(JSON.stringify(value === undefined ? fallback : value));
        const pickDefined = (...values) => {
            for (let index = 0; index < values.length; index += 1) {
                if (values[index] !== undefined) {
                    return values[index];
                }
            }
            return undefined;
        };
        const canPersistWorkspaceSnapshot = () => {
            const role = toText(authRecord.get('role'), 'Admin');
            return !!authRecord.get('canSwitchRoles') || ['Admin', 'Empacador', 'Repartidor', 'Cajero'].indexOf(role) >= 0;
        };
        const findSnapshotByWorkspace = (targetWorkspaceId) => {
            try {
                return e.app.findFirstRecordByData('fideo_state_snapshots', 'workspace', targetWorkspaceId);
            } catch (_) {
                return null;
            }
        };
        const writeActionLog = (targetWorkspaceId, actorId, action, payload) => {
            const collection = e.app.findCollectionByNameOrId('fideo_action_logs');
            const record = new Record(collection);
            record.set('workspace', targetWorkspaceId);
            record.set('actor', actorId || '');
            record.set('action', action);
            record.set('payload', payload || {});
            e.app.save(record);
            return record;
        };
        const backfillCustomerRefsInSnapshot = (sourceSnapshot) => {
            const normalized = Object.assign({}, toObject(sourceSnapshot));
            const customers = toArray(normalized.customers);
            const uniqueCustomersByName = {};
            const duplicateNames = {};

            customers.forEach((customer) => {
                const name = toText(customer && customer.name, '');
                if (!name) return;
                if (uniqueCustomersByName[name]) {
                    duplicateNames[name] = true;
                    return;
                }
                uniqueCustomersByName[name] = customer;
            });

            Object.keys(duplicateNames).forEach((name) => {
                delete uniqueCustomersByName[name];
            });

            normalized.sales = toArray(normalized.sales).map((item) => {
                const customerId = toText(item && item.customerId, '');
                if (customerId) return item;
                const customer = uniqueCustomersByName[toText(item && item.customer, '')];
                if (!customer) return item;
                return Object.assign({}, item, { customerId: toText(customer.id, '') });
            });

            normalized.crateLoans = toArray(normalized.crateLoans).map((item) => {
                const customerId = toText(item && item.customerId, '');
                if (customerId) return item;
                const customer = uniqueCustomersByName[toText(item && item.customer, '')];
                if (!customer) return item;
                return Object.assign({}, item, { customerId: toText(customer.id, '') });
            });

            return normalized;
        };
        const normalizeInterpretation = (rawInterpretation, messageText, sender, fallbackExplanation) => {
            const interpreted = toObject(rawInterpretation);
            const type = toText(interpreted.type, 'DESCONOCIDO');
            const certaintyValue = Number(interpreted.certainty);
            return {
                type: type,
                originalMessage: messageText,
                certainty: Number.isFinite(certaintyValue)
                    ? Math.max(0, Math.min(1, certaintyValue))
                    : (type === 'DESCONOCIDO' ? 0.1 : 0.65),
                explanation: toText(interpreted.explanation, fallbackExplanation || 'Interpretacion corregida manualmente desde el backend.'),
                data: toObject(interpreted.data),
                sender: sender,
            };
        };
        const upsertMessageOnSnapshot = (sourceSnapshot, overrides) => {
            const normalizedOverrides = toObject(overrides);
            const messages = cloneValue(toArray(sourceSnapshot.messages), []);
            const existingIndex = messages.findIndex((item) => toText(item.id, '') === toText(messageId, ''));
            const existingMessage = existingIndex >= 0 ? toObject(messages[existingIndex]) : {};
            const normalizedMessage = {
                ...existingMessage,
                ...toObject(incomingMessage),
                ...normalizedOverrides,
                id: toText(messageId, ''),
                sender: toText(pickDefined(normalizedOverrides.sender, incomingMessage.sender, existingMessage.sender), 'Sistema'),
                text: toText(pickDefined(normalizedOverrides.text, incomingMessage.text, existingMessage.text), ''),
                timestamp: toIsoString(
                    pickDefined(normalizedOverrides.timestamp, incomingMessage.timestamp, existingMessage.timestamp, new Date().toISOString()),
                ),
                status: toText(pickDefined(normalizedOverrides.status, incomingMessage.status, existingMessage.status), 'pending'),
                interpretation: toObject(
                    pickDefined(normalizedOverrides.interpretation, incomingMessage.interpretation, existingMessage.interpretation),
                ),
                isSystemNotification: toBoolean(
                    pickDefined(
                        normalizedOverrides.isSystemNotification,
                        incomingMessage.isSystemNotification,
                        existingMessage.isSystemNotification,
                    ),
                ),
            };

            if (existingIndex >= 0) {
                messages[existingIndex] = normalizedMessage;
            } else {
                messages.push(normalizedMessage);
            }

            return {
                snapshot: { ...sourceSnapshot, messages: messages },
                message: normalizedMessage,
                existingMessage: existingMessage,
            };
        };

        if (!workspaceId || authWorkspaceId !== workspaceId) {
            throw new ForbiddenError('No tienes acceso a este workspace.');
        }

        if (!canPersistWorkspaceSnapshot()) {
            throw new ForbiddenError('Este perfil es de solo lectura y no puede corregir interpretaciones en el workspace.');
        }

        if (!messageId) {
            throw new BadRequestError('Necesitas indicar el messageId que vas a corregir.');
        }

        let snapshotRecord = findSnapshotByWorkspace(workspaceId);
        if (!snapshotRecord) {
            const collection = e.app.findCollectionByNameOrId('fideo_state_snapshots');
            snapshotRecord = new Record(collection);
            snapshotRecord.set('workspace', workspaceId);
            snapshotRecord.set('version', 1);
        }

        const currentVersion = Number(snapshotRecord.get('version') || 0);
        if (expectedVersion && currentVersion && expectedVersion < currentVersion) {
            return e.json(409, {
                message: 'El snapshot remoto ya cambio. Recarga antes de volver a corregir.',
                version: currentVersion,
                snapshotRecordId: snapshotRecord.id,
            });
        }

        const storedSnapshot = toObject(snapshotRecord.get('snapshot'));
        const workingBaseSnapshot = Object.keys(toObject(snapshot)).length > 0 ? snapshot : storedSnapshot;
        let workingSnapshot = backfillCustomerRefsInSnapshot(cloneValue(workingBaseSnapshot, {}));
        const preparedMessageState = upsertMessageOnSnapshot(workingSnapshot);
        workingSnapshot = preparedMessageState.snapshot;

        const correctedMessageText = toText(
            pickDefined(
                incomingMessage.text,
                toObject(body.interpretation).originalMessage,
                toObject(body.correctedInterpretation).originalMessage,
                preparedMessageState.message.text,
            ),
            '',
        );
        if (!correctedMessageText.trim()) {
            throw new BadRequestError('Necesitas enviar el texto del mensaje que vas a corregir.');
        }

        const correctionPayload = toObject(pickDefined(body.interpretation, body.correctedInterpretation, incomingMessage.interpretation));
        if (Object.keys(correctionPayload).length === 0) {
            throw new BadRequestError('Necesitas enviar una interpretacion corregida completa.');
        }
        if (!toText(correctionPayload.type, '').trim()) {
            throw new BadRequestError('Necesitas indicar el tipo de la interpretacion corregida.');
        }
        const correctedInterpretation = normalizeInterpretation(
            correctionPayload,
            correctedMessageText,
            toText(preparedMessageState.message.sender, 'Sistema'),
            'Interpretacion corregida manualmente por el usuario.',
        );

        const existingStatus = toText(preparedMessageState.existingMessage.status, '');
        if (existingStatus === 'approved') {
            return e.json(409, {
                message: 'Este mensaje ya fue aprobado. No se puede corregir su interpretacion sin revertir primero la accion aplicada.',
                version: currentVersion || 1,
                snapshotRecordId: snapshotRecord.id,
                updatedAt: new Date().toISOString(),
                snapshot: workingSnapshot,
                message: preparedMessageState.message,
                interpretation: preparedMessageState.message.interpretation || null,
                meta: {
                    provider: 'manual',
                    mode: 'already_approved',
                    model: null,
                    apiKeyEnv: null,
                    usedGoogleMaps: false,
                    error: null,
                },
            });
        }

        const correctedMessageState = upsertMessageOnSnapshot(workingSnapshot, {
            text: correctedMessageText,
            status: 'interpreted',
            interpretation: correctedInterpretation,
        });
        const finalSnapshot = backfillCustomerRefsInSnapshot(correctedMessageState.snapshot);

        snapshotRecord.set('snapshot', finalSnapshot);
        snapshotRecord.set('version', currentVersion > 0 ? currentVersion + 1 : 1);
        snapshotRecord.set('updatedBy', authRecord.id);
        e.app.save(snapshotRecord);

        const actionLogRecord = writeActionLog(workspaceId, authRecord.id, 'correct_interpretation', {
            messageId: messageId,
            previousStatus: existingStatus,
            nextStatus: 'interpreted',
            previousInterpretationType: toText(toObject(preparedMessageState.existingMessage.interpretation).type, ''),
            interpretationType: toText(correctedInterpretation.type, 'DESCONOCIDO'),
            version: snapshotRecord.get('version'),
            previousVersion: currentVersion || 0,
            previousMessage: cloneValue(preparedMessageState.existingMessage, null),
            message: cloneValue(correctedMessageState.message, null),
            undo: {
                eligible: true,
                messageId: messageId,
                previousVersion: currentVersion || 0,
                nextVersion: snapshotRecord.get('version'),
                previousSnapshot: cloneValue(workingSnapshot, {}),
                nextSnapshot: cloneValue(finalSnapshot, {}),
                previousMessage: cloneValue(preparedMessageState.existingMessage, null),
                message: cloneValue(correctedMessageState.message, null),
            },
        });

        return e.json(200, {
            version: snapshotRecord.get('version'),
            snapshotRecordId: snapshotRecord.id,
            updatedAt: new Date().toISOString(),
            snapshot: finalSnapshot,
            message: correctedMessageState.message,
            interpretation: correctedMessageState.message.interpretation || null,
            actionLogId: actionLogRecord.id,
            meta: {
                provider: 'manual',
                mode: 'corrected',
                model: null,
                apiKeyEnv: null,
                usedGoogleMaps: false,
                error: null,
            },
        });
    },
    $apis.requireAuth('fideo_users'),
);

const revertMessageActionHandler = (e) => {
        const authRecord = e.auth || e.requestInfo().auth;
        if (!authRecord) {
            throw new UnauthorizedError('Necesitas autenticarte para revertir acciones de Fideo.');
        }

        const body = e.requestInfo().body || {};
        const workspaceId = body.workspaceId || '';
        const expectedVersion = Number(body.expectedVersion || 0);
        const actionId = body.actionId || '';
        const messageId = body.messageId || '';
        const authWorkspaceId = authRecord.get('workspace') || '';

        const toArray = (value) => {
            if (Array.isArray(value)) {
                return value;
            }
            if (value !== undefined && value !== null && String(value).trim()) {
                try {
                    const parsed = JSON.parse(String(value));
                    return Array.isArray(parsed) ? parsed : [];
                } catch (_) {
                    return [];
                }
            }
            return [];
        };
        const toObject = (value) => {
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                try {
                    const normalized = JSON.parse(JSON.stringify(value));
                    return normalized && typeof normalized === 'object' && !Array.isArray(normalized) ? normalized : {};
                } catch (_) {
                    return value;
                }
            }
            if (value !== undefined && value !== null && String(value).trim()) {
                try {
                    const parsed = JSON.parse(String(value));
                    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
                } catch (_) {
                    return {};
                }
            }
            return {};
        };
        const toText = (value, fallback) => (value === undefined || value === null || value === '' ? (fallback || '') : String(value));
        const toNumber = (value, fallback) => {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : fallback;
        };
        const toBoolean = (value) => value === true || value === 'true' || value === 1;
        const toIsoString = (value) => {
            if (!value) return '';
            if (typeof value === 'string') return value;
            try {
                return new Date(value).toISOString();
            } catch (_) {
                return '';
            }
        };
        const cloneValue = (value, fallback) => JSON.parse(JSON.stringify(value === undefined ? fallback : value));
        const pickDefined = (...values) => {
            for (let index = 0; index < values.length; index += 1) {
                if (values[index] !== undefined) {
                    return values[index];
                }
            }
            return undefined;
        };
        const canPersistWorkspaceSnapshot = () => {
            const role = toText(authRecord.get('role'), 'Admin');
            return !!authRecord.get('canSwitchRoles') || ['Admin', 'Empacador', 'Repartidor', 'Cajero'].indexOf(role) >= 0;
        };
        const findSnapshotByWorkspace = (targetWorkspaceId) => {
            try {
                return e.app.findFirstRecordByData('fideo_state_snapshots', 'workspace', targetWorkspaceId);
            } catch (_) {
                return null;
            }
        };
        const writeActionLog = (targetWorkspaceId, actorId, action, payload) => {
            const collection = e.app.findCollectionByNameOrId('fideo_action_logs');
            const record = new Record(collection);
            record.set('workspace', targetWorkspaceId);
            record.set('actor', actorId || '');
            record.set('action', action);
            record.set('payload', payload || {});
            e.app.save(record);
        };
        const backfillCustomerRefsInSnapshot = (sourceSnapshot) => {
            const normalized = Object.assign({}, toObject(sourceSnapshot));
            const customers = toArray(normalized.customers);
            const uniqueCustomersByName = {};
            const duplicateNames = {};

            customers.forEach((customer) => {
                const name = toText(customer && customer.name, '');
                if (!name) return;
                if (uniqueCustomersByName[name]) {
                    duplicateNames[name] = true;
                    return;
                }
                uniqueCustomersByName[name] = customer;
            });

            Object.keys(duplicateNames).forEach((name) => {
                delete uniqueCustomersByName[name];
            });

            normalized.sales = toArray(normalized.sales).map((item) => {
                const customerId = toText(item && item.customerId, '');
                if (customerId) return item;
                const customer = uniqueCustomersByName[toText(item && item.customer, '')];
                if (!customer) return item;
                return Object.assign({}, item, { customerId: toText(customer.id, '') });
            });

            normalized.crateLoans = toArray(normalized.crateLoans).map((item) => {
                const customerId = toText(item && item.customerId, '');
                if (customerId) return item;
                const customer = uniqueCustomersByName[toText(item && item.customer, '')];
                if (!customer) return item;
                return Object.assign({}, item, { customerId: toText(customer.id, '') });
            });

            return normalized;
        };
        const buildPriceKey = (item) => [
            toText(item.varietyId, ''),
            toText(item.size, ''),
            toText(item.quality, ''),
            toText(item.state, ''),
        ].join('::');
        const getWorkspaceRecords = (collectionName, targetWorkspaceId) =>
            e.app.findRecordsByFilter(collectionName, "workspace = '" + targetWorkspaceId + "'", '', 2000, 0);
        const replaceWorkspaceCollectionByExternalId = (collectionName, targetWorkspaceId, items, assignRecord) => {
            const collection = e.app.findCollectionByNameOrId(collectionName);
            const existingRecords = getWorkspaceRecords(collectionName, targetWorkspaceId);
            const existingByExternalId = {};
            existingRecords.forEach((record) => {
                existingByExternalId[toText(record.get('externalId'), '')] = record;
            });

            const seen = {};
            toArray(items).forEach((item) => {
                const externalId = toText(item && item.id, '');
                if (!externalId) return;

                seen[externalId] = true;
                const record = existingByExternalId[externalId] || new Record(collection);
                record.set('workspace', targetWorkspaceId);
                record.set('externalId', externalId);
                assignRecord(record, item || {});
                e.app.save(record);
            });

            existingRecords.forEach((record) => {
                const externalId = toText(record.get('externalId'), '');
                if (!seen[externalId]) {
                    e.app.delete(record);
                }
            });
        };
        const replaceWorkspacePriceCollection = (targetWorkspaceId, items) => {
            const collectionName = 'fideo_prices';
            const collection = e.app.findCollectionByNameOrId(collectionName);
            const existingRecords = getWorkspaceRecords(collectionName, targetWorkspaceId);
            const existingByKey = {};
            existingRecords.forEach((record) => {
                existingByKey[buildPriceKey({
                    varietyId: record.get('varietyId'),
                    size: record.get('size'),
                    quality: record.get('quality'),
                    state: record.get('state'),
                })] = record;
            });

            const seen = {};
            toArray(items).forEach((item) => {
                const key = buildPriceKey(item || {});
                if (!key.replace(/:/g, '')) return;

                seen[key] = true;
                const record = existingByKey[key] || new Record(collection);
                record.set('workspace', targetWorkspaceId);
                record.set('varietyId', toText(item.varietyId, ''));
                record.set('size', toText(item.size, ''));
                record.set('quality', toText(item.quality, ''));
                record.set('state', toText(item.state, ''));
                record.set('price', toNumber(item.price, 0));
                e.app.save(record);
            });

            existingRecords.forEach((record) => {
                const key = buildPriceKey({
                    varietyId: record.get('varietyId'),
                    size: record.get('size'),
                    quality: record.get('quality'),
                    state: record.get('state'),
                });
                if (!seen[key]) {
                    e.app.delete(record);
                }
            });
        };
        const normalizeTaskAssignmentsForSync = (items) =>
            toArray(items)
                .map((item) => {
                    const normalizedItem = toObject(item);
                    const fallbackId = [toText(normalizedItem.taskId, ''), toText(normalizedItem.employeeId, '')]
                        .filter((value) => !!value)
                        .join('::');
                    const externalId = toText(normalizedItem.id, fallbackId);
                    return externalId ? Object.assign({}, normalizedItem, { id: externalId }) : null;
                })
                .filter((item) => !!item);
        const normalizeTaskReportsForSync = (items) =>
            toArray(items)
                .map((item) => {
                    const normalizedItem = toObject(item);
                    const fallbackId = [
                        toText(normalizedItem.taskId, ''),
                        toText(normalizedItem.createdAt, ''),
                        toText(normalizedItem.kind, ''),
                        toText(normalizedItem.employeeId, ''),
                    ]
                        .filter((value) => !!value)
                        .join('::');
                    const externalId = toText(normalizedItem.id, fallbackId);
                    return externalId ? Object.assign({}, normalizedItem, { id: externalId }) : null;
                })
                .filter((item) => !!item);
        const syncNormalizedFromSnapshot = (targetWorkspaceId, snapshot) => {
            replaceWorkspaceCollectionByExternalId('fideo_product_groups', targetWorkspaceId, snapshot.productGroups, (record, item) => {
                record.set('name', toText(item.name, ''));
                record.set('icon', toText(item.icon, ''));
                record.set('category', toText(item.category, ''));
                record.set('unit', toText(item.unit, 'cajas'));
                record.set('archived', toBoolean(item.archived));
                record.set('varieties', toArray(item.varieties));
            });

            replaceWorkspaceCollectionByExternalId('fideo_warehouses', targetWorkspaceId, snapshot.warehouses, (record, item) => {
                record.set('name', toText(item.name, ''));
                record.set('icon', toText(item.icon, ''));
                record.set('archived', toBoolean(item.archived));
            });

            replaceWorkspacePriceCollection(targetWorkspaceId, snapshot.prices);

            replaceWorkspaceCollectionByExternalId('fideo_inventory_batches', targetWorkspaceId, snapshot.inventory, (record, item) => {
                record.set('varietyId', toText(item.varietyId, ''));
                record.set('size', toText(item.size, ''));
                record.set('quality', toText(item.quality, ''));
                record.set('quantity', toNumber(item.quantity, 0));
                record.set('state', toText(item.state, ''));
                record.set('location', toText(item.location, ''));
                record.set('warehouseId', toText(item.warehouseId, ''));
                record.set('packagingId', toText(item.packagingId, ''));
                record.set('entryDate', toIsoString(item.entryDate));
            });

            replaceWorkspaceCollectionByExternalId('fideo_customers', targetWorkspaceId, snapshot.customers, (record, item) => {
                record.set('name', toText(item.name, ''));
                record.set('contacts', toArray(item.contacts));
                record.set('specialPrices', toArray(item.specialPrices));
                record.set('schedule', item.schedule ? toObject(item.schedule) : null);
                record.set('deliveryNotes', toText(item.deliveryNotes, ''));
                record.set('creditStatus', toText(item.creditStatus, 'Confiable'));
                if (item.creditLimit === undefined || item.creditLimit === null || item.creditLimit === '') {
                    record.set('creditLimit', null);
                } else {
                    record.set('creditLimit', toNumber(item.creditLimit, 0));
                }
            });

            replaceWorkspaceCollectionByExternalId('fideo_suppliers', targetWorkspaceId, snapshot.suppliers, (record, item) => {
                record.set('name', toText(item.name, ''));
                record.set('contact', toText(item.contact, ''));
                record.set('supplies', toArray(item.supplies));
            });

            replaceWorkspaceCollectionByExternalId('fideo_purchase_orders', targetWorkspaceId, snapshot.purchaseOrders, (record, item) => {
                record.set('supplierId', toText(item.supplierId, ''));
                record.set('varietyId', toText(item.varietyId, ''));
                record.set('size', toText(item.size, ''));
                record.set('packaging', toText(item.packaging, ''));
                record.set('quantity', toNumber(item.quantity, 0));
                record.set('totalCost', toNumber(item.totalCost, 0));
                record.set('status', toText(item.status, 'Pendiente'));
                record.set('orderDate', toIsoString(item.orderDate));
                record.set('expectedArrivalDate', toIsoString(item.expectedArrivalDate));
                record.set('paymentMethod', toText(item.paymentMethod, 'N/A'));
            });

            replaceWorkspaceCollectionByExternalId('fideo_sales', targetWorkspaceId, snapshot.sales, (record, item) => {
                record.set('productGroupId', toText(item.productGroupId, ''));
                record.set('varietyId', toText(item.varietyId, ''));
                record.set('customerId', toText(item.customerId, ''));
                record.set('productGroupName', toText(item.productGroupName, ''));
                record.set('varietyName', toText(item.varietyName, ''));
                record.set('size', toText(item.size, ''));
                record.set('quality', toText(item.quality, ''));
                record.set('state', toText(item.state, ''));
                record.set('quantity', toNumber(item.quantity, 0));
                record.set('price', toNumber(item.price, 0));
                record.set('cogs', toNumber(item.cogs, 0));
                record.set('unit', toText(item.unit, ''));
                record.set('customer', toText(item.customer, ''));
                record.set('destination', toText(item.destination, ''));
                record.set('locationQuery', toText(item.locationQuery, ''));
                record.set('status', toText(item.status, 'Pendiente de Empaque'));
                record.set('paymentStatus', toText(item.paymentStatus, 'Pendiente'));
                record.set('paymentMethod', toText(item.paymentMethod, 'N/A'));
                record.set('paymentNotes', toText(item.paymentNotes, ''));
                record.set('assignedEmployeeId', toText(item.assignedEmployeeId, ''));
                record.set('timestamp', toIsoString(item.timestamp));
                record.set('deliveryDeadline', toIsoString(item.deliveryDeadline));
            });

            replaceWorkspaceCollectionByExternalId('fideo_payments', targetWorkspaceId, snapshot.payments, (record, item) => {
                record.set('customerId', toText(item.customerId, ''));
                record.set('amount', toNumber(item.amount, 0));
                record.set('date', toIsoString(item.date));
                record.set('saleId', toText(item.saleId, ''));
            });

            replaceWorkspaceCollectionByExternalId('fideo_crate_loans', targetWorkspaceId, snapshot.crateLoans, (record, item) => {
                record.set('customerId', toText(item.customerId, ''));
                record.set('customer', toText(item.customer, ''));
                record.set('crateTypeId', toText(item.crateTypeId, ''));
                record.set('quantity', toNumber(item.quantity, 0));
                record.set('timestamp', toIsoString(item.timestamp));
                record.set('dueDate', toIsoString(item.dueDate));
                record.set('status', toText(item.status, 'Prestado'));
            });

            replaceWorkspaceCollectionByExternalId('fideo_employee_activities', targetWorkspaceId, snapshot.activities, (record, item) => {
                record.set('employee', toText(item.employee, ''));
                record.set('activity', toText(item.activity, ''));
                record.set('timestamp', toIsoString(item.timestamp));
            });

            replaceWorkspaceCollectionByExternalId('fideo_activity_logs', targetWorkspaceId, snapshot.activityLog, (record, item) => {
                const details = toObject(item.details);
                record.set('type', toText(item.type, 'NAVEGACION'));
                record.set('timestamp', toIsoString(item.timestamp));
                record.set('description', toText(item.description, ''));
                record.set('details', Object.keys(details).length > 0 ? details : null);
            });

            replaceWorkspaceCollectionByExternalId('fideo_cash_drawers', targetWorkspaceId, snapshot.cashDrawers, (record, item) => {
                record.set('name', toText(item.name, ''));
                record.set('balance', toNumber(item.balance, 0));
                record.set('status', toText(item.status, 'Cerrada'));
                record.set('lastOpened', toIsoString(item.lastOpened));
                record.set('lastClosed', toIsoString(item.lastClosed));
            });

            replaceWorkspaceCollectionByExternalId('fideo_cash_drawer_activities', targetWorkspaceId, snapshot.cashDrawerActivities, (record, item) => {
                record.set('drawerId', toText(item.drawerId, ''));
                record.set('type', toText(item.type, 'SALDO_INICIAL'));
                record.set('amount', toNumber(item.amount, 0));
                record.set('timestamp', toIsoString(item.timestamp));
                record.set('notes', toText(item.notes, ''));
                record.set('relatedId', toText(item.relatedId, ''));
            });

            replaceWorkspaceCollectionByExternalId('fideo_task_assignments', targetWorkspaceId, normalizeTaskAssignmentsForSync(snapshot.taskAssignments), (record, item) => {
                const payload = toObject(item);
                record.set('taskId', toText(item.taskId, ''));
                record.set('employeeId', toText(item.employeeId, ''));
                record.set('role', toText(item.role, ''));
                record.set('status', toText(item.status, 'assigned'));
                record.set('assignedAt', toIsoString(item.assignedAt));
                record.set('acknowledgedAt', toIsoString(item.acknowledgedAt));
                record.set('startedAt', toIsoString(item.startedAt));
                record.set('blockedAt', toIsoString(item.blockedAt));
                record.set('doneAt', toIsoString(item.doneAt));
                record.set('blockedReason', toText(item.blockedReason, ''));
                record.set('payload', Object.keys(payload).length > 0 ? payload : null);
            });

            replaceWorkspaceCollectionByExternalId('fideo_task_reports', targetWorkspaceId, normalizeTaskReportsForSync(snapshot.taskReports), (record, item) => {
                const payload = toObject(item);
                record.set('taskId', toText(item.taskId, ''));
                record.set('saleId', toText(item.saleId, ''));
                record.set('role', toText(item.role, ''));
                record.set('employeeId', toText(item.employeeId, ''));
                record.set('employeeName', toText(item.employeeName, ''));
                record.set('customerId', toText(item.customerId, ''));
                record.set('customerName', toText(item.customerName, ''));
                record.set('taskTitle', toText(item.taskTitle, ''));
                record.set('kind', toText(item.kind, 'note'));
                record.set('status', toText(item.status, 'resolved'));
                record.set('severity', toText(item.severity, 'normal'));
                record.set('summary', toText(item.summary, ''));
                record.set('detail', toText(item.detail, ''));
                record.set('evidence', toText(item.evidence, ''));
                record.set('escalationStatus', toText(item.escalationStatus, 'none'));
                record.set('createdAt', toIsoString(item.createdAt));
                record.set('resolvedAt', toIsoString(item.resolvedAt));
                record.set('escalatedAt', toIsoString(item.escalatedAt));
                record.set('payload', Object.keys(payload).length > 0 ? payload : null);
            });
        };
        const findMessageOnSnapshot = (sourceSnapshot, targetMessageId) =>
            toArray(sourceSnapshot.messages).find((item) => toText(item && item.id, '') === toText(targetMessageId, '')) || null;
        const readRecordDate = (record) => {
            const payload = toObject(record && record.get ? record.get('payload') : {});
            const createdAt = toText(
                record && record.get ? record.get('created') : '',
                toText(record && record.created, toText(record && record.get ? record.get('updated') : '', toText(record && record.updated, ''))),
            );
            return Date.parse(createdAt) || toNumber(payload.version, 0) || toNumber(payload.previousVersion, 0) || 0;
        };
        const stringifySnapshot = (sourceSnapshot) =>
            JSON.stringify(backfillCustomerRefsInSnapshot(cloneValue(toObject(sourceSnapshot), {})));
        const findUndoableActionRecord = (targetWorkspaceId, targetMessageId, targetActionId) => {
            if (targetActionId) {
                try {
                    const record = e.app.findRecordById('fideo_action_logs', targetActionId);
                    if (toText(record.get('workspace'), '') !== toText(targetWorkspaceId, '')) {
                        return null;
                    }
                    const action = toText(record.get('action'), '');
                    const payload = toObject(record.get('payload'));
                    const undo = toObject(payload.undo);
                    if (['approve_interpretation', 'correct_interpretation'].indexOf(action) === -1) {
                        return null;
                    }
                    if (!toBoolean(undo.eligible) || toText(undo.revertedAt, '').trim()) {
                        return null;
                    }
                    return record;
                } catch (_) {
                    return null;
                }
            }

            const records = e.app.findRecordsByFilter('fideo_action_logs', "workspace = '" + targetWorkspaceId + "'", '', 200, 0);
            return records
                .filter((record) => {
                    const action = toText(record.get('action'), '');
                    const payload = toObject(record.get('payload'));
                    const undo = toObject(payload.undo);
                    if (['approve_interpretation', 'correct_interpretation'].indexOf(action) === -1) {
                        return false;
                    }
                    if (!toBoolean(undo.eligible)) {
                        return false;
                    }
                    if (toText(undo.revertedAt, '').trim()) {
                        return false;
                    }
                    if (toText(record.get('actor'), '') !== authRecord.id) {
                        return false;
                    }
                    if (!targetMessageId) {
                        return true;
                    }
                    return toText(payload.messageId, '') === toText(targetMessageId, '');
                })
                .sort((left, right) => readRecordDate(right) - readRecordDate(left))[0] || null;
        };

        if (!workspaceId || authWorkspaceId !== workspaceId) {
            throw new ForbiddenError('No tienes acceso a este workspace.');
        }

        if (!canPersistWorkspaceSnapshot()) {
            throw new ForbiddenError('Este perfil es de solo lectura y no puede revertir acciones en el workspace.');
        }

        if (!actionId && !messageId) {
            throw new BadRequestError('Necesitas indicar el actionId o el messageId que vas a revertir.');
        }

        let snapshotRecord = findSnapshotByWorkspace(workspaceId);
        if (!snapshotRecord) {
            throw new BadRequestError('No existe un snapshot persistido para este workspace.');
        }

        const currentVersion = Number(snapshotRecord.get('version') || 0);
        if (expectedVersion && currentVersion && expectedVersion < currentVersion) {
            return e.json(409, {
                message: 'El snapshot remoto ya cambio. Recarga antes de revertir.',
                version: currentVersion,
                snapshotRecordId: snapshotRecord.id,
            });
        }

        const actionRecord = findUndoableActionRecord(workspaceId, messageId, actionId);
        if (!actionRecord) {
            return e.json(404, {
                message: 'No encontre una accion reciente reversible para ese mensaje.',
                version: currentVersion,
                snapshotRecordId: snapshotRecord.id,
            });
        }

        if (toText(actionRecord.get('actor'), '') !== authRecord.id) {
            throw new ForbiddenError('Solo puedes revertir acciones que tu mismo aplicaste.');
        }

        const actionPayload = toObject(actionRecord.get('payload'));
        const undoPayload = toObject(actionPayload.undo);
        const targetAction = toText(actionRecord.get('action'), '');
        const targetMessageId = toText(undoPayload.messageId, toText(actionPayload.messageId, messageId));
        const actionVersion = Number(pickDefined(undoPayload.nextVersion, actionPayload.version, 0) || 0);
        const undoSnapshotSource = toObject(undoPayload.previousSnapshot);
        const actionSnapshotSource = toObject(pickDefined(undoPayload.nextSnapshot, actionPayload.snapshot));

        if (!toBoolean(undoPayload.eligible) || Object.keys(undoSnapshotSource).length === 0) {
            return e.json(409, {
                message: 'La accion seleccionada no tiene suficiente historial para revertirse.',
                version: currentVersion,
                snapshotRecordId: snapshotRecord.id,
            });
        }

        if (toText(undoPayload.revertedAt, '').trim()) {
            return e.json(409, {
                message: 'Esta accion ya fue revertida anteriormente.',
                version: currentVersion,
                snapshotRecordId: snapshotRecord.id,
            });
        }

        if (!Object.keys(actionSnapshotSource).length && actionVersion && currentVersion && actionVersion !== currentVersion) {
            return e.json(409, {
                message: 'El workspace cambio despues de esta accion. No puedo revertirla sin recargar primero.',
                version: currentVersion,
                snapshotRecordId: snapshotRecord.id,
                actionVersion: actionVersion,
            });
        }

        const currentSnapshot = backfillCustomerRefsInSnapshot(toObject(snapshotRecord.get('snapshot')));
        if (
            Object.keys(actionSnapshotSource).length > 0 &&
            stringifySnapshot(currentSnapshot) !== stringifySnapshot(actionSnapshotSource)
        ) {
            return e.json(409, {
                message: 'El snapshot actual ya no coincide con la accion que quieres revertir. Recarga primero.',
                version: currentVersion,
                snapshotRecordId: snapshotRecord.id,
                actionVersion: actionVersion,
            });
        }

        const restoredSnapshot = backfillCustomerRefsInSnapshot(cloneValue(undoSnapshotSource, {}));
        snapshotRecord.set('snapshot', restoredSnapshot);
        snapshotRecord.set('version', currentVersion > 0 ? currentVersion + 1 : 1);
        snapshotRecord.set('updatedBy', authRecord.id);
        e.app.save(snapshotRecord);

        syncNormalizedFromSnapshot(workspaceId, restoredSnapshot);

        actionRecord.set('payload', {
            ...actionPayload,
            undo: {
                ...undoPayload,
                revertedAt: new Date().toISOString(),
                revertedBy: authRecord.id,
                revertedVersion: snapshotRecord.get('version'),
            },
        });
        e.app.save(actionRecord);

        const restoredMessage = findMessageOnSnapshot(restoredSnapshot, targetMessageId);
        writeActionLog(workspaceId, authRecord.id, 'undo_message_action', {
            messageId: targetMessageId,
            undoneActionId: actionRecord.id,
            undoneAction: targetAction,
            undoneActor: toText(actionRecord.get('actor'), ''),
            version: snapshotRecord.get('version'),
            previousVersion: currentVersion || 0,
            previousMessage: cloneValue(findMessageOnSnapshot(currentSnapshot, targetMessageId), null),
            message: cloneValue(restoredMessage, null),
            undo: {
                eligible: false,
                targetActionId: actionRecord.id,
                previousSnapshot: cloneValue(currentSnapshot, {}),
                nextSnapshot: cloneValue(restoredSnapshot, {}),
            },
        });

        return e.json(200, {
            version: snapshotRecord.get('version'),
            snapshotRecordId: snapshotRecord.id,
            updatedAt: new Date().toISOString(),
            snapshot: restoredSnapshot,
            message: restoredMessage || null,
            interpretation: restoredMessage ? restoredMessage.interpretation || null : null,
            notification: null,
            undoneAction: {
                id: actionRecord.id,
                action: targetAction,
                messageId: targetMessageId,
                created: toText(actionRecord.get('created'), toText(actionRecord.created, '')),
                version: actionVersion,
            },
            meta: {
                provider: 'manual',
                mode: 'undo',
                model: null,
                apiKeyEnv: null,
                usedGoogleMaps: false,
                error: null,
            },
        });
};

routerAdd(
    'POST',
    '/api/fideo/messages/revert',
    revertMessageActionHandler,
    $apis.requireAuth('fideo_users'),
);

routerAdd(
    'POST',
    '/api/fideo/messages/undo',
    revertMessageActionHandler,
    $apis.requireAuth('fideo_users'),
);
