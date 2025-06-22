// database/init-db-safe.js - 安全な初期化スクリプト

const database = require('./connection');

async function safeInit() {
    try {
        // テーブルの存在確認
        const tables = await database.all(
            "SELECT name FROM sqlite_master WHERE type='table'"
        );
        
        const tableNames = tables.map(t => t.name);
        
        if (tableNames.includes('manager_list') && 
            tableNames.includes('customers') && 
            tableNames.includes('reservations')) {
            console.log('✅ データベースは既に初期化されています');
            
            // 管理者の存在確認
            const adminCount = await database.get(
                "SELECT COUNT(*) as count FROM manager_list"
            );
            
            if (adminCount.count === 0) {
                console.log('⚠️ 管理者が存在しません。clean_migration.jsを実行してください。');
            }
            
            return true;
        }
        
        // 初期化が必要な場合のみ実行
        console.log('🔧 データベースを初期化します...');
        const { cleanMigration } = require('./clean_migration');
        return await cleanMigration();
        
    } catch (error) {
        console.error('初期化エラー:', error);
        return false;
    }
}

if (require.main === module) {
    safeInit().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = { safeInit };