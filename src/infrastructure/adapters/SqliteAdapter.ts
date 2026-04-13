import initSqlJs, { Database } from 'sql.js';

let db: Database | null = null;
let SQL: any = null;

export const getSqlite = async () => {
    if (SQL) return SQL;
    SQL = await initSqlJs({
        locateFile: file => `/${file}`
    });
    return SQL;
};

export const initDb = async (buffer?: ArrayBuffer): Promise<Database> => {
    const sqlite = await getSqlite();
    if (buffer) {
        db = new sqlite.Database(new Uint8Array(buffer));
    } else {
        db = new sqlite.Database();
    }
    if (db) createSchema(db);
    return db!;
};

export const getDb = (): Database => {
    if (!db) throw new Error("Database not initialized");
    return db;
};

const createSchema = (db: Database) => {
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            hashed_password TEXT
        );

        CREATE TABLE IF NOT EXISTS accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            currency TEXT,
            country TEXT,
            user_id INTEGER,
            FOREIGN KEY(user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS cards (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            type TEXT,
            credit_limit REAL,
            currency TEXT,
            user_id INTEGER,
            payment_account_id INTEGER,
            monthly_payment_budget REAL DEFAULT 0.0,
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(payment_account_id) REFERENCES accounts(id)
        );

        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            type TEXT,
            user_id INTEGER,
            FOREIGN KEY(user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS recurring_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            amount REAL,
            type TEXT,
            due_day INTEGER,
            is_active BOOLEAN DEFAULT 1,
            category_id INTEGER,
            account_id INTEGER,
            card_id INTEGER,
            notes TEXT,
            start_year INTEGER DEFAULT 2026,
            start_month INTEGER DEFAULT 1,
            user_id INTEGER,
            FOREIGN KEY(category_id) REFERENCES categories(id),
            FOREIGN KEY(account_id) REFERENCES accounts(id),
            FOREIGN KEY(card_id) REFERENCES cards(id),
            FOREIGN KEY(user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS budget_obligations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            year INTEGER,
            month INTEGER,
            name TEXT,
            amount REAL,
            due_day INTEGER,
            notes TEXT,
            category_id INTEGER,
            account_id INTEGER,
            card_id INTEGER,
            recurring_item_id INTEGER,
            user_id INTEGER,
            FOREIGN KEY(category_id) REFERENCES categories(id),
            FOREIGN KEY(account_id) REFERENCES accounts(id),
            FOREIGN KEY(card_id) REFERENCES cards(id),
            FOREIGN KEY(recurring_item_id) REFERENCES recurring_items(id),
            FOREIGN KEY(user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT,
            amount REAL,
            description TEXT,
            account_id INTEGER,
            card_id INTEGER,
            category_id INTEGER,
            recurring_item_id INTEGER,
            budget_obligation_id INTEGER,
            user_id INTEGER,
            FOREIGN KEY(account_id) REFERENCES accounts(id),
            FOREIGN KEY(card_id) REFERENCES cards(id),
            FOREIGN KEY(category_id) REFERENCES categories(id),
            FOREIGN KEY(recurring_item_id) REFERENCES recurring_items(id),
            FOREIGN KEY(budget_obligation_id) REFERENCES budget_obligations(id),
            FOREIGN KEY(user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS global_budgets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            year INTEGER,
            month INTEGER,
            total_amount REAL,
            account_id INTEGER,
            user_id INTEGER,
            FOREIGN KEY(account_id) REFERENCES accounts(id),
            FOREIGN KEY(user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS category_budgets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            year INTEGER,
            month INTEGER,
            amount REAL,
            category_id INTEGER,
            account_id INTEGER,
            user_id INTEGER,
            FOREIGN KEY(category_id) REFERENCES categories(id),
            FOREIGN KEY(account_id) REFERENCES accounts(id),
            FOREIGN KEY(user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS card_budgets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            year INTEGER,
            month INTEGER,
            amount REAL,
            card_id INTEGER,
            account_id INTEGER,
            user_id INTEGER,
            FOREIGN KEY(card_id) REFERENCES cards(id),
            FOREIGN KEY(account_id) REFERENCES accounts(id),
            FOREIGN KEY(user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS tx_embeddings (
          tx_id       TEXT PRIMARY KEY,
          account_id  TEXT NOT NULL,
          vector      BLOB NOT NULL,
          created_at  INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS monthly_category_summary (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          account_id    TEXT NOT NULL,
          category_id   INTEGER NOT NULL,
          year_month    TEXT NOT NULL,
          total_amount  REAL NOT NULL,
          tx_count      INTEGER NOT NULL,
          weekend_pct   REAL,
          UNIQUE(account_id, category_id, year_month)
        );

        CREATE TABLE IF NOT EXISTS alert_scorer_weights (
          alert_type    TEXT NOT NULL,
          feature_name  TEXT NOT NULL,
          weight        REAL NOT NULL DEFAULT 0.0,
          updated_at    INTEGER NOT NULL,
          PRIMARY KEY (alert_type, feature_name)
        );

        CREATE TABLE IF NOT EXISTS alert_feedback (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          alert_id    TEXT NOT NULL,
          alert_type  TEXT NOT NULL,
          was_useful  INTEGER NOT NULL,
          features    TEXT NOT NULL,
          created_at  INTEGER NOT NULL
        );
    `);
};
