import { IBudgetRepository } from '../../domain/repositories/IBudgetRepository';
import { GoogleDriveAdapter } from '../../infrastructure/adapters/GoogleDriveAdapter';

const DEFAULT_CATEGORIES = [
    { name: "Salida de dinero al exterior", type: "EXPENSE" },
    { name: "Servicios", type: "EXPENSE" },
    { name: "Deudas", type: "EXPENSE" },
    { name: "Ahorros", type: "EXPENSE" },
    { name: "Otros gastos", type: "EXPENSE" },
    { name: "Mercado", type: "EXPENSE" },
    { name: "Restaurantes", type: "EXPENSE" },
    { name: "Transporte", type: "EXPENSE" },
    { name: "Gastos hormiga", type: "EXPENSE" },
    { name: "Ropa", type: "EXPENSE" },
    { name: "Efectivo", type: "EXPENSE" },
    { name: "Mascotas", type: "EXPENSE" },
    { name: "Gasolina", type: "EXPENSE" },
    { name: "Parqueadero", type: "EXPENSE" },
    { name: "Pago tarjeta de crédito", type: "TRANSFER" },
    { name: "Salario", type: "INCOME" },
    { name: "Otros ingresos", type: "INCOME" },
    { name: "Taxis", type: "EXPENSE" },
    { name: "Abono a tarjeta", type: "TRANSFER" },
] as const;

export class BudgetService {
    private repo: IBudgetRepository;
    private drive: GoogleDriveAdapter;
    private fileName = 'app_bagi.sqlite';
    private folderName = 'Bagi_app';
    private fileId: string | null = null;
    private folderId: string | null = null;
    private syncStrategy: 'immediate' | 'deferred' = 'deferred';
    private syncTimeout: any = null;
    private isSyncing = false;
    private pendingChanges = false;
    private onSyncStateChange: (isSyncing: boolean) => void = () => {};
    private SYNC_INTERVAL = 8000;
    private userInfo: { name: string; picture: string } | null = null;

    constructor(repo: IBudgetRepository, drive: GoogleDriveAdapter) {
        this.repo = repo;
        this.drive = drive;
    }

    async init() {
        await this.drive.init();
    }

    async completeAuthentication(): Promise<void> {
        this.folderId = await this.drive.getOrCreateFolder(this.folderName);
        this.fileId = await this.drive.findFile(this.fileName, this.folderId);
        
        if (this.fileId) {
            const buffer = await this.drive.downloadFile(this.fileId);
            await this.repo.initializeDatabase(buffer);
        } else {
            await this.repo.initializeDatabase();
            await this.seedCategories();
            await this.syncToDrive();
        }

        // Mantenimiento de categorías: asegurar categorías base
        await this.seedCategories();
        if (!this.userInfo) {
            this.userInfo = await this.drive.getUserInfo();
        }
    }

    async login(): Promise<void> {
        await this.drive.login();
        await this.completeAuthentication();
    }

    async tryRestoreSession(): Promise<boolean> {
        const info = await this.drive.tryRestoreSession();
        if (info) {
            this.userInfo = info;
            await this.completeAuthentication();
            return true;
        }
        return false;
    }

    async logout(): Promise<void> {
        this.drive.clearSession();
        this.userInfo = null;
    }

    setSyncConfig(strategy: 'immediate' | 'deferred') {
        this.syncStrategy = strategy;
    }

    private scheduleSave() {
        this.pendingChanges = true;
        if (this.syncTimeout) clearTimeout(this.syncTimeout);
        this.syncTimeout = setTimeout(() => this.syncToDrive(), this.SYNC_INTERVAL);
    }

    async syncToDrive() {
        if (this.isSyncing) return;
        this.onSyncStateChange(true);
        this.isSyncing = true;
        try {
            const data = await this.repo.exportDatabase();
            this.fileId = await this.drive.uploadFile(this.fileName, data, this.fileId, this.folderId);
            this.pendingChanges = false;
        } catch (error: any) {
            console.error('[Service] %cSync Failed', 'color: #ef4444', error);
            if (error.message === 'AUTH_ERROR') throw error;
        } finally {
            this.isSyncing = false;
            this.onSyncStateChange(false);
        }
    }

    async performOperation<T>(op: () => Promise<T>): Promise<T> {
        try {
            const result = await op();
            if (this.syncStrategy === 'immediate') {
                await this.syncToDrive();
            } else {
                this.scheduleSave();
            }
            return result;
        } catch (err) {
            console.error('[Service] Operation failed', err);
            throw err;
        }
    }

    // Proxy methods to repo with sync logic
    async getAccounts() { return this.repo.getAccounts(); }
    async addAccount(acc: any) { return this.performOperation(() => this.repo.saveAccount(acc)); }
    async updateAccount(id: number, acc: any) { return this.performOperation(() => this.repo.updateAccount(id, acc)); }
    async deleteAccount(id: number) { return this.performOperation(() => this.repo.deleteAccount(id)); }
    
    async getTransactions(filters?: any) { return this.repo.getTransactions(filters); }
    async addTransaction(tx: any) { return this.performOperation(() => this.repo.saveTransaction(tx)); }
    async deleteTransaction(id: number) { return this.performOperation(() => this.repo.deleteTransaction(id)); }

    async getCards() { return this.repo.getCards(); }
    async addCard(card: any) { return this.performOperation(() => this.repo.saveCard(card)); }
    async updateCard(id: number, card: any) { return this.performOperation(() => this.repo.updateCard(id, card)); }
    async deleteCard(id: number) { return this.performOperation(() => this.repo.deleteCard(id)); }

    async getCategories() { return this.repo.getCategories(); }
    async addCategory(cat: any) { return this.performOperation(() => this.repo.saveCategory(cat)); }
    async deleteCategory(id: number) { return this.performOperation(() => this.repo.deleteCategory(id)); }

    async getRecurringItems() { return this.repo.getRecurringItems(); }
    async addRecurringItem(item: any) { return this.performOperation(() => this.repo.saveRecurringItem(item)); }
    async updateRecurringItem(id: number, item: any) { return this.performOperation(() => this.repo.updateRecurringItem(id, item)); }
    async deleteRecurringItem(id: number) { return this.performOperation(() => this.repo.deleteRecurringItem(id)); }

    async getGlobalBudgets(y: number, m: number) { return this.repo.getGlobalBudgets(y, m); }
    async addGlobalBudget(b: any) { return this.performOperation(() => this.repo.saveGlobalBudget(b)); }
    async updateGlobalBudget(id: number, b: any) { return this.performOperation(() => this.repo.updateGlobalBudget(id, b)); }

    async getCategoryBudgets(y: number, m: number) { return this.repo.getCategoryBudgets(y, m); }
    async addCategoryBudget(b: any) { return this.performOperation(() => this.repo.saveCategoryBudget(b)); }
    async deleteCategoryBudget(id: number) { return this.performOperation(() => this.repo.deleteCategoryBudget(id)); }

    async getCardBudgets(y: number, m: number) { return this.repo.getCardBudgets(y, m); }
    async addCardBudget(b: any) { return this.performOperation(() => this.repo.saveCardBudget(b)); }
    async deleteCardBudget(id: number) { return this.performOperation(() => this.repo.deleteCardBudget(id)); }

    async getBudgetObligations(y: number, m: number) { return this.repo.getBudgetObligations(y, m); }
    async updateBudgetObligation(id: number, data: any) { return this.performOperation(() => this.repo.updateBudgetObligation(id, data)); }

    // Business Logic: Month Initialization (from backend/routes.py)
    async initializeMonth(year: number, month: number, accountId: number, userId: number) {
        return this.performOperation(async () => {
            const prevMonth = month === 1 ? 12 : month - 1;
            const prevYear = month === 1 ? year - 1 : year;

            // Copy Category Budgets
            const prevCb = await this.repo.getCategoryBudgets(prevYear, prevMonth);
            for (const cb of prevCb) {
                if (cb.account_id === accountId) {
                    const exists = (await this.repo.getCategoryBudgets(year, month)).find(e => e.category_id === cb.category_id);
                    if (!exists) {
                        await this.repo.saveCategoryBudget({
                            year, month, amount: cb.amount,
                            category_id: cb.category_id, account_id: accountId, user_id: userId
                        });
                    }
                }
            }

            // Copy Card Budgets
            const prevCbt = await this.repo.getCardBudgets(prevYear, prevMonth);
            for (const cbt of prevCbt) {
                if (cbt.account_id === accountId) {
                    const exists = (await this.repo.getCardBudgets(year, month)).find(e => e.card_id === cbt.card_id);
                    if (!exists) {
                        await this.repo.saveCardBudget({
                            year, month, amount: cbt.amount,
                            card_id: cbt.card_id, account_id: accountId, user_id: userId
                        });
                    }
                }
            }

            // Instantiate Recurring Items
            const items = await this.repo.getRecurringItems();
            for (const item of items) {
                if (item.is_active && (item.start_year < year || (item.start_year === year && item.start_month <= month))) {
                    const obs = await this.repo.getBudgetObligations(year, month);
                    const exists = obs.find(o => o.recurring_item_id === item.id);
                    if (!exists) {
                        await this.repo.saveBudgetObligation({
                            year, month, name: item.name, amount: item.amount,
                            due_day: item.due_day, notes: item.notes,
                            category_id: item.category_id, account_id: item.account_id,
                            card_id: item.card_id, recurring_item_id: item.id, user_id: userId
                        });
                    }
                }
            }
        });
    }

    private async seedCategories() {
        const existing = await this.repo.getCategories();
        
        for (const cat of DEFAULT_CATEGORIES) {
            const alreadyExists = existing.some(e => e.name === cat.name && e.type === cat.type);
            if (!alreadyExists) {
                await this.repo.saveCategory({ ...cat, user_id: 1 });
            }
        }
    }

    getIsSyncing() { return this.isSyncing; }
    getHasPendingChanges() { return this.pendingChanges; }
    getUserInfo() { return this.userInfo; }

    setOnSyncStateChange(handler: (isSyncing: boolean) => void) {
        this.onSyncStateChange = handler;
    }
}
