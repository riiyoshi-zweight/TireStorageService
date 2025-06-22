/**
 * 管理者用予約一覧画面（モバイル対応版）
 * admin-reservations-list.js
 */

class AdminReservationsList {
    constructor() {
        // DOM要素取得
        this.startDateInput = document.getElementById('start-date');
        this.endDateInput = document.getElementById('end-date');
        this.searchBtn = document.getElementById('search-btn');
        this.printBtn = document.getElementById('print-btn');
        this.exportCsvBtn = document.getElementById('export-csv-btn');
        
        // 結果表示要素
        this.resultsContainer = document.getElementById('results-container');
        this.loadingState = document.getElementById('loading-state');
        this.noDataState = document.getElementById('no-data-state');
        this.tableContainer = document.getElementById('table-container');
        this.reservationsTbody = document.getElementById('reservations-tbody');
        
        // メッセージ要素
        this.errorMessage = document.getElementById('error-message');
        this.successMessage = document.getElementById('success-message');
        
        // 現在のデータ
        this.currentData = [];
        this.currentPeriod = null;
        
        this.initializeEventListeners();
    }

    /**
     * イベントリスナー初期化
     */
    initializeEventListeners() {
        // 検索ボタン
        this.searchBtn.addEventListener('click', () => {
            this.searchReservations();
        });
        
        // 印刷ボタン
        this.printBtn.addEventListener('click', () => {
            this.printPage();
        });
        
        // CSV出力ボタン
        this.exportCsvBtn.addEventListener('click', () => {
            this.exportToCsv();
        });
        
        // Enterキーで検索
        [this.startDateInput, this.endDateInput].forEach(input => {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.searchReservations();
                }
            });
        });
        
        // 日付変更時のバリデーション
        this.startDateInput.addEventListener('change', () => {
            this.validateDateRange();
        });
        
        this.endDateInput.addEventListener('change', () => {
            this.validateDateRange();
        });
    }

    /**
     * エラーメッセージ表示
     * @param {string} message - エラーメッセージ
     */
    showError(message) {
        this.errorMessage.textContent = message;
        this.errorMessage.style.display = 'block';
        this.successMessage.style.display = 'none';
        
        // スクロールしてメッセージを見せる
        this.errorMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    /**
     * 成功メッセージ表示
     * @param {string} message - 成功メッセージ
     */
    showSuccess(message) {
        this.successMessage.textContent = message;
        this.successMessage.style.display = 'block';
        this.errorMessage.style.display = 'none';
        
        // 3秒後に自動非表示
        setTimeout(() => {
            this.successMessage.style.display = 'none';
        }, 3000);
    }

    /**
     * メッセージクリア
     */
    clearMessages() {
        this.errorMessage.style.display = 'none';
        this.successMessage.style.display = 'none';
    }

    /**
     * ローディング状態設定
     * @param {boolean} isLoading - ローディング中かどうか
     */
    setLoading(isLoading) {
        if (isLoading) {
            this.loadingState.style.display = 'block';
            this.noDataState.style.display = 'none';
            this.tableContainer.style.display = 'none';
            this.searchBtn.disabled = true;
            this.printBtn.disabled = true;
            this.exportCsvBtn.disabled = true;
        } else {
            this.loadingState.style.display = 'none';
            this.searchBtn.disabled = false;
        }
    }

    /**
     * 結果表示状態設定
     * @param {string} state - 表示状態（'loading', 'no-data', 'data'）
     */
    setResultsState(state) {
        // 全て非表示
        this.loadingState.style.display = 'none';
        this.noDataState.style.display = 'none';
        this.tableContainer.style.display = 'none';
        
        // 指定された状態のみ表示
        switch (state) {
            case 'loading':
                this.loadingState.style.display = 'block';
                break;
            case 'no-data':
                this.noDataState.style.display = 'block';
                break;
            case 'data':
                this.tableContainer.style.display = 'block';
                this.tableContainer.classList.add('fade-in');
                this.printBtn.disabled = false;
                this.exportCsvBtn.disabled = false;
                break;
        }
    }

    /**
     * デフォルト期間設定
     */
    async setDefaultPeriod() {
        try {
            // 現在の日付を取得
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            
            // 日付をYYYY-MM-DD形式に変換
            const formatDate = (date) => {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            };
            
            const todayString = formatDate(today);
            
            // 開始日・終了日ともに今日に設定
            this.startDateInput.value = todayString;
            this.endDateInput.value = todayString;
            
            // 少し待ってから検索実行（DOM更新確保）
            setTimeout(() => {
                this.searchReservations();
            }, 100);
            
        } catch (error) {
            this.showError('初期設定に失敗しました: ' + error.message);
        }
    }

    /**
     * 日付範囲バリデーション
     * @returns {boolean} 有効な場合true
     */
    validateDateRange() {
        const startDate = new Date(this.startDateInput.value);
        const endDate = new Date(this.endDateInput.value);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        let isValid = true;
        let errorMessage = '';
        
        // 開始日が今日より前かチェック（今日は許可）
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (startDate < yesterday) {
            errorMessage = '開始日は今日以降を選択してください';
            isValid = false;
        }
        
        // 終了日が開始日より前かチェック
        if (endDate < startDate) {
            errorMessage = '終了日は開始日以降を選択してください';
            isValid = false;
        }
        
        // 期間が1ヶ月を超えるかチェック
        const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
        if (daysDiff > 31) {
            errorMessage = '検索期間は最大1ヶ月までです';
            isValid = false;
        }
        
        if (!isValid) {
            this.showError(errorMessage);
            this.searchBtn.disabled = true;
            return false;
        } else {
            this.clearMessages();
            this.searchBtn.disabled = false;
            return true;
        }
    }

    /**
     * 予約検索実行
     */
    async searchReservations() {
        try {
            // バリデーション
            if (!this.validateDateRange()) {
                return;
            }
            
            const startDate = this.startDateInput.value;
            const endDate = this.endDateInput.value;
            
            if (!startDate || !endDate) {
                this.showError('開始日と終了日を選択してください');
                return;
            }
            
            this.setLoading(true);
            this.clearMessages();
            
            // API呼び出し
            try {
                const response = await AdminCommonLib.authenticatedFetch(
                    `/api/admin/reservations-list?start_date=${startDate}&end_date=${endDate}`
                );
                
                if (response.success) {
                    this.currentData = response.data;
                    
                    // 期間情報を保存
                    this.currentPeriod = {
                        start_date: startDate,
                        end_date: endDate
                    };
                    
                    this.displayReservations(response.data);
                    
                    if (response.data.length === 0) {
                        this.setResultsState('no-data');
                        this.showSuccess('指定期間に予約はありませんでした');
                    } else {
                        this.setResultsState('data');
                        this.showSuccess(`${response.data.length}件の予約が見つかりました`);
                    }
                } else {
                    throw new Error(response.error || '検索に失敗しました');
                }
                
            } catch (apiError) {
                // HTTP エラーの具体的な処理
                if (apiError.message.includes('400')) {
                    this.showError('検索条件に問題があります。日付を確認してください。');
                } else if (apiError.message.includes('404')) {
                    this.showError('APIエンドポイントが見つかりません。サーバー設定を確認してください。');
                } else if (apiError.message.includes('500')) {
                    this.showError('サーバーエラーが発生しました。しばらく時間をおいてから再試行してください。');
                } else {
                    this.showError('API呼び出しでエラーが発生しました: ' + apiError.message);
                }
                
                this.setResultsState('no-data');
            }
            
        } catch (error) {
            this.setResultsState('no-data');
            this.showError('検索処理でエラーが発生しました: ' + error.message);
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * 予約一覧表示
     * @param {Array} reservations - 予約データ配列
     */
    displayReservations(reservations) {
        // テーブルクリア
        this.reservationsTbody.innerHTML = '';
        
        reservations.forEach(reservation => {
            const row = document.createElement('tr');
            
            // 日付フォーマット
            const date = new Date(reservation.available_date);
            const formattedDate = date.toLocaleDateString('ja-JP', {
                month: '2-digit',
                day: '2-digit',
                weekday: 'short'
            });
            
            // 時間フォーマット（HH:MM）
            const formattedTime = reservation.available_time.substring(0, 5);
            
            row.innerHTML = `
                <td class="date-cell">${formattedDate}</td>
                <td><span class="time-cell">${formattedTime}</span></td>
                <td class="customer-cell">${this.escapeHtml(reservation.customer_name)}</td>
                <td class="vehicle-cell">${this.escapeHtml(reservation.car_model)}</td>
            `;
            
            this.reservationsTbody.appendChild(row);
        });
    }

    /**
     * 印刷機能
     */
    printPage() {
        if (!this.currentData || this.currentData.length === 0) {
            this.showError('印刷するデータがありません');
            return;
        }
        
        // 印刷用にページタイトルを設定
        const originalTitle = document.title;
        const startDate = new Date(this.currentPeriod.start_date).toLocaleDateString('ja-JP');
        const endDate = new Date(this.currentPeriod.end_date).toLocaleDateString('ja-JP');
        document.title = `予約一覧_${startDate}-${endDate}`;
        
        // 印刷実行
        window.print();
        
        // タイトルを元に戻す
        document.title = originalTitle;
    }

    /**
     * CSV出力
     */
    async exportToCsv() {
        try {
            if (!this.currentData || this.currentData.length === 0) {
                this.showError('出力するデータがありません');
                return;
            }
            
            this.exportCsvBtn.disabled = true;
            this.exportCsvBtn.textContent = '出力中...';
            
            // 現在表示されているデータを使用
            const exportData = this.currentData.map(item => ({
                date: item.available_date,
                time: item.available_time.substring(0, 5), // HH:MM形式
                customer: item.customer_name,
                vehicle: item.car_model
            }));
            
            // CSV生成
            this.generateCsv(exportData, this.currentPeriod);
            
            
        } catch (error) {
            this.showError(error.message || 'CSV出力に失敗しました');
        } finally {
            this.exportCsvBtn.disabled = false;
            this.exportCsvBtn.textContent = 'CSV出力';
        }
    }

    /**
     * CSV生成
     * @param {Array} data - エクスポートデータ
     * @param {Object} period - 期間情報
     */
    generateCsv(data, period) {
        // CSVヘッダー
        const headers = ['日付', '時間', 'お客様名', '車種'];
        
        // CSVデータ作成
        const csvData = [
            headers,
            ...data.map(item => [
                new Date(item.date).toLocaleDateString('ja-JP'),
                item.time,
                item.customer,
                item.vehicle
            ])
        ];
        
        // CSV文字列に変換
        const csvContent = csvData.map(row => 
            row.map(field => `"${field}"`).join(',')
        ).join('\n');
        
        // BOMつきCSV（Excel対応）
        const bom = '\uFEFF';
        const csvBlob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
        
        // ファイル名生成
        const today = new Date().toISOString().split('T')[0];
        const filename = `予約一覧_${today}.csv`;
        
        // ダウンロード実行
        const url = URL.createObjectURL(csvBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // メモリリーク防止
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    /**
     * HTMLエスケープ
     * @param {string} text - エスケープ対象テキスト
     * @returns {string} エスケープ済みテキスト
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 管理者認証確認
     * @returns {Promise<boolean>} 認証済みの場合true
     */
    async checkAdminAuth() {
        try {
            const session = await AdminCommonLib.checkAdminAuth();
            
            if (!session) {
                AdminCommonLib.redirectToLogin('./admin-reservations-list.html');
                return false;
            }
            
            return true;
            
        } catch (error) {
            AdminCommonLib.redirectToLogin('./admin-reservations-list.html');
            return false;
        }
    }

    /**
     * 初期化
     */
    async initialize() {
        try {
            // 管理者認証確認
            const isAuthenticated = await this.checkAdminAuth();
            if (!isAuthenticated) {
                return;
            }
            
            // デフォルト期間設定
            await this.setDefaultPeriod();
            
        } catch (error) {
            this.showError('初期化に失敗しました: ' + error.message);
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
        
        // 予約一覧クラス初期化
        const reservationsList = new AdminReservationsList();
        
        // グローバルに公開（デバッグ用）
        window.AdminReservationsList = reservationsList;
        
        // 初期化実行
        await reservationsList.initialize();
        
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
                        予約一覧画面の初期化に失敗しました。<br>
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
                        margin-right: 10px;
                    ">再試行</button>
                    <button onclick="window.history.back()" style="
                        background: #6c757d;
                        color: white;
                        border: none;
                        padding: 12px 24px;
                        border-radius: 8px;
                        font-size: 16px;
                        font-weight: 600;
                        cursor: pointer;
                    ">戻る</button>
                </div>
            </div>
        `;
    }
});