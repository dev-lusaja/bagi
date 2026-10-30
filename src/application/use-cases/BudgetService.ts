import { IBudgetRepository } from '../../domain/repositories/IBudgetRepository';
import { CategoryBudget } from '../../domain/entities';
import { GoogleDriveAdapter } from '../../infrastructure/adapters/GoogleDriveAdapter';
import { ErrorLogger } from '../../services/SentryLogger';

// Tolerance for floating-point noise when comparing money amounts
const INCOME_GAP_EPSILON = 0.005;

const DEFAULT_CATEGORIES = [
    { name: "Salida de dinero al exterior", type: "EXPENSE" },
    { name: "Servicios", type: "EXPENSE" },
    { name: "Deudas", type: "EXPENSE" },
    { name: "Servicios Recurrentes", type: "EXPENSE" },
    { name: "Deudas Recurrentes", type: "EXPENSE" },
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
    private lastKnownRemoteTime: string | null = null;
    private syncStrategy: 'immediate' | 'deferred' = 'deferred';
    private syncTimeout: any = null;
    private isSyncing = false;
    private pendingChanges = false;
    private onSyncStateChange: (isSyncing: boolean) => void = () => {};
    private onAuthError: () => void = () => {};
    private SYNC_INTERVAL = 8000;
    private userInfo: { name: string; picture: string; email: string } | null = null;
    private isDemoMode = false;

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
            this.lastKnownRemoteTime = await this.drive.getFileModifiedTime(this.fileId);
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
        this.isDemoMode = false;
        this.drive.clearSession();
        this.userInfo = null;
    }

    async loadDemoData(): Promise<void> {
        this.isDemoMode = true;
        this.userInfo = {
            name: 'Usuario Demo',
            email: 'demo@bagi.app',
            picture: ''
        };

        await this.repo.initializeDatabase();
        await this.seedCategories();

        // Seed demo accounts
        const acc1 = await this.repo.saveAccount({ name: 'Cuenta Sueldo COP', currency: 'COP', country: 'Colombia', user_id: 1 });
        await this.repo.saveAccount({ name: 'Cuenta Soles PEN', currency: 'PEN', country: 'Perú', user_id: 1 });

        // Seed demo cards
        const card1 = await this.repo.saveCard({
            name: 'Visa Crédito',
            type: 'CREDIT',
            currency: 'COP',
            credit_limit: 3000000,
            payment_account_id: acc1.id,
            monthly_payment_budget: 0,
            user_id: 1
        });

        const categories = await this.repo.getCategories();
        const catSalary = categories.find(c => c.name === 'Salario')?.id || 1;
        const catMercado = categories.find(c => c.name === 'Mercado')?.id || 1;
        const catRestaurantes = categories.find(c => c.name === 'Restaurantes')?.id || 1;
        const catGasolina = categories.find(c => c.name === 'Gasolina')?.id || 1;
        const catOtros = categories.find(c => c.name === 'Otros gastos')?.id || 1;
        const catRecurrente = categories.find(c => c.name === 'Servicios Recurrentes')?.id || 1;

        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;

        // Seed global budget
        await this.repo.saveGlobalBudget({ year, month, total_amount: 5000000, account_id: acc1.id, user_id: 1 });

        // Seed category budgets
        await this.repo.saveCategoryBudget({ year, month, amount: 800000, category_id: catMercado, account_id: acc1.id, user_id: 1 });
        await this.repo.saveCategoryBudget({ year, month, amount: 400000, category_id: catRestaurantes, account_id: acc1.id, user_id: 1 });
        await this.repo.saveCategoryBudget({ year, month, amount: 250000, category_id: catGasolina, account_id: acc1.id, user_id: 1 });

        // Seed card budget
        await this.repo.saveCardBudget({ year, month, amount: 1200000, card_id: card1.id, account_id: acc1.id, user_id: 1 });

        // Seed recurring items
        await this.repo.saveRecurringItem({
            name: 'Arriendo Apartamento',
            amount: 1200000,
            type: 'SERVICE',
            due_day: 5,
            category_id: catRecurrente,
            account_id: acc1.id,
            card_id: undefined,
            notes: 'Pago mensual administración e inmobiliaria',
            start_month: 1,
            start_year: year,
            end_month: undefined,
            end_year: undefined,
            user_id: 1,
            is_active: true
        });

        await this.repo.saveRecurringItem({
            name: 'Servicio de Internet Fibra',
            amount: 110000,
            type: 'SERVICE',
            due_day: 15,
            category_id: catRecurrente,
            account_id: acc1.id,
            card_id: undefined,
            notes: 'Claro 300 Megas',
            start_month: 1,
            start_year: year,
            end_month: undefined,
            end_year: undefined,
            user_id: 1,
            is_active: true
        });

        await this.repo.saveRecurringItem({
            name: 'Suscripción Netflix / Spotify',
            amount: 55000,
            type: 'SERVICE',
            due_day: 20,
            category_id: catRecurrente,
            account_id: undefined,
            card_id: card1.id,
            notes: 'Cobro automático a tarjeta',
            start_month: 1,
            start_year: year,
            end_month: undefined,
            end_year: undefined,
            user_id: 1,
            is_active: true
        });

        // Instantiate obligations
        await this.instantiateRecurringItems(year, month, acc1.id, 1);

        // Seed transactions
        const todayStr = now.toISOString();
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        const yesterdayStr = yesterday.toISOString();
        const firstDayStr = new Date(year, month - 1, 1, 12, 0, 0).toISOString();

        await this.repo.saveTransaction({
            description: 'Salario Mensual',
            amount: 5000000,
            account_id: acc1.id,
            card_id: undefined,
            category_id: catSalary,
            date: firstDayStr,
            imputation_date: firstDayStr,
            user_id: 1
        });

        await this.repo.saveTransaction({
            description: 'Supermercado Éxito',
            amount: 320000,
            account_id: acc1.id,
            card_id: undefined,
            category_id: catMercado,
            date: yesterdayStr,
            imputation_date: yesterdayStr,
            user_id: 1
        });

        await this.repo.saveTransaction({
            description: 'Cena Restaurante El Cielo',
            amount: 140000,
            account_id: acc1.id,
            card_id: undefined,
            category_id: catRestaurantes,
            date: todayStr,
            imputation_date: todayStr,
            user_id: 1
        });

        await this.repo.saveTransaction({
            description: 'Tanqueo Gasolina Texaco',
            amount: 90000,
            account_id: acc1.id,
            card_id: undefined,
            category_id: catGasolina,
            date: todayStr,
            imputation_date: todayStr,
            user_id: 1
        });

        await this.repo.saveTransaction({
            description: 'Compra Electrónicos Amazon',
            amount: 380000,
            account_id: undefined,
            card_id: card1.id,
            category_id: catOtros,
            date: yesterdayStr,
            imputation_date: yesterdayStr,
            user_id: 1
        });
    }

    getIsDemoMode() { return this.isDemoMode; }

    setSyncConfig(strategy: 'immediate' | 'deferred') {
        this.syncStrategy = strategy;
    }

    private scheduleSave() {
        this.pendingChanges = true;
        if (this.syncTimeout) clearTimeout(this.syncTimeout);
        this.syncTimeout = setTimeout(() => this.syncToDrive(), this.SYNC_INTERVAL);
    }

    async syncToDrive() {
        if (this.isSyncing || this.isDemoMode) return;
        this.onSyncStateChange(true);
        this.isSyncing = true;
        try {
            if (this.fileId) {
                const currentRemoteTime = await this.drive.getFileModifiedTime(this.fileId);
                // Si el Drive tiene un archivo más nuevo, es porque alguien (o tú en otro dispositivo) lo guardó.
                if (this.lastKnownRemoteTime && currentRemoteTime && currentRemoteTime !== this.lastKnownRemoteTime) {
                    console.warn('[Sync] ⚠️ Choque detectado: El archivo en Drive es más nuevo. Sobreescribiendo local (MVP)...');
                    const buffer = await this.drive.downloadFile(this.fileId);
                    await this.repo.initializeDatabase(buffer);
                    this.lastKnownRemoteTime = currentRemoteTime;
                    this.pendingChanges = false;
                    
                    // Alerta nativa y recarga para limpiar el estado de React y forzar el re-render de todo
                    alert("Se ha actualizado Bagi con cambios realizados desde otro dispositivo.\n\nPara evitar conflictos, tus cambios locales no sincronizados han sido descartados. La página se recargará.");
                    window.location.reload();
                    return;
                }
            }

            const data = await this.repo.exportDatabase();
            this.fileId = await this.drive.uploadFile(this.fileName, data, this.fileId, this.folderId);
            if (this.fileId) {
                this.lastKnownRemoteTime = await this.drive.getFileModifiedTime(this.fileId);
            }
            this.pendingChanges = false;
        } catch (error: any) {
            ErrorLogger.capture(error, { source: 'BudgetService - syncToDrive' });
            if (error.message === 'AUTH_ERROR') {
                this.onAuthError();
                throw error;
            }
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
        } catch (err: any) {
            ErrorLogger.capture(err, { source: 'BudgetService - performOperation' });
            if (err.message === 'AUTH_ERROR') {
                this.onAuthError();
            }
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
    async deleteGlobalBudget(id: number) { return this.performOperation(() => this.repo.deleteGlobalBudget(id)); }

    // Business Logic: Amounts to offer when a month has no budget yet. The budget is a plan, independent of
    // registered income: last month's plan for the same account, then this month's registered income (if different).
    async getBudgetSuggestions(year: number, month: number, accountId: number, monthlyIncome: number) {
        const prevMonth = month === 1 ? 12 : month - 1;
        const prevYear = month === 1 ? year - 1 : year;
        const prev = (await this.repo.getGlobalBudgets(prevYear, prevMonth)).find(b => b.account_id === accountId);

        const suggestions: { amount: number; source: 'PREVIOUS_MONTH' | 'INCOME' }[] = [];
        if (prev && prev.total_amount > 0) suggestions.push({ amount: prev.total_amount, source: 'PREVIOUS_MONTH' });
        if (monthlyIncome > INCOME_GAP_EPSILON && suggestions.every(s => Math.abs(s.amount - monthlyIncome) > INCOME_GAP_EPSILON)) {
            suggestions.push({ amount: monthlyIncome, source: 'INCOME' });
        }
        return suggestions;
    }

    // Splits the budget bar into spent → available, as percentages of the largest of budget and spent.
    getBudgetBarSegments(budgetAmount: number, spent: number) {
        const scale = Math.max(budgetAmount, spent);
        if (scale <= 0) return { spentPct: 0, availablePct: 0 };

        const pct = (value: number) => (value / scale) * 100;
        return {
            spentPct: pct(spent),
            availablePct: pct(Math.max(0, budgetAmount - spent)),
        };
    }

    // Business Logic: How the budget is split across planned buckets, with the unassigned remainder as the last bucket.
    // Percents are whole numbers of the budget, rounded with the largest remainder method so they add up to
    // exactly 100% when the plan fits; shares are bar widths relative to max(budget, planned) so the bar never overflows.
    getPlanDistribution(budgetAmount: number, planned: number[]) {
        const totalPlanned = planned.reduce((s, v) => s + v, 0);
        const unassigned = budgetAmount - totalPlanned;
        const status: 'UNASSIGNED' | 'COMPLETE' | 'OVER' =
            unassigned > INCOME_GAP_EPSILON ? 'UNASSIGNED' : unassigned < -INCOME_GAP_EPSILON ? 'OVER' : 'COMPLETE';

        const values = [...planned, Math.max(0, unassigned)];
        if (budgetAmount <= 0) return { percents: values.map(() => 0), shares: values.map(() => 0), unassigned, status };

        const raw = values.map(v => (v / budgetAmount) * 100);
        const percents = raw.map(Math.floor);
        let leftover = 100 - percents.reduce((s, v) => s + v, 0);
        raw
            .map((v, i) => ({ i, frac: v - Math.floor(v) }))
            .sort((a, b) => b.frac - a.frac)
            .forEach(({ i }) => { if (leftover > 0) { percents[i]++; leftover--; } });

        const scale = Math.max(budgetAmount, totalPlanned);
        const shares = values.map(v => (v / scale) * 100);
        return { percents, shares, unassigned, status };
    }

    async getCategoryBudgets(y: number, m: number) { return this.repo.getCategoryBudgets(y, m); }
    async addCategoryBudget(b: any) { return this.performOperation(() => this.repo.saveCategoryBudget(b)); }
    async deleteCategoryBudget(id: number) { return this.performOperation(() => this.repo.deleteCategoryBudget(id)); }

    // Upsert: a category has at most one limit per month and account, so re-assigning updates it instead of duplicating
    async saveCategoryLimit(b: Omit<CategoryBudget, 'id' | 'user_id'> & { user_id?: number }) {
        return this.performOperation(async () => {
            const existing = (await this.repo.getCategoryBudgets(b.year, b.month))
                .find(e => e.category_id === b.category_id && e.account_id === b.account_id);
            return existing
                ? this.repo.updateCategoryBudget(existing.id, { amount: b.amount })
                : this.repo.saveCategoryBudget(b as Omit<CategoryBudget, 'id'>);
        });
    }

    // Business Logic: Editable range for a category limit and the impact of a proposed amount.
    // Floor is what's already spent; ceiling is what the unassigned (free) balance can absorb.
    // Mirrors the plan math, where a limit only commits the part not covered by recurring items in its category.
    getCategoryLimitEdit(
        ctx: { currentLimit: number; spent: number; recurringInCategory: number; freeBalance: number },
        proposed: number
    ) {
        const { currentLimit, spent, recurringInCategory, freeBalance } = ctx;
        const committed = (limit: number) => Math.max(0, limit - recurringInCategory);

        const min = spent;
        const max = Math.max(min, Math.max(currentLimit, recurringInCategory) + Math.max(0, freeBalance));
        // ~100 steps across the range, rounded to a power of ten so amounts land on round numbers in any currency
        const step = max > 0 ? Math.max(0.01, Math.pow(10, Math.floor(Math.log10(max)) - 2)) : 1;
        const remainingFree = freeBalance - (committed(proposed) - committed(currentLimit));

        let error: 'INVALID' | 'BELOW_SPENT' | 'ABOVE_FREE' | null = null;
        if (isNaN(proposed) || proposed <= 0) error = 'INVALID';
        else if (proposed < min - INCOME_GAP_EPSILON) error = 'BELOW_SPENT';
        else if (proposed > max + INCOME_GAP_EPSILON) error = 'ABOVE_FREE';

        return { min, max, step, remainingFree, error, isLocked: max - min < step };
    }

    // Rounds a raw slider value to the edit step, keeping it inside [min, max]
    snapCategoryLimit(raw: number, edit: { min: number; max: number; step: number }) {
        const snapped = Math.round(Math.round(raw / edit.step) * edit.step * 100) / 100;
        return Math.min(edit.max, Math.max(edit.min, snapped));
    }

    async getCardBudgets(y: number, m: number) { return this.repo.getCardBudgets(y, m); }
    async addCardBudget(b: any) { return this.performOperation(() => this.repo.saveCardBudget(b)); }
    async deleteCardBudget(id: number) { return this.performOperation(() => this.repo.deleteCardBudget(id)); }

    async getBudgetObligations(y: number, m: number) { return this.repo.getBudgetObligations(y, m); }
    async updateBudgetObligation(id: number, data: any) { return this.performOperation(() => this.repo.updateBudgetObligation(id, data)); }
    async deleteBudgetObligation(id: number) { return this.performOperation(() => this.repo.deleteBudgetObligation(id)); }

    // Business Logic: Instantiate Recurring Items specifically
    async instantiateRecurringItems(year: number, month: number, accountId: number, userId: number) {
        const items = await this.repo.getRecurringItems();
        const obs = await this.repo.getBudgetObligations(year, month);
        
        const itemsToInstantiate = items.filter(item => {
            if (!item.is_active) return false;
            
            // Check Start Date
            if (item.start_year > year || (item.start_year === year && item.start_month > month)) return false;
            
            // Check End Date (if exists)
            if (item.end_year && (item.end_year < year || (item.end_year === year && item.end_month && item.end_month < month))) return false;

            if (item.account_id !== accountId) return false;
            return !obs.some(o => o.recurring_item_id === item.id);
        });

        if (itemsToInstantiate.length === 0) return;

        return this.performOperation(async () => {
            for (const item of itemsToInstantiate) {
                await this.repo.saveBudgetObligation({
                    year, month, name: item.name, amount: item.amount,
                    due_day: item.due_day, notes: item.notes,
                    category_id: item.category_id, account_id: item.account_id,
                    card_id: item.card_id, recurring_item_id: item.id, user_id: userId
                });
            }
        });
    }

    // Business Logic: Copy limits from previous month
    async copyPreviousMonthLimits(year: number, month: number, accountId: number, userId: number) {
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
        });
    }

    // Business Logic: Month Initialization (Wrapper)
    async initializeMonth(year: number, month: number, accountId: number, userId: number) {
        await this.copyPreviousMonthLimits(year, month, accountId, userId);
        await this.instantiateRecurringItems(year, month, accountId, userId);
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

    setOnAuthError(handler: () => void) {
        this.onAuthError = handler;
    }
}
