/**
 * 共通処理ライブラリ
 * LIFF SDK v2対応
 * 管理者ページ対応版
 */

/**
 * 管理者ページかどうかを判定
 * @returns {boolean} 管理者ページの場合true
 */
function isAdminPage() {
    const path = window.location.pathname;
    const filename = path.split('/').pop();
    
    const adminPages = [
        'admin-login.html',
        'admin-calendar.html',
        'admin.html'
    ];
    
    return adminPages.includes(filename) || 
           path.includes('/admin') ||
           filename.startsWith('admin-');
}

// 管理者ページの場合は専用ライブラリを使用
if (isAdminPage()) {
    // 管理者ページ用の最小限の共通機能のみ提供
    window.CommonLib = {
        CONFIG: {
            API_BASE: window.location.origin
        },
        
        /**
         * ローディング表示
         * @param {string} message - 表示メッセージ
         */
        showLoading(message = '読み込み中...') {
            const existingLoader = document.getElementById('commonLoader');
            if (existingLoader) {
                existingLoader.remove();
            }

            const loader = document.createElement('div');
            loader.id = 'commonLoader';
            loader.innerHTML = `
                <div style="
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(245, 245, 245, 0.95);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    z-index: 10000;
                ">
                    <div style="
                        background: white;
                        padding: 30px;
                        border-radius: 12px;
                        text-align: center;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                    ">
                        <div style="
                            width: 40px;
                            height: 40px;
                            border: 3px solid #f3f3f3;
                            border-top: 3px solid #dc3545;
                            border-radius: 50%;
                            animation: spin 1s linear infinite;
                            margin: 0 auto 20px;
                        "></div>
                        <div style="color: #333; font-size: 16px; font-weight: 600;">${message}</div>
                    </div>
                    <style>
                        @keyframes spin {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                        }
                    </style>
                </div>
            `;
            document.body.appendChild(loader);
        },
        
        /**
         * ローディング非表示
         */
        hideLoading() {
            const loader = document.getElementById('commonLoader');
            if (loader) {
                loader.remove();
            }
        }
    };
} else {
    // 一般ユーザーページ用のLIFF機能

    const CommonLib = {
        CONFIG: {
            API_BASE: window.location.origin,
            LIFF_ID: "2007549033-wxvk1WQY",
            DEMO_USER_ID: 'demo_user_1749924429248'
        },
        
        isLineEnvironment: false,
        
        /**
         * 設定初期化
         */
        init() {
            this.showMenuLink();
        },

        /**
         * 「メニューに戻る」リンクを画面上部に表示（メニュー画面以外）
         */
        showMenuLink() {
            const filename = window.location.pathname.split('/').pop();
            const menuPages = ['', 'liff', 'menu.html'];

            if (menuPages.includes(filename) || document.getElementById('menuLinkBar')) {
                return;
            }

            const bar = document.createElement('div');
            bar.id = 'menuLinkBar';
            bar.innerHTML = `
                <a href="./menu.html" style="
                    display: block;
                    background: white;
                    color: #0097A7;
                    padding: 14px 16px;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    font-size: 16px;
                    font-weight: 600;
                    text-decoration: none;
                    border-bottom: 1px solid #e9ecef;
                ">‹ メニューに戻る</a>
            `;
            document.body.insertBefore(bar, document.body.firstChild);
        },

        /**
         * ローディング表示
         * @param {string} message - 表示メッセージ
         */
        showLoading(message = '読み込み中...') {
            const existingLoader = document.getElementById('commonLoader');
            if (existingLoader) {
                existingLoader.remove();
            }

            const loader = document.createElement('div');
            loader.id = 'commonLoader';
            loader.innerHTML = `
                <div style="
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(245, 245, 245, 0.95);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    z-index: 10000;
                ">
                    <div style="
                        background: white;
                        padding: 30px;
                        border-radius: 12px;
                        text-align: center;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                    ">
                        <div style="
                            width: 40px;
                            height: 40px;
                            border: 3px solid #f3f3f3;
                            border-top: 3px solid #0cc0df;
                            border-radius: 50%;
                            animation: spin 1s linear infinite;
                            margin: 0 auto 20px;
                        "></div>
                        <div style="color: #333; font-size: 16px; font-weight: 600;">${message}</div>
                    </div>
                    <style>
                        @keyframes spin {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                        }
                    </style>
                </div>
            `;
            document.body.appendChild(loader);
        },

        /**
         * ローディング非表示
         */
        hideLoading() {
            const loader = document.getElementById('commonLoader');
            if (loader) {
                loader.remove();
            }
        },

        /**
         * エラー画面表示
         * @param {string} message - エラーメッセージ
         */
        showErrorScreen(message) {
            document.body.innerHTML = `
                <div style="
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: #f5f5f5;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    padding: 20px;
                    box-sizing: border-box;
                ">
                    <div style="
                        background: white;
                        padding: 30px;
                        border-radius: 12px;
                        text-align: center;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                        max-width: 400px;
                        width: 100%;
                    ">
                        <div style="
                            font-size: 48px;
                            color: #dc3545;
                            margin-bottom: 20px;
                        ">✗</div>
                        <h3 style="color: #333; margin-bottom: 15px; font-size: 18px;">システムエラー</h3>
                        <p style="color: #666; margin-bottom: 20px; line-height: 1.5; font-size: 14px;">
                            LIFF環境でのユーザー認証に失敗しました:<br>
                            <span style="font-family: monospace; background: #f8f9fa; padding: 2px 4px; border-radius: 3px; font-size: 12px;">
                                ${message || 'Unknown error'}
                            </span>
                        </p>
                        <button onclick="window.location.reload()" style="
                            background: #0cc0df;
                            color: white;
                            border: none;
                            padding: 12px 24px;
                            border-radius: 8px;
                            font-size: 16px;
                            font-weight: 600;
                            cursor: pointer;
                        ">再試行</button>
                        <div style="margin-top: 15px; font-size: 12px; color: #999;">
                            エラーが続く場合はLINEトークよりお問い合わせください
                        </div>
                    </div>
                </div>
            `;
        },

        /**
         * LIFF初期化
         * @returns {Promise<boolean|null>} 初期化成功時true、ログイン必要時null、エラー時false
         */
        async initializeLiff() {
            try {
                // ローカル開発環境ではLINEログインを行わない（デモユーザーで動作）
                const hostname = window.location.hostname;
                if (hostname === 'localhost' || hostname === '127.0.0.1') {
                    this.isLineEnvironment = false;
                    return false;
                }

                if (typeof liff === 'undefined') {
                    throw new Error('LIFF SDK not loaded');
                }

                // LIFF初期化
                await liff.init({
                    liffId: this.CONFIG.LIFF_ID
                });
                
                // ログイン状態確認
                if (!liff.isLoggedIn()) {
                    liff.login();
                    return null;
                }
                
                this.isLineEnvironment = true;
                return true;
                
            } catch (error) {
                this.isLineEnvironment = false;
                return false;
            }
        },

        /**
         * LINE_USER_ID取得
         * @returns {Promise<string>} ユーザーID
         */
        async getUserId() {
            try {
                // テストモード確認
                const urlParams = new URLSearchParams(window.location.search);
                const testUserId = urlParams.get('test_user');
                
                if (testUserId) {
                    return testUserId;
                }
                
                // LIFF環境確認
                if (!this.isLineEnvironment || typeof liff === 'undefined' || !liff.isLoggedIn()) {
                    return this.CONFIG.DEMO_USER_ID;
                }
                
                // プロフィールから取得
                try {
                    const profile = await liff.getProfile();
                    if (profile && profile.userId) {
                        return profile.userId;
                    }
                } catch (profileError) {
                    // プロフィール取得失敗時はデモユーザー使用
                }
                
                return this.CONFIG.DEMO_USER_ID;
                
            } catch (error) {
                return this.CONFIG.DEMO_USER_ID;
            }
        },

        /**
         * 画面モード取得
         * @returns {string|null} 画面モード
         */
        getDisplayMode() {
            const urlParams = new URLSearchParams(window.location.search);
            let mode = urlParams.get('mode');
            
            if (!mode) {
                const liffState = urlParams.get('liff.state');
                
                if (liffState) {
                    try {
                        const decodedState = decodeURIComponent(liffState);
                        const stateParams = new URLSearchParams(decodedState);
                        mode = stateParams.get('mode');
                        
                        if (!mode) {
                            const modeMatch = decodedState.match(/mode=([^&]*)/);
                            if (modeMatch) {
                                mode = modeMatch[1];
                            }
                        }
                    } catch (error) {
                        // デコードエラーは無視
                    }
                }
            }
            
            return mode;
        },

        /**
         * 画面リダイレクト
         * @param {string} url - リダイレクト先URL
         * @param {string} pageName - ページ名
         * @param {Object} params - URLパラメータ
         */
        redirectToPage(url, pageName, params = {}) {
            let finalUrl = url;
            if (Object.keys(params).length > 0) {
                const urlParams = new URLSearchParams(params);
                finalUrl += '?' + urlParams.toString();
            }
            
            document.body.innerHTML = `
                <div style="
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: #f5f5f5;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    z-index: 10000;
                ">
                    <div style="
                        background: white;
                        padding: 30px;
                        border-radius: 12px;
                        text-align: center;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                        max-width: 300px;
                    ">
                        <div style="
                            width: 40px;
                            height: 40px;
                            border: 3px solid #f3f3f3;
                            border-top: 3px solid #0cc0df;
                            border-radius: 50%;
                            animation: spin 1s linear infinite;
                            margin: 0 auto 20px;
                        "></div>
                        <h3 style="color: #333; margin-bottom: 10px;">画面を切り替えています</h3>
                        <p style="color: #666; font-size: 14px;">${pageName}ページに移動中...</p>
                    </div>
                    <style>
                        @keyframes spin {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                        }
                    </style>
                </div>
            `;
            
            setTimeout(() => {
                try {
                    window.location.replace(finalUrl);
                } catch (error) {
                    window.location.href = finalUrl;
                }
            }, 100);
        },

        /**
         * APIレスポンス処理
         * @param {Response} response - Fetchレスポンス
         * @returns {Promise<Object>} JSONレスポンス
         */
        async handleApiResponse(response) {
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API Error: ${response.status} - ${errorText}`);
            }
            
            const result = await response.json();
            
            if (result.success === false) {
                throw new Error(result.error || result.message || 'API request failed');
            }
            
            return result;
        },

        /**
         * 顧客情報確認
         * @param {string} userId - ユーザーID
         * @returns {Promise<Object>} 顧客情報
         */
        async checkCustomer(userId) {
            try {
                const response = await fetch(`${this.CONFIG.API_BASE}/api/customers/check/${userId}`);
                const result = await this.handleApiResponse(response);
                return result;
            } catch (error) {
                throw error;
            }
        },

        /**
         * 認証のみ初期化（顧客確認なし）
         * @param {string} pageName - ページ名
         * @returns {Promise<Object|null>} 認証結果
         */
        async initializePageAuth(pageName) {
            try {
                this.init();
                
                // LIFF初期化
                const liffResult = await this.initializeLiff();
                if (liffResult === null) {
                    // ログイン画面にリダイレクト中
                    return null;
                }
                
                // USER_ID取得
                const userId = await this.getUserId();
                
                return { userId };
                
            } catch (error) {
                throw error;
            }
        },

        /**
         * 認証＋顧客確認付き初期化
         * @param {string} pageName - ページ名
         * @returns {Promise<Object|null>} 初期化結果
         */
        async initializePageWithAuth(pageName) {
            try {
                this.init();
                
                // 画面モードチェック
                const displayMode = this.getDisplayMode();
                
                if (displayMode && displayMode !== 'reservation') {
                    this.redirectToSpecialPage(displayMode);
                    return null;
                }
                
                // LIFF初期化
                const liffResult = await this.initializeLiff();
                if (liffResult === null) {
                    // ログイン画面にリダイレクト中
                    return null;
                }
                
                // USER_ID取得
                const userId = await this.getUserId();
                
                // 顧客確認
                const customerResult = await this.checkCustomer(userId);
                
                if (!customerResult.exists) {
                    this.redirectToPage('./customer-info-register.html', '顧客登録', {
                        return: window.location.pathname + window.location.search
                    });
                    return null;
                }
                
                return {
                    userId,
                    customer: customerResult.customer
                };
                
            } catch (error) {
                throw error;
            }
        },

        /**
         * 特殊画面リダイレクト
         * @param {string} mode - 画面モード
         */
        redirectToSpecialPage(mode) {
            const pageMap = {
                'customer-info': './customer-info-edit.html',
                'reservation-check': './reservation-check.html',
                'contact': './contact-info.html'
            };
            
            const targetPage = pageMap[mode];
            if (targetPage) {
                this.redirectToPage(targetPage, mode);
            } else {
                this.showErrorScreen(`不明な画面モード: ${mode}`);
            }
        }
    };

    // グローバルに公開
    window.CommonLib = CommonLib;

    // 自動初期化
    document.addEventListener('DOMContentLoaded', function() {
        CommonLib.init();
    });
}