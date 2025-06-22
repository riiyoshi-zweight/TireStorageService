// routes/reservations.js - 予約管理API

const express = require('express');
const router = express.Router();
const database = require('../database/connection');

/**
 * 顧客の予約確認
 * GET /api/reservations/check/:line_user_id
 */
router.get('/check/:line_user_id', async (req, res) => {
    try {
        const { line_user_id } = req.params;
        
        if (!line_user_id) {
            return res.status(400).json({
                success: false,
                error: 'LINE User ID is required'
            });
        }
        
        // 顧客情報の確認
        const customer = await database.get(
            'SELECT * FROM customers WHERE line_user_id = ? AND is_active = 1',
            [line_user_id]
        );
        
        if (!customer) {
            return res.json({
                success: true,
                customer_registered: false,
                message: 'お客様情報が登録されていません。まずは予約画面からお客様情報をご登録ください。'
            });
        }
        
        // 直近の予約を取得（今日以降）
        const upcomingReservation = await database.get(`
            SELECT 
                r.reservation_id,
                r.reservation_status,
                r.created_at,
                ad.available_date,
                ad.available_time,
                c.customer_name,
                c.car_model
            FROM reservations r
            JOIN available_dates ad ON r.available_date_id = ad.available_date_id
            JOIN customers c ON r.customer_id = c.customer_id
            WHERE c.line_user_id = ? 
                AND r.reservation_status = 'confirmed'
                AND ad.available_date >= DATE('now')
            ORDER BY ad.available_date ASC, ad.available_time ASC
            LIMIT 1
        `, [line_user_id]);
        
        if (upcomingReservation) {
            // 日付を日本語形式にフォーマット
            const dateObj = new Date(upcomingReservation.available_date);
            const month = dateObj.getMonth() + 1;
            const day = dateObj.getDate();
            const formattedDate = `${month}月${day}日`;
            
            res.json({
                success: true,
                customer_registered: true,
                has_reservation: true,
                reservation: {
                    date: formattedDate,
                    time: upcomingReservation.available_time,
                    car_model: upcomingReservation.car_model,
                    customer_name: upcomingReservation.customer_name
                },
                message: `予約の日付は${formattedDate}です。当日は${upcomingReservation.car_model}にご乗車の上、ミスタータイマン高田店までお越しください。`
            });
        } else {
            res.json({
                success: true,
                customer_registered: true,
                has_reservation: false,
                message: '現在ご予約はありません。'
            });
        }
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'システムエラーが発生しました',
            details: error.message
        });
    }
});

/**
 * 予約作成
 * POST /api/reservations
 */
router.post('/', async (req, res) => {
    try {
        const { available_date_id, line_user_id } = req.body;
        
        // 入力値検証
        if (!available_date_id || !line_user_id) {
            return res.status(400).json({
                success: false,
                error: '必須項目が不足しています'
            });
        }
        
        // 利用可能日程の確認
        const availableDate = await database.get(
            'SELECT * FROM available_dates WHERE available_date_id = ? AND is_active = 1',
            [available_date_id]
        );
        
        if (!availableDate) {
            return res.status(404).json({
                success: false,
                error: '指定された日程が見つかりません'
            });
        }
        
        // 顧客情報の確認
        const customer = await database.get(
            'SELECT * FROM customers WHERE line_user_id = ?',
            [line_user_id]
        );
        
        if (!customer) {
            return res.status(404).json({
                success: false,
                error: '顧客情報が見つかりません'
            });
        }
        
        // 重複予約チェック
        const existingReservation = await database.get(
            'SELECT * FROM reservations WHERE available_date_id = ? AND reservation_status != "cancelled"',
            [available_date_id]
        );
        
        if (existingReservation) {
            return res.status(409).json({
                success: false,
                error: '選択された日程は既に予約されています'
            });
        }
        
        // 予約作成
        const reservationId = `res_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const now = new Date().toISOString();
        
        await database.run(`
            INSERT INTO reservations 
            (reservation_id, customer_id, available_date_id, reservation_status, 
             created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [
            reservationId, 
            customer.customer_id, 
            available_date_id, 
            'confirmed',
            now, 
            now
        ]);
        
        res.json({
            success: true,
            message: '予約が確定されました',
            data: {
                reservation_id: reservationId,
                customer_name: customer.customer_name,
                reservation_date: availableDate.available_date,
                reservation_time: availableDate.available_time,
                car_model: customer.car_model
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
 * 予約一覧取得
 * GET /api/reservations
 */
router.get('/', async (req, res) => {
    try {
        const { status, customer_id, date, limit = 50, offset = 0 } = req.query;
        
        let query = `
            SELECT 
                r.reservation_id,
                r.reservation_status,
                r.created_at,
                r.updated_at,
                c.customer_name,
                c.customer_phone,
                c.car_model,
                c.line_user_id,
                ad.available_date,
                ad.available_time
            FROM reservations r
            JOIN customers c ON r.customer_id = c.customer_id
            JOIN available_dates ad ON r.available_date_id = ad.available_date_id
            WHERE 1=1
        `;
        
        const params = [];
        
        if (status) {
            query += ' AND r.reservation_status = ?';
            params.push(status);
        }
        
        if (customer_id) {
            query += ' AND r.customer_id = ?';
            params.push(customer_id);
        }
        
        if (date) {
            query += ' AND ad.available_date = ?';
            params.push(date);
        }
        
        query += ' ORDER BY ad.available_date DESC, ad.available_time DESC';
        query += ' LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));
        
        const reservations = await database.all(query, params);
        
        // 総数取得
        const countQuery = query.replace(/SELECT.*?FROM/, 'SELECT COUNT(*) as count FROM')
                                .replace(/ORDER BY.*$/, '')
                                .replace(/LIMIT.*$/, '');
        const countResult = await database.get(countQuery, params.slice(0, -2));
        
        res.json({
            success: true,
            data: reservations,
            pagination: {
                total: countResult.count,
                limit: parseInt(limit),
                offset: parseInt(offset),
                has_more: (parseInt(offset) + reservations.length) < countResult.count
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

module.exports = router;