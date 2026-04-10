export interface User {
    id: number;
    username: string;
}

export interface Account {
    id: number;
    name: string;
    currency: 'COP' | 'PEN';
    country: string;
    user_id: number;
}

export interface Card {
    id: number;
    name: string;
    type: 'CREDIT' | 'DEBIT';
    credit_limit?: number;
    currency: string;
    user_id: number;
    payment_account_id?: number;
    monthly_payment_budget: number;
}

export interface Category {
    id: number;
    name: string;
    type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
    user_id: number;
}

export interface Transaction {
    id: number;
    date: string; // ISO String
    amount: number;
    description: string;
    account_id?: number;
    card_id?: number;
    category_id: number;
    recurring_item_id?: number;
    budget_obligation_id?: number;
    user_id: number;
}

export interface RecurringItem {
    id: number;
    name: string;
    amount: number;
    type: 'SERVICE' | 'DEBT';
    due_day: number;
    is_active: boolean;
    category_id: number;
    account_id?: number;
    card_id?: number;
    notes?: string;
    start_year: number;
    start_month: number;
    user_id: number;
}

export interface BudgetObligation {
    id: number;
    year: number;
    month: number;
    name: string;
    amount: number;
    due_day: number;
    notes?: string;
    category_id: number;
    account_id?: number;
    card_id?: number;
    recurring_item_id?: number;
    user_id: number;
}

export interface GlobalBudget {
    id: number;
    year: number;
    month: number;
    total_amount: number;
    account_id: number;
    user_id: number;
}

export interface CategoryBudget {
    id: number;
    year: number;
    month: number;
    amount: number;
    category_id: number;
    account_id: number;
    user_id: number;
}

export interface CardBudget {
    id: number;
    year: number;
    month: number;
    amount: number;
    card_id: number;
    account_id: number;
    user_id: number;
}
