migrate((app) => {
    const sales = app.findCollectionByNameOrId('fideo_sales');
    sales.fields.add(new TextField({
        name: 'customerId',
        required: false,
        max: 80,
    }));
    app.save(sales);

    const crateLoans = app.findCollectionByNameOrId('fideo_crate_loans');
    crateLoans.fields.add(new TextField({
        name: 'customerId',
        required: false,
        max: 80,
    }));
    app.save(crateLoans);
}, (app) => {
    const sales = app.findCollectionByNameOrId('fideo_sales');
    sales.fields.removeByName('customerId');
    app.save(sales);

    const crateLoans = app.findCollectionByNameOrId('fideo_crate_loans');
    crateLoans.fields.removeByName('customerId');
    app.save(crateLoans);
});
