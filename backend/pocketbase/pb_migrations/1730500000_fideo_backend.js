migrate((app) => {
    const workspaces = new Collection({
        type: 'base',
        name: 'fideo_workspaces',
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
            {
                name: 'name',
                type: 'text',
                required: true,
                max: 120,
            },
            {
                name: 'slug',
                type: 'text',
                required: true,
                max: 80,
            },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_fideo_workspace_slug ON fideo_workspaces (slug)'],
    });
    app.save(workspaces);

    const users = new Collection({
        type: 'auth',
        name: 'fideo_users',
        listRule: null,
        viewRule: 'id = @request.auth.id',
        createRule: null,
        updateRule: 'id = @request.auth.id',
        deleteRule: null,
        fields: [
            {
                name: 'name',
                type: 'text',
                required: true,
                max: 120,
            },
            {
                name: 'role',
                type: 'select',
                required: true,
                maxSelect: 1,
                values: ['Admin', 'Repartidor', 'Empacador', 'Cajero', 'Cliente', 'Proveedor'],
            },
            {
                name: 'workspace',
                type: 'relation',
                required: false,
                maxSelect: 1,
                collectionId: workspaces.id,
                cascadeDelete: false,
            },
            {
                name: 'customerId',
                type: 'text',
                required: false,
                max: 40,
            },
            {
                name: 'supplierId',
                type: 'text',
                required: false,
                max: 40,
            },
            {
                name: 'canSwitchRoles',
                type: 'bool',
                required: false,
            },
        ],
    });
    app.save(users);

    const snapshots = new Collection({
        type: 'base',
        name: 'fideo_state_snapshots',
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
                name: 'snapshot',
                type: 'json',
                required: true,
            },
            {
                name: 'version',
                type: 'number',
                required: true,
                min: 1,
            },
            {
                name: 'updatedBy',
                type: 'relation',
                required: false,
                maxSelect: 1,
                collectionId: users.id,
                cascadeDelete: false,
            },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_fideo_snapshot_workspace ON fideo_state_snapshots (workspace)'],
    });
    app.save(snapshots);

    const actionLogs = new Collection({
        type: 'base',
        name: 'fideo_action_logs',
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
                name: 'actor',
                type: 'relation',
                required: false,
                maxSelect: 1,
                collectionId: users.id,
                cascadeDelete: false,
            },
            {
                name: 'action',
                type: 'text',
                required: true,
                max: 120,
            },
            {
                name: 'payload',
                type: 'json',
                required: false,
            },
        ],
    });
    app.save(actionLogs);

    let defaultWorkspace = new Record(workspaces);
    defaultWorkspace.set('name', 'Fideo Main');
    defaultWorkspace.set('slug', 'main');
    app.save(defaultWorkspace);
}, (app) => {
    try {
        app.delete(app.findCollectionByNameOrId('fideo_action_logs'));
    } catch (_) {}

    try {
        app.delete(app.findCollectionByNameOrId('fideo_state_snapshots'));
    } catch (_) {}

    try {
        app.delete(app.findCollectionByNameOrId('fideo_users'));
    } catch (_) {}

    try {
        app.delete(app.findCollectionByNameOrId('fideo_workspaces'));
    } catch (_) {}
});
