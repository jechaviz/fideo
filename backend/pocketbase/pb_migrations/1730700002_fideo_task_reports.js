migrate((app) => {
    const workspaces = app.findCollectionByNameOrId('fideo_workspaces');

    const taskReports = new Collection({
        type: 'base',
        name: 'fideo_task_reports',
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
            {
                name: 'workspace',
                type: 'relation',
                required: true,
                maxSelect: 1,
                collectionId: workspaces.id,
                cascadeDelete: true,
            },
            {
                name: 'externalId',
                type: 'text',
                required: true,
                max: 160,
            },
            {
                name: 'taskId',
                type: 'text',
                required: true,
                max: 160,
            },
            {
                name: 'saleId',
                type: 'text',
                required: false,
                max: 80,
            },
            {
                name: 'role',
                type: 'text',
                required: true,
                max: 40,
            },
            {
                name: 'employeeId',
                type: 'text',
                required: false,
                max: 80,
            },
            {
                name: 'employeeName',
                type: 'text',
                required: false,
                max: 120,
            },
            {
                name: 'customerId',
                type: 'text',
                required: false,
                max: 80,
            },
            {
                name: 'customerName',
                type: 'text',
                required: false,
                max: 160,
            },
            {
                name: 'taskTitle',
                type: 'text',
                required: true,
                max: 240,
            },
            {
                name: 'kind',
                type: 'text',
                required: true,
                max: 40,
            },
            {
                name: 'status',
                type: 'text',
                required: true,
                max: 40,
            },
            {
                name: 'severity',
                type: 'text',
                required: true,
                max: 20,
            },
            {
                name: 'summary',
                type: 'text',
                required: true,
                max: 1000,
            },
            {
                name: 'detail',
                type: 'text',
                required: false,
                max: 4000,
            },
            {
                name: 'evidence',
                type: 'text',
                required: false,
                max: 1000,
            },
            {
                name: 'escalationStatus',
                type: 'text',
                required: true,
                max: 20,
            },
            {
                name: 'createdAt',
                type: 'text',
                required: false,
                max: 40,
            },
            {
                name: 'resolvedAt',
                type: 'text',
                required: false,
                max: 40,
            },
            {
                name: 'escalatedAt',
                type: 'text',
                required: false,
                max: 40,
            },
            {
                name: 'payload',
                type: 'json',
                required: false,
            },
        ],
        indexes: [
            'CREATE UNIQUE INDEX idx_fideo_task_report_workspace_external ON fideo_task_reports (workspace, externalId)',
            'CREATE INDEX idx_fideo_task_report_workspace_task_created ON fideo_task_reports (workspace, taskId, createdAt)',
            'CREATE INDEX idx_fideo_task_report_workspace_status_escalation ON fideo_task_reports (workspace, status, escalationStatus)',
        ],
    });

    app.save(taskReports);
}, (app) => {
    try {
        app.delete(app.findCollectionByNameOrId('fideo_task_reports'));
    } catch (_) {}
});
