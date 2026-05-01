migrate((app) => {
    const toText = (value) => (value === undefined || value === null || value === '' ? '' : String(value));
    const toArray = (value) => (Array.isArray(value) ? value : []);
    const toObject = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {});

    const buildUniqueCustomersByName = (items) => {
        const unique = {};
        const duplicate = {};

        toArray(items).forEach((customer) => {
            const name = toText(customer && customer.name);
            if (!name) return;
            if (unique[name]) {
                duplicate[name] = true;
                return;
            }
            unique[name] = customer;
        });

        Object.keys(duplicate).forEach((name) => {
            delete unique[name];
        });

        return unique;
    };

    const backfillSnapshot = (snapshot) => {
        const normalized = Object.assign({}, toObject(snapshot));
        const customersByName = buildUniqueCustomersByName(normalized.customers);

        normalized.sales = toArray(normalized.sales).map((sale) => {
            if (toText(sale && sale.customerId)) return sale;
            const customer = customersByName[toText(sale && sale.customer)];
            if (!customer) return sale;
            return Object.assign({}, sale, { customerId: toText(customer.id) });
        });

        normalized.crateLoans = toArray(normalized.crateLoans).map((loan) => {
            if (toText(loan && loan.customerId)) return loan;
            const customer = customersByName[toText(loan && loan.customer)];
            if (!customer) return loan;
            return Object.assign({}, loan, { customerId: toText(customer.id) });
        });

        return normalized;
    };

    const snapshots = app.findRecordsByFilter('fideo_state_snapshots', '', '', 500, 0);
    snapshots.forEach((record) => {
        const normalizedSnapshot = backfillSnapshot(record.get('snapshot'));
        record.set('snapshot', normalizedSnapshot);
        app.save(record);
    });

    const snapshotByWorkspace = {};
    snapshots.forEach((record) => {
        snapshotByWorkspace[toText(record.get('workspace'))] = backfillSnapshot(record.get('snapshot'));
    });

    const sales = app.findRecordsByFilter('fideo_sales', '', '', 2000, 0);
    sales.forEach((record) => {
        if (toText(record.get('customerId'))) return;
        const workspaceId = toText(record.get('workspace'));
        const snapshot = snapshotByWorkspace[workspaceId];
        const customersByName = buildUniqueCustomersByName(snapshot && snapshot.customers);
        const customer = customersByName[toText(record.get('customer'))];
        if (!customer) return;
        record.set('customerId', toText(customer.id));
        app.save(record);
    });

    const crateLoans = app.findRecordsByFilter('fideo_crate_loans', '', '', 2000, 0);
    crateLoans.forEach((record) => {
        if (toText(record.get('customerId'))) return;
        const workspaceId = toText(record.get('workspace'));
        const snapshot = snapshotByWorkspace[workspaceId];
        const customersByName = buildUniqueCustomersByName(snapshot && snapshot.customers);
        const customer = customersByName[toText(record.get('customer'))];
        if (!customer) return;
        record.set('customerId', toText(customer.id));
        app.save(record);
    });
}, (_app) => {
    // Irreversible data backfill.
});
