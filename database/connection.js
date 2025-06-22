// database/connection.js - データベース接続モジュール

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Render環境かどうかを判定
const isRender = process.env.RENDER === 'true';

// データベースパスの設定
let dbPath;
if (isRender && process.env.NODE_ENV === 'production') {
    // Render本番環境では永続ディスクを使用
    dbPath = '/data/tire_storage.db';
} else {
    // 開発環境では環境変数またはデフォルトパスを使用
    dbPath = process.env.DATABASE_URL || 'tire_storage.db';
}

// 絶対パスに変換
const DB_PATH = path.isAbsolute(dbPath) 
    ? dbPath 
    : path.join(__dirname, '..', dbPath);

// ディレクトリの存在確認と作成
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// データベース接続を作成
const database = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('SQLite接続エラー:', err.message);
    } else {
        console.log('データベースに接続しました:', DB_PATH);
    }
});

// Promise ベースのラッパー関数（以下は変更なし）
const db = {
    get: (query, params = []) => {
        return new Promise((resolve, reject) => {
            database.get(query, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    },

    all: (query, params = []) => {
        return new Promise((resolve, reject) => {
            database.all(query, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });
    },

    run: (query, params = []) => {
        return new Promise((resolve, reject) => {
            database.run(query, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({
                        lastID: this.lastID,
                        changes: this.changes
                    });
                }
            });
        });
    },

    beginTransaction: () => {
        return db.run('BEGIN TRANSACTION');
    },

    commit: () => {
        return db.run('COMMIT');
    },

    rollback: () => {
        return db.run('ROLLBACK');
    }
};

module.exports = db;