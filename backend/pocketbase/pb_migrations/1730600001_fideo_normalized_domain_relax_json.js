migrate((app) => {
    const productGroups = app.findCollectionByNameOrId('fideo_product_groups');
    const varietiesField = productGroups.fields.getByName('varieties');
    varietiesField.required = false;
    app.save(productGroups);

    const customers = app.findCollectionByNameOrId('fideo_customers');
    const contactsField = customers.fields.getByName('contacts');
    const specialPricesField = customers.fields.getByName('specialPrices');
    contactsField.required = false;
    specialPricesField.required = false;
    app.save(customers);

    const suppliers = app.findCollectionByNameOrId('fideo_suppliers');
    const suppliesField = suppliers.fields.getByName('supplies');
    suppliesField.required = false;
    app.save(suppliers);
}, (app) => {
    const productGroups = app.findCollectionByNameOrId('fideo_product_groups');
    const varietiesField = productGroups.fields.getByName('varieties');
    varietiesField.required = true;
    app.save(productGroups);

    const customers = app.findCollectionByNameOrId('fideo_customers');
    const contactsField = customers.fields.getByName('contacts');
    const specialPricesField = customers.fields.getByName('specialPrices');
    contactsField.required = true;
    specialPricesField.required = true;
    app.save(customers);

    const suppliers = app.findCollectionByNameOrId('fideo_suppliers');
    const suppliesField = suppliers.fields.getByName('supplies');
    suppliesField.required = true;
    app.save(suppliers);
});
