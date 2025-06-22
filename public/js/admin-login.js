/**
 * 管理者ログイン処理
 * admin-login.js
 */

class AdminLogin {
    constructor() {
        this.form = document.getElementById('loginForm');
        this.usernameInput = document.getElementById('username');
        this.passwordInput = document.getElementById('password');
        this.loginBtn = document.getElementById('loginBtn');
        this.errorMessage = document.getElementById('errorMessage');
        this.loadingOverlay = document.getElementById('loadingOverlay');
        
        this.initializeEventListeners();
    }

    /**
     * イベントリスナー初期化
     */
    initializeEventListeners() {
        // フォーム送信処理
        this.form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });
        
        // Enter キーでログイン
        this.passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleLogin();
            }
        });
        
        // エラーメッセージクリア
        [this.usernameInput, this.passwordInput].forEach(input => {
            input.addEventListener('input', () => {
                this.hideError();
            });
        });
    }

    /**
     * ローディング表示
     * @param {string} message - 表示メッセージ
     */
    showLoading(message = '認証中...') {
        this.loadingOverlay.style.display = 'flex';
        this.loginBtn.disabled = true;
        this.loginBtn.textContent = message;
    }

    /**
     * ローディング非表示
     */
    hideLoading() {
        this.loadingOverlay.style.display = 'none';
        this.loginBtn.disabled = false;
        this.loginBtn.textContent = 'ログイン';
    }

    /**
     * エラーメッセージ表示
     * @param {string} message - エラーメッセージ
     */
    showError(message) {
        this.errorMessage.textContent = message;
        this.errorMessage.style.display = 'block';
        
        // フォーカスを戻す
        this.usernameInput.focus();
    }

    /**
     * エラーメッセージ非表示
     */
    hideError() {
        this.errorMessage.style.display = 'none';
    }

    /**
     * ログイン処理
     */
    async handleLogin() {
        try {
            const username = this.usernameInput.value.trim();
            const password = this.passwordInput.value;
            
            // バリデーション
            if (!username || !password) {
                this.showError('ユーザー名とパスワードを入力してください');
                return;
            }
            
            this.showLoading('認証中...');
            this.hideError();
            
            // ログイン API呼び出し
            const response = await fetch(`${window.location.origin}/api/admin/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username,
                    password
                })
            });
            
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || 'ログインに失敗しました');
            }
            
            // セッション保存
            AdminCommonLib.saveAdminSession(result.manager);
            
            // カレンダー画面にリダイレクト
            this.showLoading('画面を準備中...');
            
            setTimeout(() => {
                window.location.href = './admin-calendar.html';
            }, 1000);
            
        } catch (error) {
            this.hideLoading();
            this.showError(error.message);
        }
    }

    /**
     * 既存認証チェック
     * @returns {Promise<boolean>} 認証済みの場合true
     */
    async checkExistingAuth() {
        try {
            const session = await AdminCommonLib.checkAdminAuth();
            
            if (session) {
                this.showLoading('既にログイン済みです...');
                
                setTimeout(() => {
                    window.location.href = './admin-calendar.html';
                }, 1000);
                
                return true;
            }
            
            return false;
            
        } catch (error) {
            return false;
        }
    }
}

/**
 * 初期化処理
 */
document.addEventListener('DOMContentLoaded', async function() {
    try {
        // AdminCommonLib確認
        if (typeof AdminCommonLib === 'undefined') {
            throw new Error('AdminCommonLib not loaded');
        }
        
        // 管理者ログインクラス初期化
        const adminLogin = new AdminLogin();
        
        // 既存認証チェック
        const hasAuth = await adminLogin.checkExistingAuth();
        
        if (!hasAuth) {
            adminLogin.hideLoading();
            
            // フォーカスをユーザー名に設定
            setTimeout(() => {
                adminLogin.usernameInput.focus();
            }, 100);
        }
        
    } catch (error) {
        // エラー画面表示
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
                    <div style="font-size: 48px; color: #dc3545; margin-bottom: 20px;">❌</div>
                    <h3 style="color: #333; margin-bottom: 15px;">初期化エラー</h3>
                    <p style="color: #666; margin-bottom: 20px; line-height: 1.5;">
                        管理者ログイン画面の初期化に失敗しました。<br>
                        <small style="font-family: monospace; background: #f8f9fa; padding: 2px 4px; border-radius: 3px;">
                            ${error.message}
                        </small>
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
                </div>
            </div>
        `;
    }
});