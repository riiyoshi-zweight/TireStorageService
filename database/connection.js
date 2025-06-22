// database/connection.js - データベース接続モジュール

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// 環境変数からパスを取得、なければデフォルト値を使用
const dbPath = process.env.DATABASE_URL || 'tire_storage.db';

// 絶対パスに変換
const DB_PATH = path.isAbsolute(dbPath) 
    ? dbPath 
    : path.join(__dirname, '..', dbPath);

// データベースファイルのディレクトリを確認・作成
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

// Promise ベースのラッパー関数
const db = {
    /**
     * SELECT文（単一行）を実行
     * @param {string} query - SQLクエリ
     * @param {Array} params - パラメータ
     * @returns {Promise<Object>} 結果行
     */
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

    /**
     * SELECT文（複数行）を実行
     * @param {string} query - SQLクエリ
     * @param {Array} params - パラメータ
     * @returns {Promise<Array>} 結果行の配列
     */
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

    /**
     * INSERT, UPDATE, DELETE文を実行
     * @param {string} query - SQLクエリ
     * @param {Array} params - パラメータ
     * @returns {Promise<Object>} 実行結果
     */
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

    /**
     * トランザクション開始
     * @returns {Promise<void>}
     */
    beginTransaction: () => {
        return db.run('BEGIN TRANSACTION');
    },

    /**
     * コミット
     * @returns {Promise<void>}
     */
    commit: () => {
        return db.run('COMMIT');
    },

    /**
     * ロールバック
     * @returns {Promise<void>}
     */
    rollback: () => {
        return db.run('ROLLBACK');
    }
};

module.exports = db;