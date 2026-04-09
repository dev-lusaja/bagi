import { IBudgetRepository } from '../../domain/repositories/IBudgetRepository';
import { Account, Transaction, Card, Category, RecurringItem, BudgetObligation, GlobalBudget, CategoryBudget, CardBudget } from '../../domain/entities';
import { initDb, getDb } from '../adapters/SqliteAdapter';

export class SqliteBudgetRepository implements IBudgetRepository {
    async initializeDatabase(sqlFile?: ArrayBuffer): Promise<void> {
        await initDb(sqlFile);
    }

    async exportDatabase(): Promise<Uint8Array> {
        return getDb().export();
    }

    private query<T>(sql: string, params: any[] = []): T[] {
        const db = getDb();
        const safeParams = params.map(p => p === undefined ? null : p);
        try {
            const stmt = db.prepare(sql);
            stmt.bind(safeParams);
            const results: T[] = [];
            while (stmt.step()) {
                results.push(stmt.getAsObject() as T);
            }
            stmt.free();
            return results;
        } catch (err) {
            console.error(`[SQL Error] %c${sql}`, 'color: #ef4444', err);
            throw err;
        }
    }

    private execute(sql: string, params: any[] = []): void {
        const db = getDb();
        const safeParams = params.map(p => p === undefined ? null : p);
        try {
            db.run(sql, safeParams);
        } catch (err) {
            console.error(`[SQL Error] %c${sql}`, 'color: #ef4444', err);
            throw err;
        }
    }

    private getLastInsertId(): number {
        const res = this.query<{ id: number }>('SELECT last_insert_rowid() as id');
        return res[0].id;
    }

    // Accounts
    async getAccounts(): Promise<Account[]> {
        return this.query<Account>('SELECT * FROM accounts');
    }

    async saveAccount(account: Omit<Account, 'id'>): Promise<Account> {
        this.execute(
            'INSERT INTO accounts (name, currency, country, user_id) VALUES (?, ?, ?, ?)',
            [account.name, account.currency, account.country, account.user_id]
        );
        return { ...account, id: this.getLastInsertId() };
    }

    async updateAccount(id: number, account: Partial<Account>): Promise<Account> {
        const keys = Object.keys(account).filter(k => k !== 'id');
        const setClause = keys.map(k => `${k} = ?`).join(', ');
        const values = keys.map(k => (account as any)[k]);
        this.execute(`UPDATE accounts SET ${setClause} WHERE id = ?`, [...values, id]);
        const res = this.query<Account>('SELECT * FROM accounts WHERE id = ?', [id]);
        return res[0];
    }

    async deleteAccount(id: number): Promise<void> {
        this.execute('DELETE FROM accounts WHERE id = ?', [id]);
    }

    // Transactions
    async getTransactions(filters?: any): Promise<any[]> {
        let sql = `
            SELECT t.*, 
                   cat.name as category_name, cat.type as category_type,
                   acc.name as account_name, acc.currency as account_currency,
                   crd.name as card_name, crd.currency as card_currency
            FROM transactions t
            LEFT JOIN categories cat ON t.category_id = cat.id
            LEFT JOIN accounts acc ON t.account_id = acc.id
            LEFT JOIN cards crd ON t.card_id = crd.id
            WHERE 1=1
        `;
        const params: any[] = [];
        if (filters?.account_id) {
            sql += ' AND t.account_id = ?';
            params.push(filters.account_id);
        }
        if (filters?.card_id) {
            sql += ' AND t.card_id = ?';
            params.push(filters.card_id);
        }
        if (filters?.category_id) {
            sql += ' AND t.category_id = ?';
            params.push(filters.category_id);
        }
        if (filters?.currency) {
            sql += ' AND (acc.currency = ? OR crd.currency = ?)';
            params.push(filters.currency, filters.currency);
        }

        // Date filtering (YYYY-MM-DD or partial ISO)
        if (filters?.year && filters?.month) {
            const monthStr = filters.month.toString().padStart(2, '0');
            const pattern = `${filters.year}-${monthStr}-%`;
            sql += " AND t.date LIKE ?";
            params.push(pattern);
        } else if (filters?.year) {
            const pattern = `${filters.year}-%`;
            sql += " AND t.date LIKE ?";
            params.push(pattern);
        }

        sql += ' ORDER BY t.date DESC, t.id DESC';
        
        if (filters?.limit) {
            sql += ' LIMIT ?';
            params.push(filters.limit);
            if (filters?.offset) {
                sql += ' OFFSET ?';
                params.push(filters.offset);
            }
        } else if (!filters?.noLimit) {
            // Default limit for safety if not specified
            sql += ' LIMIT 100';
        }
        
        const rawResults = this.query<any>(sql, params);
        
        return rawResults.map(r => ({
            ...r,
            category: { id: r.category_id, name: r.category_name, type: r.category_type },
            account: r.account_id ? { id: r.account_id, name: r.account_name, currency: r.account_currency } : null,
            card: r.card_id ? { id: r.card_id, name: r.card_name, currency: r.card_currency } : null
        }));
    }

    async saveTransaction(transaction: Omit<Transaction, 'id'>): Promise<Transaction> {
        this.execute(
            'INSERT INTO transactions (date, amount, description, account_id, card_id, category_id, recurring_item_id, budget_obligation_id, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                transaction.date, transaction.amount, transaction.description,
                transaction.account_id ?? null, transaction.card_id ?? null, transaction.category_id ?? null,
                transaction.recurring_item_id ?? null, transaction.budget_obligation_id ?? null, transaction.user_id
            ]
        );
        return { ...transaction, id: this.getLastInsertId() };
    }

    async deleteTransaction(id: number): Promise<void> {
        this.execute('DELETE FROM transactions WHERE id = ?', [id]);
    }

    // Cards
    async getCards(): Promise<Card[]> {
        return this.query<Card>('SELECT * FROM cards');
    }

    async saveCard(card: Omit<Card, 'id'>): Promise<Card> {
        this.execute(
            'INSERT INTO cards (name, type, credit_limit, currency, user_id, payment_account_id, monthly_payment_budget) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [card.name, card.type, card.credit_limit ?? null, card.currency, card.user_id, card.payment_account_id ?? null, card.monthly_payment_budget ?? null]
        );
        return { ...card, id: this.getLastInsertId() };
    }

    async updateCard(id: number, card: Partial<Card>): Promise<Card> {
        const keys = Object.keys(card).filter(k => k !== 'id');
        const setClause = keys.map(k => `${k} = ?`).join(', ');
        const values = keys.map(k => (card as any)[k]);
        this.execute(`UPDATE cards SET ${setClause} WHERE id = ?`, [...values, id]);
        const res = this.query<Card>('SELECT * FROM cards WHERE id = ?', [id]);
        return res[0];
    }

    async deleteCard(id: number): Promise<void> {
        this.execute('DELETE FROM cards WHERE id = ?', [id]);
    }

    // Categories
    async getCategories(): Promise<Category[]> {
        return this.query<Category>('SELECT * FROM categories');
    }

    async saveCategory(category: Omit<Category, 'id'>): Promise<Category> {
        this.execute(
            'INSERT INTO categories (name, type, user_id) VALUES (?, ?, ?)',
            [category.name, category.type, category.user_id]
        );
        return { ...category, id: this.getLastInsertId() };
    }

    async deleteCategory(id: number): Promise<void> {
        this.execute('DELETE FROM categories WHERE id = ?', [id]);
    }

    // Recurring Items
    async getRecurringItems(): Promise<RecurringItem[]> {
        return this.query<RecurringItem>('SELECT * FROM recurring_items');
    }

    async saveRecurringItem(item: Omit<RecurringItem, 'id'>): Promise<RecurringItem> {
        this.execute(
            'INSERT INTO recurring_items (name, amount, type, due_day, is_active, category_id, account_id, card_id, notes, start_year, start_month, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [item.name, item.amount, item.type, item.due_day, item.is_active ? 1 : 0, item.category_id ?? null, item.account_id ?? null, item.card_id ?? null, item.notes ?? null, item.start_year, item.start_month, item.user_id]
        );
        return { ...item, id: this.getLastInsertId() };
    }

    async updateRecurringItem(id: number, item: Partial<RecurringItem>): Promise<RecurringItem> {
        const keys = Object.keys(item).filter(k => k !== 'id');
        const setClause = keys.map(k => `${k} = ?`).join(', ');
        const values = keys.map(k => (item as any)[k]);
        this.execute(`UPDATE recurring_items SET ${setClause} WHERE id = ?`, [...values, id]);
        const res = this.query<RecurringItem>('SELECT * FROM recurring_items WHERE id = ?', [id]);
        return res[0];
    }

    async deleteRecurringItem(id: number): Promise<void> {
        this.execute('DELETE FROM recurring_items WHERE id = ?', [id]);
    }

    // Budget Obligations
    async getBudgetObligations(year: number, month: number): Promise<BudgetObligation[]> {
        return this.query<BudgetObligation>('SELECT * FROM budget_obligations WHERE year = ? AND month = ?', [year, month]);
    }

    async saveBudgetObligation(item: Omit<BudgetObligation, 'id'>): Promise<BudgetObligation> {
        this.execute(
            'INSERT INTO budget_obligations (year, month, name, amount, due_day, notes, category_id, account_id, card_id, recurring_item_id, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [item.year, item.month, item.name, item.amount, item.due_day, item.notes ?? null, item.category_id ?? null, item.account_id ?? null, item.card_id ?? null, item.recurring_item_id ?? null, item.user_id]
        );
        return { ...item, id: this.getLastInsertId() };
    }

    async updateBudgetObligation(id: number, item: Partial<BudgetObligation>): Promise<BudgetObligation> {
        const keys = Object.keys(item).filter(k => k !== 'id');
        const setClause = keys.map(k => `${k} = ?`).join(', ');
        const values = keys.map(k => (item as any)[k]);
        this.execute(`UPDATE budget_obligations SET ${setClause} WHERE id = ?`, [...values, id]);
        const res = this.query<BudgetObligation>('SELECT * FROM budget_obligations WHERE id = ?', [id]);
        return res[0];
    }

    async deleteBudgetObligation(id: number): Promise<void> {
        this.execute('DELETE FROM budget_obligations WHERE id = ?', [id]);
    }

    // Budgets
    async getGlobalBudgets(year: number, month: number): Promise<GlobalBudget[]> {
        return this.query<GlobalBudget>('SELECT * FROM global_budgets WHERE year = ? AND month = ?', [year, month]);
    }

    async saveGlobalBudget(budget: Omit<GlobalBudget, 'id'>): Promise<GlobalBudget> {
        this.execute(
            'INSERT INTO global_budgets (year, month, total_amount, account_id, user_id) VALUES (?, ?, ?, ?, ?)',
            [budget.year, budget.month, budget.total_amount, budget.account_id ?? null, budget.user_id]
        );
        return { ...budget, id: this.getLastInsertId() };
    }

    async updateGlobalBudget(id: number, budget: Partial<GlobalBudget>): Promise<GlobalBudget> {
        const keys = Object.keys(budget).filter(k => k !== 'id');
        const setClause = keys.map(k => `${k} = ?`).join(', ');
        const values = keys.map(k => (budget as any)[k]);
        this.execute(`UPDATE global_budgets SET ${setClause} WHERE id = ?`, [...values, id]);
        const res = this.query<GlobalBudget>('SELECT * FROM global_budgets WHERE id = ?', [id]);
        return res[0];
    }

    async getCategoryBudgets(year: number, month: number): Promise<CategoryBudget[]> {
        return this.query<CategoryBudget>('SELECT * FROM category_budgets WHERE year = ? AND month = ?', [year, month]);
    }

    async saveCategoryBudget(budget: Omit<CategoryBudget, 'id'>): Promise<CategoryBudget> {
        this.execute(
            'INSERT INTO category_budgets (year, month, amount, category_id, account_id, user_id) VALUES (?, ?, ?, ?, ?, ?)',
            [budget.year, budget.month, budget.amount, budget.category_id ?? null, budget.account_id ?? null, budget.user_id]
        );
        return { ...budget, id: this.getLastInsertId() };
    }

    async deleteCategoryBudget(id: number): Promise<void> {
        this.execute('DELETE FROM category_budgets WHERE id = ?', [id]);
    }

    async getCardBudgets(year: number, month: number): Promise<CardBudget[]> {
        return this.query<CardBudget>('SELECT * FROM card_budgets WHERE year = ? AND month = ?', [year, month]);
    }

    async saveCardBudget(budget: Omit<CardBudget, 'id'>): Promise<CardBudget> {
        this.execute(
            'INSERT INTO card_budgets (year, month, amount, card_id, account_id, user_id) VALUES (?, ?, ?, ?, ?, ?)',
            [budget.year, budget.month, budget.amount, budget.card_id ?? null, budget.account_id ?? null, budget.user_id]
        );
        return { ...budget, id: this.getLastInsertId() };
    }

    async deleteCardBudget(id: number): Promise<void> {
        this.execute('DELETE FROM card_budgets WHERE id = ?', [id]);
    }
}
