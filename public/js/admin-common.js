// public/js/admin-common.js - 管理者専用共通ライブラリ

/**
 * 管理者専用共通ライブラリ
 * LIFF機能を含まない、管理者認証専用版
 */
const AdminCommonLib = {
    // 基本設定
    CONFIG: {
        API_BASE: window.location.origin,
        SESSION_KEY: 'admin_session',
        TIMEOUT: 30000 // 30秒
    },

    /**
     * 安全なfetch実行
     * @param {string} url - リクエストURL
     * @param {Object} options - fetchオプション
     * @returns {Promise<Object>} レスポンスデータ
     */
    async safeFetch(url, options = {}) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.CONFIG.TIMEOUT);
            
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            return data;
            
        } catch (error) {
            throw error;
        }
    },

    /**
     * 管理者認証状態確認
     * @returns {Promise<Object|false>} セッション情報またはfalse
     */
    async checkAdminAuth() {
        try {
            const sessionData = sessionStorage.getItem(this.CONFIG.SESSION_KEY);
            
            if (!sessionData) {
                return false;
            }
            
            const session = JSON.parse(sessionData);
            
            // セッション有効期限チェック（24時間）
            const expiryTime = new Date(session.expiry);
            const now = new Date();
            
            if (now > expiryTime) {
                this.clearAdminSession();
                return false;
            }
            
            return session;
            
        } catch (error) {
            this.clearAdminSession();
            return false;
        }
    },

    /**
     * 管理者セッション保存
     * @param {Object} userData - ユーザーデータ
     */
    saveAdminSession(userData) {
        const expiry = new Date();
        expiry.setHours(expiry.getHours() + 24); // 24時間有効
        
        const sessionData = {
            ...userData,
            expiry: expiry.toISOString(),
            loginTime: new Date().toISOString()
        };
        
        sessionStorage.setItem(this.CONFIG.SESSION_KEY, JSON.stringify(sessionData));
    },

    /**
     * 管理者セッションクリア
     */
    clearAdminSession() {
        sessionStorage.removeItem(this.CONFIG.SESSION_KEY);
    },

    /**
     * 管理者ログアウト
     */
    logout() {
        this.clearAdminSession();
        this.redirectToPage('./admin-login.html', '管理者ログイン');
    },

    /**
     * 認証が必要な場合のログイン画面リダイレクト
     * @param {string} currentPage - 現在のページ
     */
    redirectToLogin(currentPage = null) {
        if (!currentPage) {
            currentPage = window.location.pathname;
        }
        
        let loginUrl = './admin-login.html';
        
        // リダイレクト先をURLパラメータとして追加
        if (currentPage && currentPage !== '/admin-login.html') {
            const redirectParam = encodeURIComponent(currentPage);
            loginUrl += `?redirect=${redirectParam}`;
        }
        
        this.redirectToPage(loginUrl, '管理者ログイン');
    },

    /**
     * 管理者認証付きAPI呼び出し
     * @param {string} url - リクエストURL
     * @param {Object} options - fetchオプション
     * @returns {Promise<Object>} レスポンスデータ
     */
    async authenticatedFetch(url, options = {}) {
        const session = await this.checkAdminAuth();
        
        if (!session) {
            this.logout();
            throw new Error('管理者認証が必要です');
        }
        
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.manager_id}`,
            ...options.headers
        };
        
        return this.safeFetch(url, {
            ...options,
            headers
        });
    },

    /**
     * ページリダイレクト
     * @param {string} url - リダイレクト先URL
     * @param {string} message - メッセージ（オプション）
     */
    redirectToPage(url, message = '') {
        window.location.href = url;
    },

    /**
     * 管理者ログイン実行
     * @param {string} username - ユーザー名
     * @param {string} password - パスワード
     * @returns {Promise<Object>} ログイン結果
     */
    async performAdminLogin(username, password) {
        try {
            const response = await this.safeFetch('/api/admin/login', {
                method: 'POST',
                body: JSON.stringify({
                    username: username,
                    password: password
                })
            });
            
            if (response.success) {
                this.saveAdminSession(response.manager);
                return response;
            } else {
                throw new Error(response.error || 'ログインに失敗しました');
            }
            
        } catch (error) {
            throw error;
        }
    },

    /**
     * エラー表示
     * @param {string} message - エラーメッセージ
     * @param {string} details - 詳細（オプション）
     */
    showError(message, details = '') {
        // エラー表示要素を作成
        const errorHtml = `
            <div style="
                position: fixed;
                top: 20px;
                right: 20px;
                background: #dc3545;
                color: white;
                padding: 15px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                z-index: 10000;
                max-width: 300px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            ">
                <div style="font-weight: bold; margin-bottom: 5px;">エラー</div>
                <div style="font-size: 14px;">${message}</div>
                ${details ? `<div style="font-size: 12px; margin-top: 5px; opacity: 0.8;">${details}</div>` : ''}
            </div>
        `;
        
        const errorDiv = document.createElement('div');
        errorDiv.innerHTML = errorHtml;
        document.body.appendChild(errorDiv);
        
        // 5秒後に自動削除
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 5000);
    },

    /**
     * 成功メッセージ表示
     * @param {string} message - 成功メッセージ
     */
    showSuccess(message) {
        const successHtml = `
            <div style="
                position: fixed;
                top: 20px;
                right: 20px;
                background: #28a745;
                color: white;
                padding: 15px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                z-index: 10000;
                max-width: 300px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            ">
                <div style="font-weight: bold; margin-bottom: 5px;">成功</div>
                <div style="font-size: 14px;">${message}</div>
            </div>
        `;
        
        const successDiv = document.createElement('div');
        successDiv.innerHTML = successHtml;
        document.body.appendChild(successDiv);
        
        // 3秒後に自動削除
        setTimeout(() => {
            if (successDiv.parentNode) {
                successDiv.parentNode.removeChild(successDiv);
            }
        }, 3000);
    },

    /**
     * ローディング表示
     * @param {string} message - ローディングメッセージ
     */
    showLoading(message = '処理中...') {
        const loadingHtml = `
            <div id="admin-loading" style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.7);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10000;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            ">
                <div style="
                    background: white;
                    padding: 30px;
                    border-radius: 12px;
                    text-align: center;
                    min-width: 200px;
                ">
                    <div style="
                        width: 40px;
                        height: 40px;
                        border: 4px solid #f3f3f3;
                        border-top: 4px solid #007bff;
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                        margin: 0 auto 15px;
                    "></div>
                    <div style="color: #333; font-size: 16px;">${message}</div>
                </div>
            </div>
            <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;
        
        const loadingDiv = document.createElement('div');
        loadingDiv.innerHTML = loadingHtml;
        document.body.appendChild(loadingDiv);
    },

    /**
     * ローディング非表示
     */
    hideLoading() {
        const loading = document.getElementById('admin-loading');
        if (loading && loading.parentNode) {
            loading.parentNode.removeChild(loading);
        }
    },

    /**
     * 日付フォーマット
     * @param {string} dateString - 日付文字列
     * @returns {string} フォーマット済み日付
     */
    formatDate(dateString) {
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('ja-JP', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            return dateString;
        }
    },

    /**
     * 初期化
     */
    init() {
        // グローバルエラーハンドラー
        window.addEventListener('error', (event) => {
            console.error('JavaScript エラー:', event.error);
        });
        
        // 未処理のPromise拒否をキャッチ
        window.addEventListener('unhandledrejection', (event) => {
            console.error('未処理のPromise拒否:', event.reason);
        });
    }
};

// 初期化実行
document.addEventListener('DOMContentLoaded', () => {
    AdminCommonLib.init();
});

// グローバルに公開
window.AdminCommonLib = AdminCommonLib;