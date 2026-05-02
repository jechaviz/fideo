migrate((app) => {
    const maxJsonSize = 52428800; // 50MB

    const snapshots = app.findCollectionByNameOrId('fideo_state_snapshots');
    const snapshotField = snapshots.fields.getByName('snapshot');
    snapshotField.maxSize = maxJsonSize;
    app.save(snapshots);

    const actionLogs = app.findCollectionByNameOrId('fideo_action_logs');
    const payloadField = actionLogs.fields.getByName('payload');
    payloadField.maxSize = maxJsonSize;
    app.save(actionLogs);
}, (app) => {
    const previousJsonSize = 10485760; // 10MB

    const snapshots = app.findCollectionByNameOrId('fideo_state_snapshots');
    const snapshotField = snapshots.fields.getByName('snapshot');
    snapshotField.maxSize = previousJsonSize;
    app.save(snapshots);

    const actionLogs = app.findCollectionByNameOrId('fideo_action_logs');
    const payloadField = actionLogs.fields.getByName('payload');
    payloadField.maxSize = previousJsonSize;
    app.save(actionLogs);
});
