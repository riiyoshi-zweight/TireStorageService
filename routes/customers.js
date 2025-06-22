// routes/customers.js - 顧客管理API

const express = require('express');
const router = express.Router();
const database = require('../database/connection');

/**
 * 顧客登録確認
 * GET /api/customers/check/:line_user_id
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
        
        // 顧客情報を検索
        const customer = await database.get(
            'SELECT * FROM customers WHERE line_user_id = ? AND is_active = 1',
            [line_user_id]
        );
        
        if (customer) {
            res.json({
                success: true,
                exists: true,
                customer: {
                    customer_id: customer.customer_id,
                    customer_name: customer.customer_name,
                    customer_phone: customer.customer_phone,
                    car_model: customer.car_model,
                    is_light_vehicle: Boolean(customer.is_light_vehicle),
                    created_at: customer.created_at,
                    updated_at: customer.updated_at
                }
            });
        } else {
            res.json({
                success: true,
                exists: false,
                customer: null
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
 * 新規顧客登録
 * POST /api/customers/register
 */
router.post('/register', async (req, res) => {
    try {
        const { 
            customer_name, 
            customer_phone, 
            car_model, 
            is_light_vehicle = false, 
            line_user_id 
        } = req.body;
        
        // 入力値検証
        const validationErrors = validateCustomerData({
            customer_name,
            customer_phone,
            car_model,
            line_user_id
        });
        
        if (validationErrors.length > 0) {
            return res.status(400).json({
                success: false,
                error: '入力値に不備があります',
                validation_errors: validationErrors
            });
        }
        
        // 既存顧客チェック
        const existingCustomer = await database.get(
            'SELECT customer_id FROM customers WHERE line_user_id = ?',
            [line_user_id]
        );
        
        if (existingCustomer) {
            return res.status(409).json({
                success: false,
                error: '既に登録済みのお客様です',
                existing_customer_id: existingCustomer.customer_id
            });
        }
        
        // 電話番号重複チェック
        const existingPhone = await database.get(
            'SELECT customer_id FROM customers WHERE customer_phone = ? AND is_active = 1',
            [customer_phone]
        );
        
        if (existingPhone) {
            return res.status(409).json({
                success: false,
                error: 'この電話番号は既に登録されています'
            });
        }
        
        // 新規顧客登録
        const customerId = `cust_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const now = new Date().toISOString();
        
        await database.run(`
            INSERT INTO customers 
            (customer_id, customer_name, customer_phone, car_model, 
             is_light_vehicle, line_user_id, created_at, updated_at, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
        `, [
            customerId, 
            customer_name, 
            customer_phone, 
            car_model, 
            is_light_vehicle ? 1 : 0, 
            line_user_id, 
            now, 
            now
        ]);
        
        res.json({
            success: true,
            message: 'お客様情報の登録が完了しました',
            data: {
                customer_id: customerId,
                customer_name: customer_name,
                customer_phone: customer_phone,
                car_model: car_model,
                is_light_vehicle: Boolean(is_light_vehicle),
                line_user_id: line_user_id
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
 * 既存顧客情報更新
 * PUT /api/customers/update/:line_user_id
 */
router.put('/update/:line_user_id', async (req, res) => {
    try {
        const { line_user_id } = req.params;
        const { 
            customer_name, 
            customer_phone, 
            car_model, 
            is_light_vehicle = false 
        } = req.body;
        
        if (!line_user_id) {
            return res.status(400).json({
                success: false,
                error: 'LINE User ID is required'
            });
        }
        
        // 更新対象の顧客存在確認
        const existingCustomer = await database.get(
            'SELECT * FROM customers WHERE line_user_id = ? AND is_active = 1',
            [line_user_id]
        );
        
        if (!existingCustomer) {
            return res.status(404).json({
                success: false,
                error: '更新対象の顧客が見つかりません'
            });
        }
        
        // 入力値検証
        const validationErrors = validateCustomerData({
            customer_name,
            customer_phone,
            car_model,
            line_user_id
        });
        
        if (validationErrors.length > 0) {
            return res.status(400).json({
                success: false,
                error: '入力値に不備があります',
                validation_errors: validationErrors
            });
        }
        
        // 電話番号重複チェック（自分以外）
        const phoneConflict = await database.get(
            'SELECT customer_id FROM customers WHERE customer_phone = ? AND line_user_id != ? AND is_active = 1',
            [customer_phone, line_user_id]
        );
        
        if (phoneConflict) {
            return res.status(409).json({
                success: false,
                error: 'この電話番号は他のお客様が使用中です'
            });
        }
        
        // 顧客情報更新
        const now = new Date().toISOString();
        
        await database.run(`
            UPDATE customers 
            SET customer_name = ?, customer_phone = ?, car_model = ?, 
                is_light_vehicle = ?, updated_at = ?
            WHERE line_user_id = ? AND is_active = 1
        `, [
            customer_name, 
            customer_phone, 
            car_model, 
            is_light_vehicle ? 1 : 0, 
            now,
            line_user_id
        ]);
        
        res.json({
            success: true,
            message: 'お客様情報を更新しました',
            data: {
                customer_id: existingCustomer.customer_id,
                customer_name: customer_name,
                customer_phone: customer_phone,
                car_model: car_model,
                is_light_vehicle: Boolean(is_light_vehicle),
                line_user_id: line_user_id
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
 * 顧客一覧取得（管理画面用）
 * GET /api/customers
 */
router.get('/', async (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;
        
        const customers = await database.all(`
            SELECT 
                customer_id,
                customer_name,
                customer_phone,
                car_model,
                is_light_vehicle,
                line_user_id,
                created_at,
                updated_at
            FROM customers 
            WHERE is_active = 1
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `, [parseInt(limit), parseInt(offset)]);
        
        const totalResult = await database.get('SELECT COUNT(*) as total FROM customers WHERE is_active = 1');
        
        res.json({
            success: true,
            data: customers,
            pagination: {
                total: totalResult.total,
                limit: parseInt(limit),
                offset: parseInt(offset),
                has_more: (parseInt(offset) + customers.length) < totalResult.total
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
 * 特定顧客の取得
 * GET /api/customers/profile/:line_user_id
 */
router.get('/profile/:line_user_id', async (req, res) => {
    try {
        const { line_user_id } = req.params;
        
        const customer = await database.get(`
            SELECT * FROM customers WHERE line_user_id = ? AND is_active = 1
        `, [line_user_id]);
        
        if (!customer) {
            return res.status(404).json({
                success: false,
                error: '顧客が見つかりません'
            });
        }
        
        res.json({
            success: true,
            data: {
                customer_id: customer.customer_id,
                customer_name: customer.customer_name,
                customer_phone: customer.customer_phone,
                car_model: customer.car_model,
                is_light_vehicle: Boolean(customer.is_light_vehicle),
                created_at: customer.created_at,
                updated_at: customer.updated_at
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
 * 顧客データバリデーション
 * @param {Object} data - 顧客データ
 * @returns {Array} エラーメッセージ配列
 */
function validateCustomerData(data) {
    const errors = [];
    
    // 名前チェック
    if (!data.customer_name || !data.customer_name.trim()) {
        errors.push('お名前は必須です');
    } else if (data.customer_name.trim().length > 100) {
        errors.push('お名前は100文字以内で入力してください');
    }
    
    // 電話番号チェック
    if (!data.customer_phone || !data.customer_phone.trim()) {
        errors.push('電話番号は必須です');
    } else {
        const phonePattern = /^(\d{3}-\d{4}-\d{4}|\d{4}-\d{2}-\d{4})$/;
        if (!phonePattern.test(data.customer_phone.trim())) {
            errors.push('電話番号は XXX-XXXX-XXXX または XXXX-XX-XXXX の形式で入力してください');
        }
    }
    
    // 車種チェック
    if (!data.car_model || !data.car_model.trim()) {
        errors.push('車種は必須です');
    } else if (data.car_model.trim().length > 100) {
        errors.push('車種は100文字以内で入力してください');
    }
    
    // LINE User ID チェック
    if (!data.line_user_id || !data.line_user_id.trim()) {
        errors.push('LINE User IDは必須です');
    }
    
    return errors;
}

module.exports = router;