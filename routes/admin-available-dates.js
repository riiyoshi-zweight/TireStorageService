// routes/admin-available-dates.js - 管理者用日程管理API

const express = require('express');
const router = express.Router();
const database = require('../database/connection');
const { authenticateAdmin } = require('./admin-auth');

// 全ルートに管理者認証を適用
router.use(authenticateAdmin);

/**
 * 管理者用予約一覧取得
 * GET /api/admin/reservations
 */
router.get('/reservations', async (req, res) => {
    try {
        const { start_date, end_date, status, limit = 1000 } = req.query;
        
        let query = `
            SELECT 
                r.reservation_id,
                r.customer_id,
                r.available_date_id,
                r.reservation_status,
                r.created_at,
                ad.available_date,
                ad.available_time,
                c.customer_name,
                c.customer_phone,
                c.car_model
            FROM reservations r
            INNER JOIN available_dates ad ON r.available_date_id = ad.available_date_id
            INNER JOIN customers c ON r.customer_id = c.customer_id
            WHERE r.reservation_status != 'cancelled'
        `;
        
        const params = [];
        
        if (start_date) {
            query += ' AND ad.available_date >= ?';
            params.push(start_date);
        }
        
        if (end_date) {
            query += ' AND ad.available_date <= ?';
            params.push(end_date);
        }
        
        if (status) {
            query += ' AND r.reservation_status = ?';
            params.push(status);
        }
        
        query += ' ORDER BY ad.available_date ASC, ad.available_time ASC';
        query += ' LIMIT ?';
        params.push(parseInt(limit));
        
        const reservations = await database.all(query, params);
        
        res.json({
            success: true,
            data: reservations,
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
 * 管理者用営業設定取得
 * GET /api/admin/settings
 */
router.get('/settings', async (req, res) => {
    try {
        // system_settingsテーブルから取得
        const settings = {};
        const settingKeys = [
            'business_hours_start',
            'business_hours_end', 
            'reservation_interval_minutes'
        ];
        
        for (const key of settingKeys) {
            try {
                const setting = await database.get(
                    'SELECT setting_value FROM system_settings WHERE setting_key = ?',
                    [key]
                );
                settings[key] = setting ? { value: setting.setting_value } : null;
            } catch (error) {
                settings[key] = null;
            }
        }
        
        // デフォルト値を設定
        if (!settings.business_hours_start?.value) {
            settings.business_hours_start = { value: '09:00' };
        }
        if (!settings.business_hours_end?.value) {
            settings.business_hours_end = { value: '18:00' };
        }
        if (!settings.reservation_interval_minutes?.value) {
            settings.reservation_interval_minutes = { value: '30' };
        }
        
        res.json({
            success: true,
            settings
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
 * 管理者用カレンダーデータ取得
 * GET /api/admin/available-dates
 */
router.get('/available-dates', async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        
        if (!start_date || !end_date) {
            return res.status(400).json({
                success: false,
                error: 'start_date と end_date は必須です'
            });
        }
        
        // 利用可能日程取得（予約済み含む）
        const availableQuery = `
            SELECT 
                ad.available_date_id,
                ad.available_date,
                ad.available_time,
                ad.is_active,
                ad.created_at,
                CASE 
                    WHEN r.reservation_id IS NOT NULL THEN 1 
                    ELSE 0 
                END as has_reservation
            FROM available_dates ad
            LEFT JOIN reservations r ON ad.available_date_id = r.available_date_id 
                AND r.reservation_status != 'cancelled'
            WHERE ad.is_active = 1
                AND ad.available_date >= ?
                AND ad.available_date <= ?
            ORDER BY ad.available_date ASC, ad.available_time ASC
        `;
        
        const availableSlots = await database.all(availableQuery, [start_date, end_date]);
        
        // 予約済み日程の詳細取得
        const reservedQuery = `
            SELECT 
                ad.available_date_id,
                ad.available_date,
                ad.available_time,
                r.reservation_id,
                r.customer_id,
                c.customer_name,
                r.reservation_status,
                r.created_at as reservation_created
            FROM available_dates ad
            INNER JOIN reservations r ON ad.available_date_id = r.available_date_id
            INNER JOIN customers c ON r.customer_id = c.customer_id
            WHERE ad.available_date >= ?
                AND ad.available_date <= ?
                AND r.reservation_status != 'cancelled'
            ORDER BY ad.available_date ASC, ad.available_time ASC
        `;
        
        const reservedSlots = await database.all(reservedQuery, [start_date, end_date]);
        
        // データを分類
        const available = availableSlots.filter(slot => !slot.has_reservation);
        const reserved = reservedSlots;
        
        res.json({
            success: true,
            data: {
                available,
                reserved,
                total: availableSlots.length
            },
            period: { start_date, end_date }
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
 * 個別時間枠作成
 * POST /api/admin/available-dates
 */
router.post('/available-dates', async (req, res) => {
    try {
        const { available_date, available_time } = req.body;
        const adminId = req.admin.manager_id;
        
        if (!available_date || !available_time) {
            return res.status(400).json({
                success: false,
                error: 'available_date と available_time は必須です'
            });
        }
        
        // 重複チェック
        const existing = await database.get(
            'SELECT available_date_id FROM available_dates WHERE available_date = ? AND available_time = ?',
            [available_date, available_time]
        );
        
        if (existing) {
            return res.status(409).json({
                success: false,
                error: '同じ日時の利用可能枠が既に存在します'
            });
        }
        
        // 新規作成
        const availableDateId = `avail_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const now = new Date().toISOString();
        
        await database.run(`
            INSERT INTO available_dates 
            (available_date_id, available_date, available_time, is_active, created_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [availableDateId, available_date, available_time, 1, 'Administrator', now, now]);
        
        res.json({
            success: true,
            message: '時間枠が作成されました',
            data: {
                available_date_id: availableDateId,
                available_date,
                available_time,
                is_active: 1
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
 * 時間枠の一括作成
 * POST /api/admin/available-dates/bulk
 */
router.post('/available-dates/bulk', async (req, res) => {
    try {
        const { slots } = req.body;
        const adminId = req.admin.manager_id;
        
        if (!slots || !Array.isArray(slots) || slots.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'slots配列は必須です'
            });
        }
        
        let createdCount = 0;
        const now = new Date().toISOString();
        const errors = [];
        
        for (const slot of slots) {
            try {
                const { available_date, available_time } = slot;
                
                if (!available_date || !available_time) {
                    errors.push(`無効なスロット: ${JSON.stringify(slot)}`);
                    continue;
                }
                
                // 重複チェック
                const existing = await database.get(
                    'SELECT available_date_id FROM available_dates WHERE available_date = ? AND available_time = ?',
                    [available_date, available_time]
                );
                
                if (existing) {
                    continue;
                }
                
                // 新規作成
                const availableDateId = `avail_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                
                await database.run(`
                    INSERT INTO available_dates 
                    (available_date_id, available_date, available_time, is_active, created_by, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `, [availableDateId, available_date, available_time, 1, 'Administrator', now, now]);
                
                createdCount++;
                
            } catch (slotError) {
                errors.push(`${slot.available_date} ${slot.available_time}: ${slotError.message}`);
            }
        }
        
        res.json({
            success: true,
            message: `${createdCount}件の時間枠を作成しました`,
            created_count: createdCount,
            total_requested: slots.length,
            errors: errors.length > 0 ? errors : undefined
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
 * 期間指定での一括作成
 * POST /api/admin/available-dates/bulk-range
 */
router.post('/available-dates/bulk-range', async (req, res) => {
    try {
        const { start_date, end_date } = req.body;
        
        if (!start_date || !end_date) {
            return res.status(400).json({
                success: false,
                error: 'start_date と end_date は必須です'
            });
        }
        
        // 営業時間設定取得
        const businessSettings = {};
        const settingKeys = ['business_hours_start', 'business_hours_end', 'reservation_interval_minutes'];
        
        for (const key of settingKeys) {
            const setting = await database.get(
                'SELECT setting_value FROM system_settings WHERE setting_key = ?',
                [key]
            );
            businessSettings[key] = setting?.setting_value;
        }
        
        const startTime = businessSettings.business_hours_start || '09:00';
        const endTime = businessSettings.business_hours_end || '18:00';
        const interval = parseInt(businessSettings.reservation_interval_minutes || '30');
        
        // 日付範囲生成
        const startDate = new Date(start_date);
        const endDate = new Date(end_date);
        const slots = [];
        
        for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
            const dateString = date.toISOString().split('T')[0];
            
            // 時間枠生成
            const [startHour, startMinute] = startTime.split(':').map(Number);
            const [endHour, endMinute] = endTime.split(':').map(Number);
            
            let currentTime = new Date();
            currentTime.setHours(startHour, startMinute, 0, 0);
            
            const dayEndTime = new Date();
            dayEndTime.setHours(endHour, endMinute, 0, 0);
            
            while (currentTime < dayEndTime) {
                const timeString = currentTime.toTimeString().slice(0, 5) + ':00';
                slots.push({
                    available_date: dateString,
                    available_time: timeString
                });
                currentTime.setMinutes(currentTime.getMinutes() + interval);
            }
        }
        
        // 一括作成実行
        let createdCount = 0;
        const now = new Date().toISOString();
        
        for (const slot of slots) {
            try {
                // 重複チェック
                const existing = await database.get(
                    'SELECT available_date_id FROM available_dates WHERE available_date = ? AND available_time = ?',
                    [slot.available_date, slot.available_time]
                );
                
                if (!existing) {
                    const availableDateId = `avail_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    
                    await database.run(`
                        INSERT INTO available_dates 
                        (available_date_id, available_date, available_time, is_active, created_by, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    `, [availableDateId, slot.available_date, slot.available_time, 1, 'Administrator', now, now]);
                    
                    createdCount++;
                }
            } catch (slotError) {
                // 個別エラーは無視して続行
            }
        }
        
        res.json({
            success: true,
            message: `${createdCount}件の時間枠を作成しました`,
            created_count: createdCount,
            total_slots: slots.length,
            period: { start_date, end_date }
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
 * 時間枠削除
 * DELETE /api/admin/available-dates/:available_date_id
 */
router.delete('/available-dates/:available_date_id', async (req, res) => {
    try {
        const { available_date_id } = req.params;
        
        // 存在確認
        const existing = await database.get(
            'SELECT * FROM available_dates WHERE available_date_id = ?',
            [available_date_id]
        );
        
        if (!existing) {
            return res.status(404).json({
                success: false,
                error: '指定された時間枠が見つかりません'
            });
        }
        
        // 予約がある場合は削除不可
        const reservation = await database.get(
            'SELECT reservation_id FROM reservations WHERE available_date_id = ? AND reservation_status != "cancelled"',
            [available_date_id]
        );
        
        if (reservation) {
            return res.status(400).json({
                success: false,
                error: 'この時間枠には予約が入っているため削除できません'
            });
        }
        
        // 削除実行
        await database.run(
            'DELETE FROM available_dates WHERE available_date_id = ?',
            [available_date_id]
        );
        
        res.json({
            success: true,
            message: '時間枠が削除されました'
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
 * 予約削除＆利用可能時間作成
 * DELETE /api/admin/reservations/:reservation_id/force-delete
 */
router.delete('/reservations/:reservation_id/force-delete', async (req, res) => {
    try {
        const { reservation_id } = req.params;
        
        // 予約の詳細取得
        const reservation = await database.get(`
            SELECT 
                r.reservation_id,
                r.available_date_id,
                ad.available_date,
                ad.available_time,
                c.customer_name
            FROM reservations r
            INNER JOIN available_dates ad ON r.available_date_id = ad.available_date_id
            INNER JOIN customers c ON r.customer_id = c.customer_id
            WHERE r.reservation_id = ? AND r.reservation_status != 'cancelled'
        `, [reservation_id]);
        
        if (!reservation) {
            return res.status(404).json({
                success: false,
                error: '指定された予約が見つかりません'
            });
        }
        
        // トランザクション開始
        await database.run('BEGIN TRANSACTION');
        
        try {
            // 予約をキャンセル
            await database.run(`
                UPDATE reservations 
                SET reservation_status = 'cancelled', updated_at = datetime('now')
                WHERE reservation_id = ?
            `, [reservation_id]);
            
            await database.run('COMMIT');
            
            res.json({
                success: true,
                message: '予約をキャンセルし、利用可能時間として登録しました',
                data: {
                    cancelled_reservation: reservation_id,
                    available_date: reservation.available_date,
                    available_time: reservation.available_time
                }
            });
            
        } catch (transactionError) {
            await database.run('ROLLBACK');
            throw transactionError;
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
 * 管理者統計情報取得
 * GET /api/admin/statistics
 */
router.get('/statistics', async (req, res) => {
    try {
        const { period = '7' } = req.query;
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + parseInt(period));
        
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];
        
        // 統計クエリ
        const stats = await Promise.all([
            // 総枠数
            database.get(`
                SELECT COUNT(*) as count 
                FROM available_dates 
                WHERE available_date >= ? AND available_date <= ? AND is_active = 1
            `, [startDateStr, endDateStr]),
            
            // 予約済み数
            database.get(`
                SELECT COUNT(*) as count 
                FROM available_dates ad
                INNER JOIN reservations r ON ad.available_date_id = r.available_date_id
                WHERE ad.available_date >= ? AND ad.available_date <= ? 
                    AND ad.is_active = 1 AND r.reservation_status != 'cancelled'
            `, [startDateStr, endDateStr]),
            
            // 今日の予約数
            database.get(`
                SELECT COUNT(*) as count 
                FROM available_dates ad
                INNER JOIN reservations r ON ad.available_date_id = r.available_date_id
                WHERE ad.available_date = date('now') 
                    AND ad.is_active = 1 AND r.reservation_status != 'cancelled'
            `),
            
            // 今週の新規予約数
            database.get(`
                SELECT COUNT(*) as count 
                FROM reservations 
                WHERE created_at >= date('now', 'weekday 0', '-7 days')
                    AND reservation_status != 'cancelled'
            `)
        ]);
        
        const totalSlots = stats[0].count;
        const reservedSlots = stats[1].count;
        
        res.json({
            success: true,
            statistics: {
                total_slots: totalSlots,
                reserved_slots: reservedSlots,
                available_slots: totalSlots - reservedSlots,
                today_reservations: stats[2].count,
                week_new_reservations: stats[3].count,
                utilization_rate: totalSlots > 0 ? Math.round((reservedSlots / totalSlots) * 100) : 0
            },
            period: { start_date: startDateStr, end_date: endDateStr }
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'システムエラーが発生しました'
        });
    }
});

module.exports = router;