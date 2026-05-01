import { CrateLoan, Customer, Sale } from '../types';

export const saleBelongsToCustomer = (sale: Sale, customer: Customer): boolean =>
    (sale.customerId && sale.customerId === customer.id) || (!sale.customerId && sale.customer === customer.name);

export const loanBelongsToCustomer = (loan: CrateLoan, customer: Customer): boolean =>
    (loan.customerId && loan.customerId === customer.id) || (!loan.customerId && loan.customer === customer.name);

export const findCustomerForSale = (customers: Customer[], sale: Sale): Customer | undefined => {
    if (sale.customerId) {
        return customers.find((customer) => customer.id === sale.customerId)
            || customers.find((customer) => customer.name === sale.customer);
    }

    return customers.find((customer) => customer.name === sale.customer);
};

export const findCustomerForLoan = (customers: Customer[], loan: CrateLoan): Customer | undefined => {
    if (loan.customerId) {
        return customers.find((customer) => customer.id === loan.customerId)
            || customers.find((customer) => customer.name === loan.customer);
    }

    return customers.find((customer) => customer.name === loan.customer);
};
