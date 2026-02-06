# H2O Smart DCA - 安全機制文檔

## 🛡️ 安全架構概覽

H2O Smart DCA V3 採用多層安全防護，防止各種攻擊和惡意行為。

---

## 1. 防搶跑機制（Anti Front-running）

### 問題描述
攻擊者可能監控鏈上交易，在 `accrue_yield` 調用前存款，調用後立即提款，竊取其他用戶的收益。

### 防護措施

#### A. 時間鎖定（Time Lock）
```
用戶存款 → 鎖定 24 小時 → 才能無懲罰提款
```

**參數**：
- `lock_period_ms`: 最小鎖定期（預設 24 小時）
- `MIN_LOCK_PERIOD_MS`: 1 小時（強制最小值）

**實現**：
```move
// 每個存款都有解鎖時間
public struct SecureDepositReceipt {
    unlock_time: u64,              // 解鎖時間
    can_withdraw_after: u64,       // 可無懲罰提款時間
}
```

#### B. 早期提款懲罰
```
提款時間 < 解鎖時間 → 收取 1% 手續費
```

**效果**：
- 阻止快進快出套利
- 懲罰金回饋給長期持有者

**計算範例**：
```
用戶存入 100 USDC，賺取 5 USDC 收益
如果在鎖定期內提款：
- 總額：105 USDC
- 手續費：105 * 1% = 1.05 USDC
- 實際獲得：103.95 USDC
- 淨收益：3.95 USDC（而非 5 USDC）
```

#### C. 冷卻期（Cooldown Period）
```
操作 → 等待 5 分鐘 → 才能再次操作
```

**限制**：
- 連續存款間隔：5 分鐘
- 連續提款間隔：5 分鐘

**目的**：防止機器人高頻操作

#### D. 搶跑檢測與告警
```move
// 如果用戶持有時間 < 1 小時就提款，觸發告警事件
public struct FrontRunAttemptDetected {
    user: address,
    time_held_ms: u64,
    ...
}
```

**監控指標**：
- 存款到提款的時間間隔
- 異常的存提款模式
- 與 `accrue_yield` 的時間關聯

---

## 2. 重入攻擊防護（Reentrancy Protection）

### 問題描述
攻擊者可能在回調函數中重複調用存款/提款函數。

### 防護措施

```move
public struct SecureVaultConfig {
    reentrancy_guard: bool,  // 重入鎖
}

// 每個函數開始時
assert!(!vault.reentrancy_guard, E_INVALID_AMOUNT);
vault.reentrancy_guard = true;

// ... 執行邏輯 ...

// 函數結束前
vault.reentrancy_guard = false;
```

**保護範圍**：
- ✅ `secure_deposit`
- ✅ `secure_withdraw`
- ✅ `accrue_yield`

---

## 3. 存款限制機制

### A. 單筆存款上限
```
MAX_SINGLE_DEPOSIT = 100,000 USDC
```

**目的**：
- 防止單次大額操作影響價格
- 降低閃電貸攻擊風險

### B. 用戶累計存款上限
```
max_user_deposit: u64  // 可配置，建議 1,000,000 USDC
```

**目的**：
- 防止鯨魚控制金庫
- 確保去中心化

### C. 金庫總容量上限
```
max_vault_capacity: u64  // 可配置，建議 10,000,000 USDC
```

**目的**：
- 限制單一合約風險暴露
- 可創建多個金庫分散風險

### 限制檢查流程
```
存款請求
   ↓
檢查單筆限制 ✓
   ↓
檢查用戶累計 ✓
   ↓
檢查金庫容量 ✓
   ↓
允許存款
```

---

## 4. 滑點保護（Slippage Protection）

### 問題描述
提款時，H2OUSD 價值可能在交易確認前發生變化。

### 防護措施

```move
public fun secure_withdraw(
    ...
    min_usdc_out: u64,  // 用戶設定的最小接受數量
    ...
) {
    let usdc_to_return = calculate_usdc_to_return(...);
    assert!(usdc_to_return >= min_usdc_out, E_SLIPPAGE_TOO_HIGH);
}
```

**用戶體驗**：
```
用戶看到：100 H2OUSD = 105 USDC
用戶設定：min_usdc_out = 104 USDC（允許 1% 滑點）
實際獲得：105.2 USDC ✓ 交易成功
```

**保護場景**：
- 大額提款前有其他用戶提款
- accrue_yield 調用改變價值
- 網路延遲導致的狀態變化

---

## 5. 緊急控制機制

### A. 分離暫停控制
```move
deposit_paused: bool,      // 只暫停存款
withdrawal_paused: bool,   // 只暫停提款
```

**使用場景**：
```
發現漏洞 → 暫停存款 → 保護現有用戶 → 用戶可以提款撤離
```

### B. 緊急暫停函數
```move
public fun emergency_pause_deposits()   // 暫停存款
public fun emergency_pause_withdrawals() // 暫停提款
public fun unpause_all()                // 恢復所有
```

**權限**：只有 admin 可調用

### C. 事件記錄
```move
public struct EmergencyPause {
    pause_type: vector<u8>,  // "deposit" / "withdrawal"
    reason: vector<u8>,      // 暫停原因
    timestamp: u64,
}
```

**透明度**：所有緊急操作都會發出事件

---

## 6. 白名單模式（可選）

### 啟用場景
- 初期測試階段
- 合規要求
- VIP 用戶專享

### 實現
```move
whitelist_enabled: bool,
whitelisted_users: Table<address, bool>,
```

### 管理函數
```move
enable_whitelist()           // 啟用白名單
add_to_whitelist(user)       // 添加用戶
remove_from_whitelist(user)  // 移除用戶
```

---

## 7. 用戶行為追蹤

### 追蹤數據
```move
public struct UserDepositInfo {
    total_deposited: u64,
    h2ousd_balance: u64,
    last_deposit_time: u64,
    last_withdrawal_time: u64,
    deposit_count: u64,
    withdrawal_count: u64,
}
```

### 用途
- 冷卻期檢查
- 異常行為檢測
- 用戶畫像分析
- 反欺詐監控

---

## 8. 完整的攻擊防護矩陣

| 攻擊類型 | 防護機制 | 效果 |
|---------|---------|------|
| **搶跑套利** | 時間鎖定 + 早期提款費 | ✅ 強效防護 |
| **閃電貸攻擊** | 單筆限制 + 冷卻期 | ✅ 完全防護 |
| **重入攻擊** | Reentrancy Guard | ✅ 完全防護 |
| **鯨魚操控** | 用戶限額 + 金庫容量 | ✅ 有效限制 |
| **價格操縱** | 滑點保護 | ✅ 保護用戶 |
| **合約漏洞** | 緊急暫停 | ✅ 快速響應 |
| **未授權訪問** | 白名單 + 權限檢查 | ✅ 訪問控制 |
| **DoS 攻擊** | Gas 限制 + 速率限制 | ✅ 防止濫用 |

---

## 9. 安全參數建議配置

### 開發/測試環境
```rust
lock_period_ms: 3600000,        // 1 小時
max_user_deposit: 10000000000,  // 10,000 USDC
max_vault_capacity: 100000000000, // 100,000 USDC
whitelist_enabled: true,        // 啟用白名單
```

### 生產環境（初期）
```rust
lock_period_ms: 86400000,       // 24 小時
max_user_deposit: 100000000000, // 100,000 USDC
max_vault_capacity: 10000000000000, // 10,000,000 USDC
whitelist_enabled: false,       // 公開訪問
```

### 生產環境（成熟期）
```rust
lock_period_ms: 43200000,       // 12 小時（可縮短）
max_user_deposit: 500000000000, // 500,000 USDC
max_vault_capacity: 50000000000000, // 50,000,000 USDC
whitelist_enabled: false,
```

---

## 10. 監控與告警

### 需要監控的事件

1. **FrontRunAttemptDetected** - 搶跑嘗試
2. **EmergencyPause** - 緊急暫停
3. **大額操作** - 單筆 > 10,000 USDC
4. **頻繁操作** - 1 小時內 > 10 次
5. **異常提款** - 提款額 > 存款額的 200%

### 告警閾值
```
警告級別：
- 單用戶 1 小時內操作 > 5 次
- H2OUSD 價值波動 > 5%
- 金庫使用率 > 80%

嚴重級別：
- 檢測到搶跑模式
- 單筆異常大額操作
- 合約狀態異常
```

---

## 11. 審計檢查清單

- [ ] 時間鎖定正確實現
- [ ] 早期提款費正確計算
- [ ] 重入攻擊防護有效
- [ ] 所有限額檢查到位
- [ ] 滑點保護正確實現
- [ ] 緊急暫停功能測試
- [ ] 權限控制嚴格
- [ ] 溢出/下溢檢查
- [ ] 事件正確發出
- [ ] Gas 優化合理

---

## 12. 用戶安全使用指南

### ✅ 推薦做法
1. **長期持有**：避免早期提款費
2. **分批操作**：避免單筆大額
3. **設置滑點**：保護交易價值
4. **監控收據**：保存 DepositReceipt NFT

### ❌ 避免操作
1. 頻繁存提款（浪費 gas + 觸發冷卻期）
2. 在 accrue_yield 前後立即操作
3. 測試網私鑰用於主網
4. 分享存款收據 NFT

---

## 安全聯繫方式

- **安全郵箱**: security@h2o-smart-dca.com
- **Bug 獎勵**: 最高 $50,000 USDC
- **Discord**: https://discord.gg/h2o-smart-dca

---

**最後更新**: 2026-02-06
**版本**: V3 Secure
