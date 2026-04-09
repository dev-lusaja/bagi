import { Account, Transaction, Card, Category, RecurringItem, BudgetObligation, GlobalBudget, CategoryBudget, CardBudget } from '../entities';

export interface IBudgetRepository {
    // Accounts
    getAccounts(): Promise<Account[]>;
    saveAccount(account: Omit<Account, 'id'>): Promise<Account>;
    updateAccount(id: number, account: Partial<Account>): Promise<Account>;
    deleteAccount(id: number): Promise<void>;

    // Transactions
    getTransactions(filters?: any): Promise<Transaction[]>;
    saveTransaction(transaction: Omit<Transaction, 'id'>): Promise<Transaction>;
    deleteTransaction(id: number): Promise<void>;

    // Cards
    getCards(): Promise<Card[]>;
    saveCard(card: Omit<Card, 'id'>): Promise<Card>;
    updateCard(id: number, card: Partial<Card>): Promise<Card>;
    deleteCard(id: number): Promise<void>;

    // Categories
    getCategories(): Promise<Category[]>;
    saveCategory(category: Omit<Category, 'id'>): Promise<Category>;
    deleteCategory(id: number): Promise<void>;

    // Recurring Items
    getRecurringItems(): Promise<RecurringItem[]>;
    saveRecurringItem(item: Omit<RecurringItem, 'id'>): Promise<RecurringItem>;
    updateRecurringItem(id: number, item: Partial<RecurringItem>): Promise<RecurringItem>;
    deleteRecurringItem(id: number): Promise<void>;

    // Budget Obligations
    getBudgetObligations(year: number, month: number): Promise<BudgetObligation[]>;
    saveBudgetObligation(item: Omit<BudgetObligation, 'id'>): Promise<BudgetObligation>;
    updateBudgetObligation(id: number, item: Partial<BudgetObligation>): Promise<BudgetObligation>;
    deleteBudgetObligation(id: number): Promise<void>;

    // Budgets
    getGlobalBudgets(year: number, month: number): Promise<GlobalBudget[]>;
    saveGlobalBudget(budget: Omit<GlobalBudget, 'id'>): Promise<GlobalBudget>;
    updateGlobalBudget(id: number, budget: Partial<GlobalBudget>): Promise<GlobalBudget>;

    getCategoryBudgets(year: number, month: number): Promise<CategoryBudget[]>;
    saveCategoryBudget(budget: Omit<CategoryBudget, 'id'>): Promise<CategoryBudget>;
    deleteCategoryBudget(id: number): Promise<void>;

    getCardBudgets(year: number, month: number): Promise<CardBudget[]>;
    saveCardBudget(budget: Omit<CardBudget, 'id'>): Promise<CardBudget>;
    deleteCardBudget(id: number): Promise<void>;

    // Database Management
    initializeDatabase(sqlFile?: ArrayBuffer): Promise<void>;
    exportDatabase(): Promise<Uint8Array>;
}
