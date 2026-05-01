migrate((app) => {
    const workspaces = app.findCollectionByNameOrId('fideo_workspaces');

    const productGroups = new Collection({
        type: 'base',
        name: 'fideo_product_groups',
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
                max: 80,
            },
            {
                name: 'name',
                type: 'text',
                required: true,
                max: 120,
            },
            {
                name: 'icon',
                type: 'text',
                required: false,
                max: 40,
            },
            {
                name: 'category',
                type: 'text',
                required: false,
                max: 120,
            },
            {
                name: 'unit',
                type: 'text',
                required: true,
                max: 20,
            },
            {
                name: 'archived',
                type: 'bool',
                required: false,
            },
            {
                name: 'varieties',
                type: 'json',
                required: true,
            },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_fideo_product_group_workspace_external ON fideo_product_groups (workspace, externalId)'],
    });
    app.save(productGroups);

    const warehouses = new Collection({
        type: 'base',
        name: 'fideo_warehouses',
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
                max: 80,
            },
            {
                name: 'name',
                type: 'text',
                required: true,
                max: 255,
            },
            {
                name: 'icon',
                type: 'text',
                required: false,
                max: 40,
            },
            {
                name: 'archived',
                type: 'bool',
                required: false,
            },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_fideo_warehouse_workspace_external ON fideo_warehouses (workspace, externalId)'],
    });
    app.save(warehouses);

    const prices = new Collection({
        type: 'base',
        name: 'fideo_prices',
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
                name: 'varietyId',
                type: 'text',
                required: true,
                max: 80,
            },
            {
                name: 'size',
                type: 'text',
                required: true,
                max: 80,
            },
            {
                name: 'quality',
                type: 'text',
                required: true,
                max: 80,
            },
            {
                name: 'state',
                type: 'text',
                required: true,
                max: 80,
            },
            {
                name: 'price',
                type: 'number',
                required: true,
            },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_fideo_price_workspace_key ON fideo_prices (workspace, varietyId, size, quality, state)'],
    });
    app.save(prices);

    const inventoryBatches = new Collection({
        type: 'base',
        name: 'fideo_inventory_batches',
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
                max: 80,
            },
            {
                name: 'varietyId',
                type: 'text',
                required: true,
                max: 80,
            },
            {
                name: 'size',
                type: 'text',
                required: true,
                max: 80,
            },
            {
                name: 'quality',
                type: 'text',
                required: true,
                max: 80,
            },
            {
                name: 'quantity',
                type: 'number',
                required: true,
            },
            {
                name: 'state',
                type: 'text',
                required: true,
                max: 80,
            },
            {
                name: 'location',
                type: 'text',
                required: true,
                max: 120,
            },
            {
                name: 'warehouseId',
                type: 'text',
                required: true,
                max: 80,
            },
            {
                name: 'packagingId',
                type: 'text',
                required: false,
                max: 80,
            },
            {
                name: 'entryDate',
                type: 'text',
                required: true,
                max: 40,
            },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_fideo_inventory_workspace_external ON fideo_inventory_batches (workspace, externalId)'],
    });
    app.save(inventoryBatches);

    const customers = new Collection({
        type: 'base',
        name: 'fideo_customers',
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
                max: 80,
            },
            {
                name: 'name',
                type: 'text',
                required: true,
                max: 160,
            },
            {
                name: 'contacts',
                type: 'json',
                required: true,
            },
            {
                name: 'specialPrices',
                type: 'json',
                required: true,
            },
            {
                name: 'schedule',
                type: 'json',
                required: false,
            },
            {
                name: 'deliveryNotes',
                type: 'text',
                required: false,
                max: 1000,
            },
            {
                name: 'creditStatus',
                type: 'text',
                required: true,
                max: 80,
            },
            {
                name: 'creditLimit',
                type: 'number',
                required: false,
            },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_fideo_customer_workspace_external ON fideo_customers (workspace, externalId)'],
    });
    app.save(customers);

    const suppliers = new Collection({
        type: 'base',
        name: 'fideo_suppliers',
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
                max: 80,
            },
            {
                name: 'name',
                type: 'text',
                required: true,
                max: 160,
            },
            {
                name: 'contact',
                type: 'text',
                required: false,
                max: 160,
            },
            {
                name: 'supplies',
                type: 'json',
                required: true,
            },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_fideo_supplier_workspace_external ON fideo_suppliers (workspace, externalId)'],
    });
    app.save(suppliers);

    const purchaseOrders = new Collection({
        type: 'base',
        name: 'fideo_purchase_orders',
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
                max: 80,
            },
            {
                name: 'supplierId',
                type: 'text',
                required: true,
                max: 80,
            },
            {
                name: 'varietyId',
                type: 'text',
                required: true,
                max: 80,
            },
            {
                name: 'size',
                type: 'text',
                required: true,
                max: 80,
            },
            {
                name: 'packaging',
                type: 'text',
                required: true,
                max: 80,
            },
            {
                name: 'quantity',
                type: 'number',
                required: true,
            },
            {
                name: 'totalCost',
                type: 'number',
                required: true,
            },
            {
                name: 'status',
                type: 'text',
                required: true,
                max: 80,
            },
            {
                name: 'orderDate',
                type: 'text',
                required: true,
                max: 40,
            },
            {
                name: 'expectedArrivalDate',
                type: 'text',
                required: false,
                max: 40,
            },
            {
                name: 'paymentMethod',
                type: 'text',
                required: true,
                max: 80,
            },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_fideo_purchase_order_workspace_external ON fideo_purchase_orders (workspace, externalId)'],
    });
    app.save(purchaseOrders);
}, (app) => {
    try {
        app.delete(app.findCollectionByNameOrId('fideo_purchase_orders'));
    } catch (_) {}

    try {
        app.delete(app.findCollectionByNameOrId('fideo_suppliers'));
    } catch (_) {}

    try {
        app.delete(app.findCollectionByNameOrId('fideo_customers'));
    } catch (_) {}

    try {
        app.delete(app.findCollectionByNameOrId('fideo_inventory_batches'));
    } catch (_) {}

    try {
        app.delete(app.findCollectionByNameOrId('fideo_prices'));
    } catch (_) {}

    try {
        app.delete(app.findCollectionByNameOrId('fideo_warehouses'));
    } catch (_) {}

    try {
        app.delete(app.findCollectionByNameOrId('fideo_product_groups'));
    } catch (_) {}
});
