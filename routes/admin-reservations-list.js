// routes/admin-reservations-list.js - 管理者用予約一覧API

const express = require('express');
const router = express.Router();
const database = require('../database/connection');
const { authenticateAdmin } = require('./admin-auth');

// 全ルートに管理者認証を適用
router.use(authenticateAdmin);

/**
 * 予約一覧取得
 * GET /api/admin/reservations-list
 */
router.get('/', async (req, res) => {
    try {
        const { start_date, end_date, limit = 1000 } = req.query;
        
        // パラメータバリデーション
        if (!start_date || !end_date) {
            return res.status(400).json({
                success: false,
                error: 'start_date と end_date は必須です'
            });
        }
        
        // 日付バリデーション
        const startDate = new Date(start_date);
        const endDate = new Date(end_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (startDate < today) {
            return res.status(400).json({
                success: false,
                error: '開始日は今日以降を指定してください'
            });
        }
        
        // 期間制限チェック（最大1ヶ月）
        const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
        if (daysDiff > 31) {
            return res.status(400).json({
                success: false,
                error: '検索期間は最大1ヶ月までです'
            });
        }
        
        // 予約一覧取得クエリ
        const query = `
            SELECT 
                ad.available_date,
                ad.available_time,
                c.customer_name,
                c.car_model,
                r.reservation_id,
                r.reservation_status,
                r.created_at as reservation_created
            FROM reservations r
            JOIN customers c ON r.customer_id = c.customer_id
            JOIN available_dates ad ON r.available_date_id = ad.available_date_id
            WHERE r.reservation_status != 'cancelled'
                AND ad.available_date >= DATE('now')
                AND ad.available_date BETWEEN ? AND ?
            ORDER BY ad.available_date ASC, ad.available_time ASC
            LIMIT ?
        `;
        
        const reservations = await database.all(query, [start_date, end_date, parseInt(limit)]);
        
        // 統計情報も取得
        const statsQuery = `
            SELECT 
                COUNT(*) as total_count,
                COUNT(CASE WHEN r.reservation_status = 'confirmed' THEN 1 END) as confirmed_count,
                COUNT(CASE WHEN r.reservation_status = 'pending' THEN 1 END) as pending_count
            FROM reservations r
            JOIN available_dates ad ON r.available_date_id = ad.available_date_id
            WHERE r.reservation_status != 'cancelled'
                AND ad.available_date >= DATE('now')
                AND ad.available_date BETWEEN ? AND ?
        `;
        
        const stats = await database.get(statsQuery, [start_date, end_date]);
        
        res.json({
            success: true,
            data: reservations,
            statistics: {
                total_count: stats.total_count,
                confirmed_count: stats.confirmed_count,
                pending_count: stats.pending_count,
                search_period: {
                    start_date,
                    end_date,
                    days: daysDiff
                }
            },
            count: reservations.length
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
 * 予約一覧エクスポート用データ取得
 * GET /api/admin/reservations-list/export
 */
router.get('/export', async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        
        if (!start_date || !end_date) {
            return res.status(400).json({
                success: false,
                error: 'start_date と end_date は必須です'
            });
        }
        
        // エクスポート用のクリーンなデータを取得
        const query = `
            SELECT 
                ad.available_date as date,
                ad.available_time as time,
                c.customer_name as customer,
                c.car_model as vehicle
            FROM reservations r
            JOIN customers c ON r.customer_id = c.customer_id
            JOIN available_dates ad ON r.available_date_id = ad.available_date_id
            WHERE r.reservation_status != 'cancelled'
                AND ad.available_date >= DATE('now')
                AND ad.available_date BETWEEN ? AND ?
            ORDER BY ad.available_date ASC, ad.available_time ASC
        `;
        
        const exportData = await database.all(query, [start_date, end_date]);
        
        // 日付フォーマット調整
        const formattedData = exportData.map(item => ({
            date: item.date,
            time: item.time.substring(0, 5), // HH:MM形式
            customer: item.customer,
            vehicle: item.vehicle
        }));
        
        res.json({
            success: true,
            data: formattedData,
            export_info: {
                start_date,
                end_date,
                generated_at: new Date().toISOString(),
                total_records: formattedData.length
            }
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
 * デフォルト期間取得（今日から1週間）
 * GET /api/admin/reservations-list/default-period
 */
router.get('/default-period', async (req, res) => {
    try {
        const today = new Date();
        const oneWeekLater = new Date();
        oneWeekLater.setDate(today.getDate() + 7);
        
        const startDate = today.toISOString().split('T')[0];
        const endDate = oneWeekLater.toISOString().split('T')[0];
        
        res.json({
            success: true,
            default_period: {
                start_date: startDate,
                end_date: endDate,
                description: '今日から1週間'
            }
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'システムエラーが発生しました'
        });
    }
});

module.exports = router;