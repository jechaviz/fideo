migrate((app) => {
    const snapshots = app.findCollectionByNameOrId('fideo_state_snapshots');
    const snapshotField = snapshots.fields.getByName('snapshot');
    snapshotField.maxSize = 10485760; // 10MB
    app.save(snapshots);

    const actionLogs = app.findCollectionByNameOrId('fideo_action_logs');
    const payloadField = actionLogs.fields.getByName('payload');
    payloadField.maxSize = 10485760; // 10MB
    app.save(actionLogs);
}, (app) => {
    const snapshots = app.findCollectionByNameOrId('fideo_state_snapshots');
    const snapshotField = snapshots.fields.getByName('snapshot');
    snapshotField.maxSize = 1048576; // 1MB
    app.save(snapshots);

    const actionLogs = app.findCollectionByNameOrId('fideo_action_logs');
    const payloadField = actionLogs.fields.getByName('payload');
    payloadField.maxSize = 1048576; // 1MB
    app.save(actionLogs);
});
