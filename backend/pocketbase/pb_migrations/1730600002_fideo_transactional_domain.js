migrate((app) => {
    const workspaces = app.findCollectionByNameOrId('fideo_workspaces');

    const createWorkspaceField = () => ({
        name: 'workspace',
        type: 'relation',
        required: true,
        maxSelect: 1,
        collectionId: workspaces.id,
        cascadeDelete: true,
    });

    const createExternalIdField = () => ({
        name: 'externalId',
        type: 'text',
        required: true,
        max: 80,
    });

    const createTextField = (name, required, max) => ({
        name,
        type: 'text',
        required,
        max,
    });

    const createNumberField = (name, required) => ({
        name,
        type: 'number',
        required,
    });

    const createCollection = (name, fields, indexes) =>
        new Collection({
            type: 'base',
            name,
            listRule: null,
            viewRule: null,
            createRule: null,
            updateRule: null,
            deleteRule: null,
            fields,
            indexes,
        });

    const sales = createCollection(
        'fideo_sales',
        [
            createWorkspaceField(),
            createExternalIdField(),
            createTextField('productGroupId', true, 80),
            createTextField('varietyId', true, 80),
            createTextField('productGroupName', true, 160),
            createTextField('varietyName', true, 160),
            createTextField('size', true, 80),
            createTextField('quality', true, 80),
            createTextField('state', true, 80),
            createNumberField('quantity', true),
            createNumberField('price', true),
            createNumberField('cogs', true),
            createTextField('unit', true, 20),
            createTextField('customer', true, 160),
            createTextField('destination', true, 255),
            createTextField('locationQuery', false, 255),
            createTextField('status', true, 80),
            createTextField('paymentStatus', true, 80),
            createTextField('paymentMethod', true, 80),
            createTextField('paymentNotes', false, 1000),
            createTextField('assignedEmployeeId', false, 80),
            createTextField('timestamp', true, 40),
            createTextField('deliveryDeadline', true, 40),
        ],
        [
            'CREATE UNIQUE INDEX idx_fideo_sale_workspace_external ON fideo_sales (workspace, externalId)',
            'CREATE INDEX idx_fideo_sale_workspace_status_timestamp ON fideo_sales (workspace, status, timestamp)',
        ],
    );
    app.save(sales);

    const payments = createCollection(
        'fideo_payments',
        [
            createWorkspaceField(),
            createExternalIdField(),
            createTextField('customerId', true, 80),
            createNumberField('amount', true),
            createTextField('date', true, 40),
            createTextField('saleId', false, 80),
        ],
        [
            'CREATE UNIQUE INDEX idx_fideo_payment_workspace_external ON fideo_payments (workspace, externalId)',
            'CREATE INDEX idx_fideo_payment_workspace_customer_date ON fideo_payments (workspace, customerId, date)',
        ],
    );
    app.save(payments);

    const crateLoans = createCollection(
        'fideo_crate_loans',
        [
            createWorkspaceField(),
            createExternalIdField(),
            createTextField('customer', true, 160),
            createTextField('crateTypeId', true, 80),
            createNumberField('quantity', true),
            createTextField('timestamp', true, 40),
            createTextField('dueDate', true, 40),
            createTextField('status', true, 80),
        ],
        [
            'CREATE UNIQUE INDEX idx_fideo_crate_loan_workspace_external ON fideo_crate_loans (workspace, externalId)',
            'CREATE INDEX idx_fideo_crate_loan_workspace_customer_status ON fideo_crate_loans (workspace, customer, status)',
        ],
    );
    app.save(crateLoans);

    const employeeActivities = createCollection(
        'fideo_employee_activities',
        [
            createWorkspaceField(),
            createExternalIdField(),
            createTextField('employee', true, 160),
            createTextField('activity', true, 255),
            createTextField('timestamp', true, 40),
        ],
        [
            'CREATE UNIQUE INDEX idx_fideo_employee_activity_workspace_external ON fideo_employee_activities (workspace, externalId)',
            'CREATE INDEX idx_fideo_employee_activity_workspace_employee_timestamp ON fideo_employee_activities (workspace, employee, timestamp)',
        ],
    );
    app.save(employeeActivities);

    const activityLogs = createCollection(
        'fideo_activity_logs',
        [
            createWorkspaceField(),
            createExternalIdField(),
            createTextField('type', true, 80),
            createTextField('timestamp', true, 40),
            createTextField('description', true, 500),
            {
                name: 'details',
                type: 'json',
                required: false,
            },
        ],
        [
            'CREATE UNIQUE INDEX idx_fideo_activity_log_workspace_external ON fideo_activity_logs (workspace, externalId)',
            'CREATE INDEX idx_fideo_activity_log_workspace_type_timestamp ON fideo_activity_logs (workspace, type, timestamp)',
        ],
    );
    app.save(activityLogs);

    const cashDrawers = createCollection(
        'fideo_cash_drawers',
        [
            createWorkspaceField(),
            createExternalIdField(),
            createTextField('name', true, 160),
            createNumberField('balance', true),
            createTextField('status', true, 40),
            createTextField('lastOpened', false, 40),
            createTextField('lastClosed', false, 40),
        ],
        [
            'CREATE UNIQUE INDEX idx_fideo_cash_drawer_workspace_external ON fideo_cash_drawers (workspace, externalId)',
            'CREATE INDEX idx_fideo_cash_drawer_workspace_status ON fideo_cash_drawers (workspace, status)',
        ],
    );
    app.save(cashDrawers);

    const cashDrawerActivities = createCollection(
        'fideo_cash_drawer_activities',
        [
            createWorkspaceField(),
            createExternalIdField(),
            createTextField('drawerId', true, 80),
            createTextField('type', true, 80),
            createNumberField('amount', true),
            createTextField('timestamp', true, 40),
            createTextField('notes', false, 1000),
            createTextField('relatedId', false, 80),
        ],
        [
            'CREATE UNIQUE INDEX idx_fideo_cash_drawer_activity_workspace_external ON fideo_cash_drawer_activities (workspace, externalId)',
            'CREATE INDEX idx_fideo_cash_drawer_activity_workspace_drawer_timestamp ON fideo_cash_drawer_activities (workspace, drawerId, timestamp)',
        ],
    );
    app.save(cashDrawerActivities);
}, (app) => {
    const deleteCollection = (name) => {
        try {
            app.delete(app.findCollectionByNameOrId(name));
        } catch (_) {}
    };

    deleteCollection('fideo_cash_drawer_activities');
    deleteCollection('fideo_cash_drawers');
    deleteCollection('fideo_activity_logs');
    deleteCollection('fideo_employee_activities');
    deleteCollection('fideo_crate_loans');
    deleteCollection('fideo_payments');
    deleteCollection('fideo_sales');
});
