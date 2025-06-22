// routes/admin-auth.js - 管理者認証API

const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const database = require('../database/connection');

/**
 * 管理者ログイン
 * POST /api/admin/login
 */
router.post('/login', async (req, res) => {
    try {
        const { username, password, line_user_id } = req.body;
        
        // バリデーション
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                error: 'ユーザー名とパスワードは必須です'
            });
        }
        
        // 管理者情報取得
        const manager = await database.get(`
            SELECT 
                manager_id,
                username,
                password_hash,
                is_active,
                created_at
            FROM manager_list 
            WHERE username = ? AND is_active = 1
        `, [username]);
        
        if (!manager) {
            return res.status(401).json({
                success: false,
                error: 'ユーザー名またはパスワードが正しくありません'
            });
        }
        
        // パスワード検証
        const passwordMatch = await bcrypt.compare(password, manager.password_hash);
        
        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                error: 'ユーザー名またはパスワードが正しくありません'
            });
        }
        
        // 最終ログイン時間を更新
        await database.run(`
            UPDATE manager_list 
            SET updated_at = datetime('now')
            WHERE manager_id = ?
        `, [manager.manager_id]);
        
        // レスポンス用データ
        const responseData = {
            manager_id: manager.manager_id,
            username: manager.username,
            login_time: new Date().toISOString(),
            line_user_id: line_user_id || null
        };
        
        res.json({
            success: true,
            message: 'ログインに成功しました',
            manager: responseData
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'システムエラーが発生しました',
            details: error.message
        });
    }
});

/**
 * 管理者認証確認
 * GET /api/admin/verify
 */
router.get('/verify', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: '認証が必要です'
            });
        }
        
        const managerId = authHeader.replace('Bearer ', '');
        
        // 管理者情報確認
        const manager = await database.get(`
            SELECT 
                manager_id,
                username,
                is_active,
                created_at
            FROM manager_list 
            WHERE manager_id = ? AND is_active = 1
        `, [managerId]);
        
        if (!manager) {
            return res.status(401).json({
                success: false,
                error: '無効な認証です'
            });
        }
        
        res.json({
            success: true,
            manager: {
                manager_id: manager.manager_id,
                username: manager.username
            }
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'システムエラーが発生しました'
        });
    }
});

/**
 * 管理者ログアウト
 * POST /api/admin/logout
 */
router.post('/logout', async (req, res) => {
    try {
        // クライアント側でセッションクリアするため、サーバー側では特に処理なし
        res.json({
            success: true,
            message: 'ログアウトしました'
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'システムエラーが発生しました'
        });
    }
});

/**
 * パスワード変更
 * POST /api/admin/change-password
 */
router.post('/change-password', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        const { current_password, new_password } = req.body;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: '認証が必要です'
            });
        }
        
        if (!current_password || !new_password) {
            return res.status(400).json({
                success: false,
                error: '現在のパスワードと新しいパスワードは必須です'
            });
        }
        
        if (new_password.length < 6) {
            return res.status(400).json({
                success: false,
                error: '新しいパスワードは6文字以上である必要があります'
            });
        }
        
        const managerId = authHeader.replace('Bearer ', '');
        
        // 現在の管理者情報取得
        const manager = await database.get(`
            SELECT manager_id, username, password_hash
            FROM manager_list 
            WHERE manager_id = ? AND is_active = 1
        `, [managerId]);
        
        if (!manager) {
            return res.status(401).json({
                success: false,
                error: '無効な認証です'
            });
        }
        
        // 現在のパスワード確認
        const passwordMatch = await bcrypt.compare(current_password, manager.password_hash);
        
        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                error: '現在のパスワードが正しくありません'
            });
        }
        
        // 新しいパスワードをハッシュ化
        const newPasswordHash = await bcrypt.hash(new_password, 10);
        
        // パスワード更新
        await database.run(`
            UPDATE manager_list 
            SET password_hash = ?, updated_at = datetime('now')
            WHERE manager_id = ?
        `, [newPasswordHash, managerId]);
        
        res.json({
            success: true,
            message: 'パスワードが変更されました'
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'システムエラーが発生しました'
        });
    }
});

/**
 * 管理者認証ミドルウェア
 * @param {Object} req - リクエスト
 * @param {Object} res - レスポンス
 * @param {Function} next - 次のミドルウェア
 */
const authenticateAdmin = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: '管理者認証が必要です'
            });
        }
        
        const managerId = authHeader.replace('Bearer ', '');
        
        const manager = await database.get(`
            SELECT manager_id, username, is_active
            FROM manager_list 
            WHERE manager_id = ? AND is_active = 1
        `, [managerId]);
        
        if (!manager) {
            return res.status(401).json({
                success: false,
                error: '無効な管理者認証です'
            });
        }
        
        // リクエストに管理者情報を追加
        req.admin = manager;
        next();
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'システムエラーが発生しました'
        });
    }
};

module.exports = {
    router,
    authenticateAdmin
};