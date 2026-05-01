migrate((app) => {
    const workspaces = app.findCollectionByNameOrId('fideo_workspaces');

    const taskAssignments = new Collection({
        type: 'base',
        name: 'fideo_task_assignments',
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
                required: false,
                max: 80,
            },
            {
                name: 'employeeId',
                type: 'text',
                required: false,
                max: 80,
            },
            {
                name: 'role',
                type: 'text',
                required: false,
                max: 40,
            },
            {
                name: 'status',
                type: 'text',
                required: true,
                max: 40,
            },
            {
                name: 'assignedAt',
                type: 'text',
                required: false,
                max: 40,
            },
            {
                name: 'acknowledgedAt',
                type: 'text',
                required: false,
                max: 40,
            },
            {
                name: 'startedAt',
                type: 'text',
                required: false,
                max: 40,
            },
            {
                name: 'blockedAt',
                type: 'text',
                required: false,
                max: 40,
            },
            {
                name: 'doneAt',
                type: 'text',
                required: false,
                max: 40,
            },
            {
                name: 'blockedReason',
                type: 'text',
                required: false,
                max: 1000,
            },
            {
                name: 'payload',
                type: 'json',
                required: false,
            },
        ],
        indexes: [
            'CREATE UNIQUE INDEX idx_fideo_task_assignment_workspace_external ON fideo_task_assignments (workspace, externalId)',
            'CREATE INDEX idx_fideo_task_assignment_workspace_employee_status ON fideo_task_assignments (workspace, employeeId, status)',
            'CREATE INDEX idx_fideo_task_assignment_workspace_task ON fideo_task_assignments (workspace, taskId)',
        ],
    });

    app.save(taskAssignments);
}, (app) => {
    try {
        app.delete(app.findCollectionByNameOrId('fideo_task_assignments'));
    } catch (_) {}
});
