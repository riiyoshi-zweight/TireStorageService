// database/clean_migration.js - クリーンマイグレーション（安全版）

const database = require('./connection');
const bcrypt = require('bcrypt');

/**
 * データベースのクリーンマイグレーションを実行
 * 本番環境では既存データを保護する
 * @returns {Promise<boolean>} 成功時true、失敗時false
 */
async function cleanMigration() {
    try {
        console.log('🔍 データベース状態を確認中...');
        
        // 重要：既存データの確認
        const hasExistingData = await checkExistingData();
        
        if (hasExistingData) {
            console.log('✅ 既存のデータが検出されました。データを保護します。');
            
            // 必要なテーブルのみ作成（既存データは保持）
            await createRequiredTables();
            
            // 管理者が存在しない場合のみ作成
            await insertDefaultAdmin();
            
            // 設定データの確認と追加
            await insertDefaultSettings();
            
            console.log('✅ 既存データを保持したまま、必要な初期化を完了しました');
            return true;
        }
        
        // 完全に新規の場合のみ初期化を実行
        console.log('🔧 新規データベースを初期化中...');
        
        // 外部キー制約を一時無効化
        await database.run('PRAGMA foreign_keys = OFF');
        
        // テーブル作成
        await createRequiredTables();
        
        // reservationsテーブルの作成（DROPは実行しない）
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
        
        // インデックス作成
        await database.run('CREATE INDEX IF NOT EXISTS idx_reservations_customer_id ON reservations(customer_id)');
        await database.run('CREATE INDEX IF NOT EXISTS idx_reservations_date_id ON reservations(available_date_id)');
        await database.run('CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(reservation_status)');
        
        // 初期設定データ挿入
        await insertDefaultSettings();
        
        // 管理者データ挿入
        await insertDefaultAdmin();
        
        // 外部キー制約を再有効化
        await database.run('PRAGMA foreign_keys = ON');
        
        console.log('✅ データベースの初期化が完了しました');
        return true;
        
    } catch (error) {
        console.error('マイグレーションエラー:', error.message);
        
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
 * 既存データの存在確認
 * @returns {Promise<boolean>}
 */
async function checkExistingData() {
    try {
        // 各テーブルのレコード数を確認
        const tables = [
            'manager_list',
            'customers',
            'reservations',
            'available_dates'
        ];
        
        for (const table of tables) {
            const result = await database.get(
                `SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name=?`,
                [table]
            );
            
            if (result.count > 0) {
                // テーブルが存在する場合、データも確認
                try {
                    const dataCount = await database.get(`SELECT COUNT(*) as count FROM ${table}`);
                    if (dataCount.count > 0) {
                        console.log(`📊 ${table}に${dataCount.count}件のデータが存在します`);
                        return true;
                    }
                } catch (e) {
                    // テーブルが存在しない場合は無視
                }
            }
        }
        
        return false;
    } catch (error) {
        console.error('データ確認エラー:', error);
        return false;
    }
}

/**
 * 必要なテーブルを作成（CREATE IF NOT EXISTSで安全に）
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
            
            console.log(`✅ 設定を追加: ${key}`);
        }
    }
}

/**
 * デフォルト管理者を挿入
 * @returns {Promise<void>}
 */
async function insertDefaultAdmin() {
    const now = new Date().toISOString();
    
    // デフォルト管理者情報
    const defaultAdmin = {
        username: 'Administrator',
        password: 'Mente0444'
    };
    
    try {
        // 既存の管理者をチェック
        const existing = await database.get(
            'SELECT manager_id FROM manager_list WHERE username = ?',
            [defaultAdmin.username]
        );
        
        if (!existing) {
            const managerId = `manager_${Date.now()}`;
            // bcryptでハッシュ化
            const passwordHash = await bcrypt.hash(defaultAdmin.password, 10);
            
            await database.run(`
                INSERT INTO manager_list 
                (manager_id, username, password_hash, created_at, updated_at, is_active)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [managerId, defaultAdmin.username, passwordHash, now, now, 1]);
            
            console.log('✅ デフォルト管理者を作成しました: Administrator');
        } else {
            console.log('ℹ️ 管理者は既に存在します: Administrator');
        }
        
    } catch (error) {
        console.error('管理者作成エラー:', error);
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

// 直接実行時は初期化を実行
if (require.main === module) {
    cleanMigration().then(success => {
        if (success) {
            console.log('✅ データベース初期化完了');
            process.exit(0);
        } else {
            console.error('❌ データベース初期化失敗');
            process.exit(1);
        }
    });
}

module.exports = { 
    cleanMigration,
    validateReservationData 
};