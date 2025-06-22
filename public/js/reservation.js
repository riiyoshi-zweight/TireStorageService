/**
 * 予約システム（LIFF対応版）
 */

// グローバル変数
let currentCustomer = null;
let availableDates = [];
let selectedDate = null;
let selectedTime = null;
let liffUserProfile = null;

/**
 * DOM読み込み完了時の初期化
 */
document.addEventListener('DOMContentLoaded', async function() {
    try {
        // LIFF初期化
        await initializeLiff();
        
        // システム初期化
        await initializeSystem();
        
    } catch (error) {
        showError('システムの初期化に失敗しました: ' + error.message);
    }
});

/**
 * LIFF初期化
 * LINEアプリ内での動作に必要な初期化処理
 */
async function initializeLiff() {
    try {
        if (typeof liff !== 'undefined') {
            // 環境変数からLIFF IDを取得（実際は動的に取得する必要があります）
            const liffId = 'liff-xxxxxxxxx'; // 実際のLIFF IDに置き換え
            
            await liff.init({ liffId: liffId });
            
            if (!liff.isLoggedIn()) {
                liff.login();
                return;
            }
            
            // ユーザープロフィール取得
            liffUserProfile = await liff.getProfile();
            
            // ユーザー名をフォームに自動入力
            const nameInput = document.getElementById('customerName');
            if (nameInput) {
                nameInput.value = liffUserProfile.displayName;
            }
            
            // LINE User ID を隠しフィールドに設定
            setLineUserId(liffUserProfile.userId);
            
        } else {
            // デモモード用のダミーUser ID
            setLineUserId('demo_user_' + Date.now());
        }
    } catch (error) {
        // エラー時はデモモードで継続
        setLineUserId('demo_user_' + Date.now());
    }
}

/**
 * LINE User ID設定
 * @param {string} userId - LINE User ID
 */
function setLineUserId(userId) {
    let hiddenInput = document.getElementById('lineUserId');
    if (!hiddenInput) {
        hiddenInput = document.createElement('input');
        hiddenInput.type = 'hidden';
        hiddenInput.id = 'lineUserId';
        hiddenInput.name = 'lineUserId';
        document.body.appendChild(hiddenInput);
    }
    hiddenInput.value = userId;
}

/**
 * システム初期化
 * サーバー接続確認と初期データ読み込み
 */
async function initializeSystem() {
    try {
        // サーバー接続確認
        const healthResponse = await fetch('/health');
        
        if (!healthResponse.ok) {
            throw new Error(`サーバー接続エラー: ${healthResponse.status}`);
        }
        
        const healthData = await healthResponse.json();
        
        // 利用可能日程読み込み
        await loadAvailableDates();
        
        // イベントリスナー設定
        setupEventListeners();
        
    } catch (error) {
        throw error;
    }
}

/**
 * 利用可能日程読み込み
 */
async function loadAvailableDates() {
    try {
        showLoading('利用可能日程を読み込み中...');
        
        const response = await fetch('/api/available-dates', {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        availableDates = data.data || [];
        renderCalendar();
        
    } catch (error) {
        showError('利用可能日程の読み込みに失敗しました: ' + error.message);
    } finally {
        hideLoading();
    }
}

/**
 * カレンダー表示
 * 利用可能な日程をカレンダー形式で表示
 */
function renderCalendar() {
    const calendarContainer = document.getElementById('calendar-container');
    if (!calendarContainer) {
        return;
    }
    
    if (availableDates.length === 0) {
        calendarContainer.innerHTML = `
            <div class="empty-state">
                <p>現在、利用可能な日程がありません</p>
                <button onclick="loadAvailableDates()" class="btn-reload">再読み込み</button>
            </div>
        `;
        return;
    }
    
    // 日付別にグループ化
    const dateGroups = {};
    availableDates.forEach(slot => {
        const date = slot.available_date;
        if (!dateGroups[date]) {
            dateGroups[date] = [];
        }
        dateGroups[date].push(slot);
    });
    
    // カレンダーHTML生成
    let calendarHTML = '<div class="calendar-grid">';
    
    Object.keys(dateGroups).sort().forEach(date => {
        const slots = dateGroups[date];
        const dateObj = new Date(date + 'T00:00:00');
        const formattedDate = dateObj.toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'short'
        });
        
        calendarHTML += `
            <div class="date-card" data-date="${date}">
                <div class="date-header">
                    <h3>${formattedDate}</h3>
                    <span class="available-count">${slots.length}枠</span>
                </div>
                <div class="time-slots">
        `;
        
        slots.forEach(slot => {
            calendarHTML += `
                <button class="time-slot" 
                        onclick="selectTimeSlot('${date}', '${slot.available_time}', '${slot.available_date_id}')"
                        data-date="${date}" 
                        data-time="${slot.available_time}"
                        data-slot-id="${slot.available_date_id}">
                    ${slot.available_time}
                </button>
            `;
        });
        
        calendarHTML += '</div></div>';
    });
    
    calendarHTML += '</div>';
    calendarContainer.innerHTML = calendarHTML;
}

/**
 * 時間枠選択
 * @param {string} date - 選択日付
 * @param {string} time - 選択時間
 * @param {string} availableDateId - 利用可能日程ID
 */
function selectTimeSlot(date, time, availableDateId) {
    // 以前の選択をクリア
    document.querySelectorAll('.time-slot.selected').forEach(el => {
        el.classList.remove('selected');
    });
    
    // 新しい選択をマーク
    const selectedElement = document.querySelector(`[data-slot-id="${availableDateId}"]`);
    if (selectedElement) {
        selectedElement.classList.add('selected');
    }
    
    selectedDate = date;
    selectedTime = time;
    
    // 隠しフィールドにavailable_date_idを設定
    setAvailableDateId(availableDateId);
    
    // 選択情報を表示
    updateSelectionDisplay();
    
    // 次のステップを有効化
    enableCustomerForm();
}

/**
 * Available Date ID設定
 * @param {string} availableDateId - 利用可能日程ID
 */
function setAvailableDateId(availableDateId) {
    let hiddenInput = document.getElementById('availableDateId');
    if (!hiddenInput) {
        hiddenInput = document.createElement('input');
        hiddenInput.type = 'hidden';
        hiddenInput.id = 'availableDateId';
        hiddenInput.name = 'availableDateId';
        document.body.appendChild(hiddenInput);
    }
    hiddenInput.value = availableDateId;
}

/**
 * 選択情報表示更新
 */
function updateSelectionDisplay() {
    const displayElement = document.getElementById('selection-display');
    if (displayElement && selectedDate && selectedTime) {
        const dateObj = new Date(selectedDate + 'T00:00:00');
        const formattedDate = dateObj.toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: 'long', 
            day: 'numeric',
            weekday: 'long'
        });
        
        displayElement.innerHTML = `
            <div class="selection-info">
                <h4>選択された日時</h4>
                <p class="selected-datetime">${formattedDate} ${selectedTime}</p>
                ${liffUserProfile ? `<p class="user-info">👤 ${liffUserProfile.displayName}</p>` : ''}
            </div>
        `;
    }
}

/**
 * 顧客フォーム有効化
 */
function enableCustomerForm() {
    const customerForm = document.getElementById('customer-form');
    if (customerForm) {
        customerForm.classList.remove('hidden');
        customerForm.scrollIntoView({ behavior: 'smooth' });
        
        // 必須項目にフォーカス
        const nameInput = document.getElementById('customerName');
        const phoneInput = document.getElementById('customerPhone');
        
        if (nameInput && nameInput.value && phoneInput) {
            phoneInput.focus();
        } else if (nameInput && !nameInput.value) {
            nameInput.focus();
        }
    }
}

/**
 * イベントリスナー設定
 */
function setupEventListeners() {
    // 顧客情報フォーム送信
    const customerFormElement = document.getElementById('customer-form-element');
    if (customerFormElement) {
        customerFormElement.addEventListener('submit', handleCustomerSubmit);
    }
    
    // 予約作成ボタン
    const reserveButton = document.getElementById('reserve-button');
    if (reserveButton) {
        reserveButton.addEventListener('click', handleReservationSubmit);
    }
    
    // 電話番号フォーマット
    const phoneInput = document.getElementById('customerPhone');
    if (phoneInput) {
        phoneInput.addEventListener('input', formatPhoneNumber);
    }
}

/**
 * 顧客情報送信
 * @param {Event} event - フォームイベント
 */
async function handleCustomerSubmit(event) {
    event.preventDefault();
    
    try {
        // フォームデータ取得
        const formData = new FormData(event.target);
        
        // LINE User IDを取得
        const lineUserId = document.getElementById('lineUserId')?.value;
        if (!lineUserId) {
            throw new Error('LINE User IDが取得できませんでした');
        }
        
        const customerData = {
            name: formData.get('customerName')?.trim(),
            phone: formData.get('customerPhone')?.trim(),
            car_model: formData.get('carModel')?.trim() || null,
            line_user_id: lineUserId
        };
        
        // バリデーション
        if (!customerData.name) {
            throw new Error('お名前を入力してください');
        }
        
        if (!customerData.phone) {
            throw new Error('電話番号を入力してください');
        }
        
        showLoading('顧客情報を処理中...');
        
        // サーバーに送信
        const response = await fetch('/api/customers', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(customerData)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }
        
        const result = await response.json();
        
        currentCustomer = result.data;
        
        // 成功メッセージ
        const message = result.isExisting ? 
            '既存のお客様情報を確認しました' : 
            '新規お客様として登録しました';
        showSuccess(message);
        
        // 予約ボタンを表示
        showReservationButton();
        
    } catch (error) {
        showError(error.message);
    } finally {
        hideLoading();
    }
}

/**
 * 予約作成
 * @param {Event} event - イベント
 */
async function handleReservationSubmit(event) {
    if (event) event.preventDefault();
    
    try {
        // 必要な情報確認
        const lineUserId = document.getElementById('lineUserId')?.value;
        const availableDateId = document.getElementById('availableDateId')?.value;
        
        if (!lineUserId) {
            throw new Error('LINE User IDが見つかりません');
        }
        
        if (!availableDateId) {
            throw new Error('日時が選択されていません');
        }
        
        const reservationData = {
            available_date_id: availableDateId,
            line_user_id: lineUserId
        };
        
        showLoading('予約を作成中...');
        
        const response = await fetch('/api/reservations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(reservationData)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }
        
        const result = await response.json();
        
        // 成功表示
        showReservationSuccess(result.data);
        
        // LIFFアプリを閉じる（3秒後）
        if (typeof liff !== 'undefined') {
            setTimeout(() => {
                liff.closeWindow();
            }, 3000);
        }
        
    } catch (error) {
        showError(error.message);
    } finally {
        hideLoading();
    }
}

/**
 * 予約ボタン表示
 */
function showReservationButton() {
    let buttonContainer = document.getElementById('reservation-button-container');
    
    if (!buttonContainer) {
        buttonContainer = document.createElement('div');
        buttonContainer.id = 'reservation-button-container';
        buttonContainer.className = 'reservation-button-container';
        buttonContainer.innerHTML = `
            <button id="reserve-button" class="btn-primary reserve-button">
                予約を確定する
            </button>
        `;
        
        const customerForm = document.getElementById('customer-form');
        if (customerForm) {
            customerForm.appendChild(buttonContainer);
        }
        
        // イベントリスナー設定
        const reserveButton = document.getElementById('reserve-button');
        if (reserveButton) {
            reserveButton.addEventListener('click', handleReservationSubmit);
        }
    }
    
    buttonContainer.classList.remove('hidden');
    buttonContainer.scrollIntoView({ behavior: 'smooth' });
}

/**
 * 予約成功画面表示
 * @param {Object} reservation - 予約情報
 */
function showReservationSuccess(reservation) {
    const container = document.getElementById('main-content');
    if (container) {
        container.innerHTML = `
            <div class="success-page">
                <div class="success-icon">✅</div>
                <h2>予約完了！</h2>
                <div class="reservation-details">
                    <p><strong>お名前:</strong> ${reservation.customer_name}</p>
                    <p><strong>予約日時:</strong> ${reservation.date} ${reservation.time}</p>
                </div>
                <p class="closing-message">
                    予約が完了しました。<br>
                    LINEでも確認メッセージをお送りしました。<br>
                    ありがとうございました。
                </p>
                <p class="auto-close">3秒後に自動で閉じます...</p>
            </div>
        `;
    }
}

/**
 * 電話番号フォーマット
 * @param {Event} event - 入力イベント
 */
function formatPhoneNumber(event) {
    let value = event.target.value.replace(/[^\d]/g, '');
    if (value.length > 3 && value.length <= 7) {
        value = value.slice(0, 3) + '-' + value.slice(3);
    } else if (value.length > 7) {
        value = value.slice(0, 3) + '-' + value.slice(3, 7) + '-' + value.slice(7, 11);
    }
    event.target.value = value;
}

/**
 * ローディング表示
 * @param {string} message - 表示メッセージ
 */
function showLoading(message) {
    const loadingEl = document.getElementById('loading');
    if (loadingEl) {
        loadingEl.querySelector('.loading-message').textContent = message;
        loadingEl.style.display = 'flex';
    }
}

/**
 * ローディング非表示
 */
function hideLoading() {
    const loadingEl = document.getElementById('loading');
    if (loadingEl) {
        loadingEl.style.display = 'none';
    }
}

/**
 * エラー表示
 * @param {string} message - エラーメッセージ
 */
function showError(message) {
    alert('エラー: ' + message);
}

/**
 * 成功メッセージ表示
 * @param {string} message - 成功メッセージ
 */
function showSuccess(message) {
    // 実装に応じて、より良いUI表示に変更可能
}

// グローバル関数として公開（HTMLから呼び出し可能）
window.selectTimeSlot = selectTimeSlot;
window.loadAvailableDates = loadAvailableDates;