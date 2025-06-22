// routes/available-dates.js - 利用可能日程管理API

const express = require('express');
const router = express.Router();
const database = require('../database/connection');

/**
 * 営業設定取得
 * GET /api/available-dates/settings
 */
router.get('/settings', async (req, res) => {
    try {
        // デフォルト設定
        const defaultSettings = {
            business_hours_start: { value: '09:00' },
            business_hours_end: { value: '18:00' },
            reservation_interval_minutes: { value: '30' }
        };
        
        res.json({
            success: true,
            settings: defaultSettings
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
 * 利用可能日程取得（予約済み除外）
 * GET /api/available-dates
 */
router.get('/', async (req, res) => {
    try {
        const { date, limit = 100, offset = 0 } = req.query;
        
        // 予約済みの日程を除外するクエリ
        let query = `
            SELECT 
                ad.available_date_id,
                ad.available_date,
                ad.available_time,
                ad.is_active,
                ad.created_at,
                ad.updated_at
            FROM available_dates ad
            LEFT JOIN reservations r ON ad.available_date_id = r.available_date_id 
                AND r.reservation_status != 'cancelled'
            WHERE ad.is_active = 1
                AND r.reservation_id IS NULL
                AND ad.available_date >= DATE("now")
        `;
        
        const params = [];
        
        if (date) {
            query += ' AND ad.available_date = ?';
            params.push(date);
        }
        
        query += ' ORDER BY ad.available_date ASC, ad.available_time ASC';
        query += ' LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));
        
        const availableDates = await database.all(query, params);
        
        // 総数取得
        let countQuery = `
            SELECT COUNT(*) as count
            FROM available_dates ad
            LEFT JOIN reservations r ON ad.available_date_id = r.available_date_id 
                AND r.reservation_status != 'cancelled'
            WHERE ad.is_active = 1 
                AND ad.available_date >= DATE("now")
                AND r.reservation_id IS NULL
        `;
        
        const countParams = [];
        if (date) {
            countQuery += ' AND ad.available_date = ?';
            countParams.push(date);
        }
        
        const countResult = await database.get(countQuery, countParams);
        
        res.json({
            success: true,
            data: availableDates,
            count: countResult.count,
            pagination: {
                total: countResult.count,
                limit: parseInt(limit),
                offset: parseInt(offset),
                has_more: (parseInt(offset) + availableDates.length) < countResult.count
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
 * 利用可能日程作成
 * POST /api/available-dates
 */
router.post('/', async (req, res) => {
    try {
        const { available_date, available_time } = req.body;
        
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
        
        const availableDateId = `avail_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const now = new Date().toISOString();
        
        await database.run(`
            INSERT INTO available_dates 
            (available_date_id, available_date, available_time, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [availableDateId, available_date, available_time, 1, now, now]);
        
        res.json({
            success: true,
            message: '利用可能日程が作成されました',
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
 * 利用可能日程削除
 * DELETE /api/available-dates/:available_date_id
 */
router.delete('/:available_date_id', async (req, res) => {
    try {
        const { available_date_id } = req.params;
        
        const existing = await database.get(
            'SELECT * FROM available_dates WHERE available_date_id = ?',
            [available_date_id]
        );
        
        if (!existing) {
            return res.status(404).json({
                success: false,
                error: '指定された利用可能日程が見つかりません'
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
                error: 'この日程には予約が入っているため削除できません'
            });
        }
        
        await database.run(
            'DELETE FROM available_dates WHERE available_date_id = ?',
            [available_date_id]
        );
        
        res.json({
            success: true,
            message: '利用可能日程が削除されました'
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
 * 利用可能日程の一括作成
 * POST /api/available-dates/bulk
 */
router.post('/bulk', async (req, res) => {
    try {
        const { date, start_time, end_time, interval_minutes = 30 } = req.body;
        
        if (!date || !start_time || !end_time) {
            return res.status(400).json({
                success: false,
                error: 'date, start_time, end_time は必須です'
            });
        }
        
        // 時間枠を生成
        const slots = generateTimeSlots(date, start_time, end_time, interval_minutes);
        
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
                        (available_date_id, available_date, available_time, is_active, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?)
                    `, [availableDateId, slot.available_date, slot.available_time, 1, now, now]);
                    createdCount++;
                }
            } catch (slotError) {
                // 個別のスロット作成エラーは無視して続行
            }
        }
        
        res.json({
            success: true,
            message: `${createdCount}件の利用可能日程が作成されました`,
            created_count: createdCount,
            total_slots: slots.length
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
 * 時間枠を生成する関数
 * @param {string} date - 日付
 * @param {string} startTime - 開始時刻
 * @param {string} endTime - 終了時刻
 * @param {number} intervalMinutes - 間隔（分）
 * @returns {Array} 時間枠の配列
 */
function generateTimeSlots(date, startTime, endTime, intervalMinutes) {
    const slots = [];
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);
    
    let currentTime = new Date();
    currentTime.setHours(startHour, startMinute, 0, 0);
    
    const endTimeObj = new Date();
    endTimeObj.setHours(endHour, endMinute, 0, 0);
    
    while (currentTime < endTimeObj) {
        const timeString = currentTime.toTimeString().slice(0, 5);
        slots.push({
            available_date: date,
            available_time: timeString + ':00'
        });
        currentTime.setMinutes(currentTime.getMinutes() + intervalMinutes);
    }
    
    return slots;
}

module.exports = router;