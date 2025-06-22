// database/clean_migration.js - クリーンマイグレーション

const database = require('./connection');

/**
 * データベースのクリーンマイグレーションを実行
 * reservationsテーブルからnotesカラムを削除し、最適な構造にする
 * @returns {Promise<boolean>} 成功時true、失敗時false
 */
async function cleanMigration() {
    try {
        // 外部キー制約を一時無効化
        await database.run('PRAGMA foreign_keys = OFF');
        
        // 1. reservationsテーブルを完全削除して再作成
        await database.run('DROP TABLE IF EXISTS reservations');
        
        await database.run(`
            CREATE TABLE reservations (
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
        
        // 2. インデックス作成
        await database.run('CREATE INDEX IF NOT EXISTS idx_reservations_customer_id ON reservations(customer_id)');
        await database.run('CREATE INDEX IF NOT EXISTS idx_reservations_date_id ON reservations(available_date_id)');
        await database.run('CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(reservation_status)');
        
        // 3. 他のテーブルも必要に応じて確認・作成
        await createRequiredTables();
        
        // 4. 初期設定データ挿入
        await insertDefaultSettings();
        
        // 5. 外部キー制約を再有効化
        await database.run('PRAGMA foreign_keys = ON');
        
        // 6. テーブル構造確認
        const tableInfo = await database.all(`PRAGMA table_info(reservations)`);
        const hasNotesColumn = tableInfo.some(col => col.name === 'notes');
        
        if (hasNotesColumn) {
            throw new Error('notesカラムが残っています');
        }
        
        return true;
        
    } catch (error) {
        console.error('クリーンマイグレーションエラー:', error.message);
        
        // 外部キー制約を再有効化（エラー時も）
        try {
            await database.run('PRAGMA foreign_keys = ON');
        } catch (fkError) {
            console.error('外部キー制約再有効化エラー:', fkError.message);
        }
        
        return false;
    }
}

/**
 * 必要なテーブルを作成
 * @returns {Promise<void>}
 */
async function createRequiredTables() {
    const now = new Date().toISOString();
    
    // customersテーブル
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
    
    // available_datesテーブル
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
    
    // system_settingsテーブル
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
    
    // manager_listテーブル
    await database.run(`
        CREATE TABLE IF NOT EXISTS manager_list (
            manager_id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            is_active INTEGER DEFAULT 1
        )
    `);
    
    // インデックス作成
    await database.run('CREATE INDEX IF NOT EXISTS idx_customers_line_user_id ON customers(line_user_id)');
    await database.run('CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(customer_phone)');
    await database.run('CREATE INDEX IF NOT EXISTS idx_available_dates_date ON available_dates(available_date)');
    await database.run('CREATE INDEX IF NOT EXISTS idx_manager_username ON manager_list(username)');
}

/**
 * デフォルト設定を挿入
 * @returns {Promise<void>}
 */
async function insertDefaultSettings() {
    const now = new Date().toISOString();
    const defaultSettings = [
        ['business_hours_start', '09:00', '営業開始時間'],
        ['business_hours_end', '18:00', '営業終了時間'],
        ['reservation_interval_minutes', '30', '予約間隔（分）'],
        ['max_reservations_per_day', '10', '1日あたりの最大予約数']
    ];
    
    for (let i = 0; i < defaultSettings.length; i++) {
        const [key, value, description] = defaultSettings[i];
        
        // 既存チェック
        const existing = await database.get(
            'SELECT setting_id FROM system_settings WHERE setting_key = ?',
            [key]
        );
        
        if (!existing) {
            const settingId = `setting_${Date.now()}_${i}`;
            
            await database.run(`
                INSERT INTO system_settings 
                (setting_id, setting_key, setting_value, description, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [settingId, key, value, description, now, now]);
        }
    }
}

/**
 * 予約データのバリデーション
 * @param {Object} data - バリデーション対象のデータ
 * @returns {Object} バリデーション結果
 */
function validateReservationData(data) {
    const errors = [];
    
    // available_date_id チェック
    if (!data.available_date_id || !data.available_date_id.trim()) {
        errors.push('利用可能日時IDは必須です');
    }
    
    // line_user_id チェック
    if (!data.line_user_id || !data.line_user_id.trim()) {
        errors.push('LINE User IDは必須です');
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

module.exports = { 
    cleanMigration,
    validateReservationData 
};