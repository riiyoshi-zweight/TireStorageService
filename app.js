// app.js - タイヤ保管予約システム

require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// ミドルウェア設定
app.use(cors({
    origin: ['http://localhost:3000', 'https://liff.line.me'],
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
// index: false により「/」はメニュー画面のルートで処理する
app.use(express.static('public', { index: false }));

// データベース接続確認
try {
    const database = require('./database/connection');
} catch (error) {
    console.error('データベース接続エラー:', error.message);
    process.exit(1);
}

// データベース初期化
try {
    const initDatabase = require('./database/init');
} catch (error) {
    console.error('データベース初期化エラー:', error.message);
}

// API Routes設定
const customersRouter = require('./routes/customers');
const availableDatesRouter = require('./routes/available-dates');
const reservationsRouter = require('./routes/reservations');
const { router: adminAuthRouter } = require('./routes/admin-auth');
const adminAvailableDatesRouter = require('./routes/admin-available-dates');
const adminReservationsListRouter = require('./routes/admin-reservations-list');

app.use('/api/customers', customersRouter);
app.use('/api/available-dates', availableDatesRouter);
app.use('/api/reservations', reservationsRouter);
app.use('/api/admin', adminAuthRouter);
app.use('/api/admin', adminAvailableDatesRouter);
app.use('/api/admin/reservations-list', adminReservationsListRouter);

// フロントエンドルート（入口はメニュー画面）
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'menu.html'));
});

app.get('/liff', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'menu.html'));
});

// 管理者ページルート
app.get('/admin-login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin-login.html'));
});

app.get('/admin-calendar.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin-calendar.html'));
});

app.get('/admin-reservations-list.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin-reservations-list.html'));
});

// セキュリティヘッダー（管理者ページ用）
app.use((req, res, next) => {
    if (req.path.includes('/admin')) {
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    }
    next();
});

// ヘルスチェックエンドポイント
app.get('/health', async (req, res) => {
    try {
        const database = require('./database/connection');
        const result = await database.get('SELECT 1 as health_check');
        
        res.json({
            status: 'healthy',
            message: 'システムは正常に動作しています',
            database: 'SQLite',
            db_connected: !!result,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            message: 'システムに問題が発生しています',
            database: 'SQLite',
            db_connected: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// API情報エンドポイント
app.get('/api', (req, res) => {
    res.json({
        name: 'タイヤ保管予約システム API',
        version: '1.0.0',
        endpoints: {
            customers: '/api/customers',
            reservations: '/api/reservations',
            available_dates: '/api/available-dates',
            admin_auth: '/api/admin/login',
            admin_calendar: '/api/admin/available-dates',
            admin_reservations_list: '/api/admin/reservations-list'
        },
        timestamp: new Date().toISOString()
    });
});

// 404エラーハンドリング
app.use((req, res) => {
    res.status(404).json({
        status: 'not_found',
        message: `${req.url} は存在しません`,
        timestamp: new Date().toISOString()
    });
});

// エラーハンドリング
app.use((err, req, res, next) => {
    const isAdminRoute = req.path.startsWith('/api/admin');
    const status = err.status || 500;
    
    if (isAdminRoute) {
        return res.status(status).json({
            success: false,
            error: '管理者システムでエラーが発生しました',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined,
            timestamp: new Date().toISOString()
        });
    }
    
    res.status(status).json({
        status: 'error',
        message: err.message || 'Internal Server Error',
        timestamp: new Date().toISOString()
    });
});

// サーバー起動
const server = app.listen(PORT, () => {
    console.log(`タイヤ保管予約システム起動: http://localhost:${PORT}`);
});

// グレースフルシャットダウン
const gracefulShutdown = (signal) => {
    console.log(`${signal} 信号を受信しました。シャットダウン中...`);
    
    server.close(() => {
        const database = require('./database/connection');
        if (database.close) {
            database.close().then(() => {
                process.exit(0);
            }).catch(() => {
                process.exit(1);
            });
        } else {
            process.exit(0);
        }
    });
    
    // 30秒でタイムアウト
    setTimeout(() => {
        process.exit(1);
    }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// 未処理エラーのハンドリング
process.on('uncaughtException', (error) => {
    console.error('未処理の例外:', error.message);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('未処理のPromise拒否:', reason);
    gracefulShutdown('UNHANDLED_REJECTION');
});

module.exports = app;