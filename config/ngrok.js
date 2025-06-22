// config/ngrok.js - ngrok環境設定

// 環境変数から ngrok URL を取得
const NGROK_URL = process.env.NGROK_URL || 'https://a556-2400-4052-94a0-e200-bd71-ca09-d2f3-325d.ngrok-free.app';

// 設定
const ngrokConfig = {
    // アプリケーション設定
    app: {
        name: 'タイヤ保管予約システム',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        port: process.env.PORT || 3000,
        host: '0.0.0.0', // ngrok用
        ngrok_url: NGROK_URL
    },

    // CORS設定（ngrok対応）
    security: {
        cors_origin: [
            'http://localhost:3000',
            NGROK_URL,
            'https://*.ngrok-free.app',
            'https://*.ngrok.io'
        ],
        rate_limit: {
            window_ms: 15 * 60 * 1000, // 15分
            max_requests: 200, // 開発環境では緩め
            message: '短時間に多くのリクエストが送信されました。しばらく待ってから再試行してください。'
        }
    },

    // データベース設定
    database: {
        path: process.env.DB_PATH || './tire_storage.db',
        backup_path: process.env.DB_BACKUP_PATH || './backups',
        enable_wal: true,
        enable_foreign_keys: true,
        timeout: 30000
    },

    // ログ設定
    logging: {
        level: 'debug',
        enable_console: true,
        enable_file: false
    },

    // デバッグ設定
    debug: {
        enabled: true,
        sql_logging: false,
        performance_monitoring: true
    },

    // ngrok固有設定
    ngrok: {
        enabled: true,
        tunnel_url: NGROK_URL,
        // ngrok警告を無効化
        warning_header: false
    }
};

// ngrok URL の検証
function validateNgrokUrl() {
    if (!NGROK_URL.includes('ngrok')) {
        console.warn('⚠️ 警告: ngrok URLが設定されていません');
        return false;
    }
    
    if (NGROK_URL.includes('ngrok-free.app')) {
        console.log('📡 ngrok無料版を使用中');
        console.log('⚠️ 本番環境では独自ドメインの利用を推奨します');
    }
    
    console.log(`🌐 ngrok URL: ${NGROK_URL}`);
    return true;
}

// ngrok環境の確認
function checkNgrokEnvironment() {
    validateNgrokUrl();
    
    console.log('\n📋 ngrok環境設定:');
    console.log(`  • アプリURL: ${NGROK_URL}`);
    console.log(`  • 内部ポート: ${ngrokConfig.app.port}`);
    console.log(`  • CORS設定: ${ngrokConfig.security.cors_origin.join(', ')}`);
    console.log('\n⚠️ 本番環境への移行時の注意点:');
    console.log('  1. 独自ドメイン + SSL証明書が必要');
    console.log('  2. LIFFエンドポイントURLの変更');
    console.log('  3. 環境変数の本番設定');
    console.log('  4. データベースのバックアップ');
}

module.exports = {
    ...ngrokConfig,
    validateNgrokUrl,
    checkNgrokEnvironment
};