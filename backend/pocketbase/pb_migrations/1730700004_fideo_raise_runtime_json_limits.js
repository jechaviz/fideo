migrate((app) => {
    const LARGE_JSON = 52428800; // 50MB

    const setMaxSize = (collectionName, fieldName, maxSize) => {
        const collection = app.findCollectionByNameOrId(collectionName);
        const field = collection.fields.getByName(fieldName);
        field.maxSize = maxSize;
        app.save(collection);
    };

    setMaxSize('fideo_state_snapshots', 'snapshot', LARGE_JSON);
    setMaxSize('fideo_action_logs', 'payload', LARGE_JSON);
    setMaxSize('fideo_product_groups', 'varieties', LARGE_JSON);
    setMaxSize('fideo_customers', 'contacts', LARGE_JSON);
    setMaxSize('fideo_customers', 'specialPrices', LARGE_JSON);
    setMaxSize('fideo_customers', 'schedule', LARGE_JSON);
    setMaxSize('fideo_suppliers', 'supplies', LARGE_JSON);
    setMaxSize('fideo_activity_logs', 'details', LARGE_JSON);
    setMaxSize('fideo_task_assignments', 'payload', LARGE_JSON);
    setMaxSize('fideo_task_reports', 'payload', LARGE_JSON);
}, (app) => {
    const SNAPSHOT_JSON = 10485760; // 10MB
    const DEFAULT_JSON = 1048576; // 1MB

    const setMaxSize = (collectionName, fieldName, maxSize) => {
        const collection = app.findCollectionByNameOrId(collectionName);
        const field = collection.fields.getByName(fieldName);
        field.maxSize = maxSize;
        app.save(collection);
    };

    setMaxSize('fideo_state_snapshots', 'snapshot', SNAPSHOT_JSON);
    setMaxSize('fideo_action_logs', 'payload', SNAPSHOT_JSON);
    setMaxSize('fideo_product_groups', 'varieties', DEFAULT_JSON);
    setMaxSize('fideo_customers', 'contacts', DEFAULT_JSON);
    setMaxSize('fideo_customers', 'specialPrices', DEFAULT_JSON);
    setMaxSize('fideo_customers', 'schedule', DEFAULT_JSON);
    setMaxSize('fideo_suppliers', 'supplies', DEFAULT_JSON);
    setMaxSize('fideo_activity_logs', 'details', DEFAULT_JSON);
    setMaxSize('fideo_task_assignments', 'payload', DEFAULT_JSON);
    setMaxSize('fideo_task_reports', 'payload', DEFAULT_JSON);
});
