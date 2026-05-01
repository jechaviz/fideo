migrate((app) => {
    const users = app.findCollectionByNameOrId('fideo_users');

    users.fields.add(new TextField({
        name: 'employeeId',
        required: false,
        max: 80,
    }));

    users.fields.add(new TextField({
        name: 'pushExternalId',
        required: false,
        max: 128,
    }));

    app.save(users);
}, (app) => {
    const users = app.findCollectionByNameOrId('fideo_users');

    users.fields.removeByName('employeeId');
    users.fields.removeByName('pushExternalId');

    app.save(users);
});
