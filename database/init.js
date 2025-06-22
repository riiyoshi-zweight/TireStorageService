// database/init.js - データベース初期化

const database = require('./connection');
const { cleanMigration } = require('./clean_migration');

/**
 * データベース初期化関数
 * @returns {Object} データベース接続オブジェクト
 */
function initializeDatabase() {
    return database;
}

/**
 * データベースの初期化とマイグレーション実行
 * @returns {Promise<boolean>} 成功時true、失敗時false
 */
async function initializeAndMigrate() {
    try {
        // クリーンマイグレーション実行
        const migrationSuccess = await cleanMigration();
        
        if (!migrationSuccess) {
            console.log('マイグレーションに一部問題がありましたが、基本機能は利用可能です');
        }
        
        // データベース状態確認
        await verifyDatabaseState();
        
        return true;
        
    } catch (error) {
        console.error('データベース初期化エラー:', error.message);
        
        // フォールバック: 基本テーブルのみ作成を試行
        try {
            await createBasicTables();
            return true;
        } catch (fallbackError) {
            console.error('フォールバック失敗:', fallbackError.message);
            return false;
        }
    }
}

/**
 * 基本テーブル作成
 * @returns {Promise<void>}
 */
async function createBasicTables() {
    const now = new Date().toISOString();
    
    // 1. customersテーブル
    await database.run(`
        CREATE TABLE IF NOT EXISTS customers (
            customer_id TEXT PRIMARY KEY,
            customer_name TEXT NOT NULL,
            customer_phone TEXT NOT NULL CHECK(
                customer_phone GLOB '[0-9][0-9][0-9]-[0-9][0-9][0-9][0-9]-[0-9][0-9][0-9][0-9]'
                OR customer_phone GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][0-9][0-9]'
            ),
            car_model TEXT,
            is_light_vehicle INTEGER DEFAULT 0,
            line_user_id TEXT UNIQUE NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            is_active INTEGER DEFAULT 1
        )
    `);
    
    // 2. available_datesテーブル
    await database.run(`
        CREATE TABLE IF NOT EXISTS available_dates (
            available_date_id TEXT PRIMARY KEY,
            available_date TEXT NOT NULL,
            available_time TEXT NOT NULL,
            is_active INTEGER DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            created_by TEXT,
            UNIQUE(available_date, available_time)
        )
    `);
    
    // 3. reservationsテーブル
    await database.run(`
        CREATE TABLE IF NOT EXISTS reservations (
            reservation_id TEXT PRIMARY KEY,
            customer_id TEXT NOT NULL,
            available_date_id TEXT NOT NULL,
            reservation_status TEXT DEFAULT 'pending',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
            FOREIGN KEY (available_date_id) REFERENCES available_dates(available_date_id)
        )
    `);
    
    // 4. system_settingsテーブル
    await database.run(`
        CREATE TABLE IF NOT EXISTS system_settings (
            setting_id TEXT PRIMARY KEY,
            setting_key TEXT UNIQUE NOT NULL,
            setting_value TEXT NOT NULL,
            description TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    `);
    
    // 5. インデックス作成
    await database.run('CREATE INDEX IF NOT EXISTS idx_customers_line_user_id ON customers(line_user_id)');
    await database.run('CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(customer_phone)');
    await database.run('CREATE INDEX IF NOT EXISTS idx_available_dates_date ON available_dates(available_date)');
    await database.run('CREATE INDEX IF NOT EXISTS idx_reservations_customer_id ON reservations(customer_id)');
    await database.run('CREATE INDEX IF NOT EXISTS idx_reservations_date_id ON reservations(available_date_id)');
    await database.run('CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(reservation_status)');
    
    // 6. 初期設定データ挿入
    const defaultSettings = [
        ['business_hours_start', '09:00', '営業開始時間'],
        ['business_hours_end', '18:00', '営業終了時間'],
        ['reservation_interval_minutes', '30', '予約間隔（分）'],
        ['max_reservations_per_day', '10', '1日あたりの最大予約数']
    ];
    
    for (let i = 0; i < defaultSettings.length; i++) {
        const [key, value, description] = defaultSettings[i];
        const settingId = `setting_${Date.now()}_${i}`;
        
        // 既存チェック
        const existing = await database.get(
            'SELECT setting_id FROM system_settings WHERE setting_key = ?',
            [key]
        );
        
        if (!existing) {
            await database.run(`
                INSERT INTO system_settings 
                (setting_id, setting_key, setting_value, description, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [settingId, key, value, description, now, now]);
        }
    }
}

/**
 * データベース状態確認
 * @returns {Promise<void>}
 */
async function verifyDatabaseState() {
    // テーブル存在確認
    const tables = ['customers', 'available_dates', 'reservations', 'system_settings'];
    
    for (const table of tables) {
        const exists = await database.get(
            `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
            [table]
        );
        
        if (!exists) {
            throw new Error(`${table}テーブルが存在しません`);
        }
    }
    
    // reservationsテーブルのnotesカラム確認
    const reservationsColumns = await database.all(`PRAGMA table_info(reservations)`);
    const hasNotesColumn = reservationsColumns.some(col => col.name === 'notes');
    
    if (hasNotesColumn) {
        throw new Error('reservationsテーブルにnotesカラムが残っています。クリーンマイグレーションを実行してください。');
    }
}

// 起動時に自動実行
initializeAndMigrate().catch(error => {
    console.error('データベース初期化に失敗しました:', error.message);
});

module.exports = {
    initializeDatabase,
    initializeAndMigrate,
    createBasicTables,
    verifyDatabaseState
};