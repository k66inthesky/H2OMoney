# H2O Smart DCA - 測試計劃

## ✅ 已完成任務

### 1. 合約部署 ✅
- **部署錢包**: H2OMoney_wallet
- **Package ID**: `0x1823aa8a2c15773de65c06ccb5e801be4edb8e4266513dd680865f6ff5220f2c`
- **Transaction**: `2PLF1osMpzJ5Mw4EaaGEfynk16sbPJk3cvz4ibhcXWAP`
- **H2OUSD TreasuryCap**: `0x1a38f77f1d6f2de33e72034b398a9d4734ece6eb3d30dff04b33c40aeb9a4e9e`

### 2. 錢包餘額檢查 ✅

| 錢包名稱 | SUI餘額 | USDC餘額 | 測試狀態 |
|---------|---------|----------|---------|
| CustomerA | 1.00 | 0 | ⚠️ 無 USDC |
| SuiAudit-Publisher | 0.04 | 0 | ⚠️ Gas 不足 |
| victim | 0 | 10.00 | ⚠️ 需要 SUI |
| CustomerB | 1.00 | 0 | ⚠️ 無 USDC |
| Navi | 0.98 | 10.00 | ✅ 可測試 |
| H2OMoney_wallet | 1.50 | 20.00 | ✅ 可測試 |

---

## 🔄 下一步：創建 Vault 並測試

### 步驟 1: 創建 Secure Vault

**重要**: 必須先創建 Vault 才能進行存款測試！

```bash
# 使用 H2OMoney_wallet 創建 Vault
sui client call \\
  --package 0x1823aa8a2c15773de65c06ccb5e801be4edb8e4266513dd680865f6ff5220f2c \\
  --module h2o_vault_v3_secure \\
  --function create_secure_vault \\
  --args \\
    0x1a38f77f1d6f2de33e72034b398a9d4734ece6eb3d30dff04b33c40aeb9a4e9e \\
    86400000 \\
    100000000000 \\
    10000000000000 \\
    0x6 \\
  --type-args \\
    0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC \\
  --gas-budget 100000000
```

**參數說明**:
- `86400000` = 24 小時鎖定期
- `100000000000` = 100,000 USDC 單用戶上限
- `10000000000000` = 10,000,000 USDC 金庫容量

### 步驟 2: 轉 SUI 給 victim 錢包

```bash
# victim 需要 SUI 作為 gas
sui client transfer-sui \\
  --to 0x4c9456629f285627eb7126193ee51402ed6aaf7b12c2c598833d0c8dc02edb3c \\
  --amount 200000000 \\  # 0.2 SUI
  --gas-budget 10000000
```

### 步驟 3: 測試存款

#### 測試 A - Navi 錢包存入 5 USDC

```bash
# 1. 切換到 Navi 錢包
sui client switch --address Navi

# 2. 查找 USDC Coin Object
sui client gas --with-coins

# 3. 存款（需要 Vault Object ID）
sui client call \\
  --package 0x1823aa8a2c15773de65c06ccb5e801be4edb8e4266513dd680865f6ff5220f2c \\
  --module h2o_vault_v3_secure \\
  --function secure_deposit \\
  --args \\
    [VAULT_OBJECT_ID] \\     # 從步驟1獲得
    [USDC_COIN_OBJECT] \\    # USDC coin object
    0x6 \\                   # Clock
  --type-args \\
    0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC \\
  --gas-budget 50000000
```

#### 測試 B - victim 錢包存入 3 USDC

```bash
# 切換到 victim 錢包並重複上述存款流程
sui client switch --address victim
# ... 執行存款
```

### 步驟 4: 檢查 H2OUSD 餘額

```bash
# 查看 Navi 的 H2OUSD
sui client switch --address Navi
sui client balance

# 查看 victim 的 H2OUSD
sui client switch --address victim
sui client balance
```

### 步驟 5: 測試收益累積

```bash
# 使用 H2OMoney_wallet (admin) 記錄收益
sui client switch --address H2OMoney_wallet
sui client call \\
  --package 0x1823aa8a2c15773de65c06ccb5e801be4edb8e4266513dd680865f6ff5220f2c \\
  --module h2o_vault_v3_secure \\
  --function accrue_yield \\
  --args \\
    [VAULT_OBJECT_ID] \\
    1000000 \\              # 1 USDC 收益
    0x6 \\
  --type-args \\
    0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC \\
  --gas-budget 50000000
```

### 步驟 6: 測試早期提款（會收取費用）

```bash
# 用 Navi 測試早期提款
sui client call \\
  --package 0x1823aa8a2c15773de65c06ccb5e801be4edb8e4266513dd680865f6ff5220f2c \\
  --module h2o_vault_v3_secure \\
  --function secure_withdraw \\
  --args \\
    [VAULT_OBJECT_ID] \\
    [H2OUSD_COIN_OBJECT] \\
    [DEPOSIT_RECEIPT_OBJECT] \\
    4950000 \\              # 最少接受 4.95 USDC (允許1%滑點)
    0x6 \\
  --type-args \\
    0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC \\
  --gas-budget 50000000
```

---

## 📊 預期測試結果

### 存款階段
- ✅ Navi 存入 5 USDC → 獲得 ~5 H2OUSD
- ✅ victim 存入 3 USDC → 獲得 ~3 H2OUSD
- ✅ 總 H2OUSD 供應量: 8 H2OUSD
- ✅ H2OUSD 價值: 1.000000 USDC (初始)

### 收益階段
- 💰 模擬收益 1 USDC
- 📈 新 H2OUSD 價值: 1.125000 USDC (9 USDC / 8 H2OUSD)
- ✨ Navi 的 5 H2OUSD 現值: 5.625 USDC
- ✨ victim 的 3 H2OUSD 現值: 3.375 USDC

### 提款階段（24小時內 = 早期提款）
- ⚠️ Navi 提款 5 H2OUSD
- 應獲得: 5.625 USDC
- 早期提款費: 5.625 * 1% = 0.056 USDC
- 實際獲得: 5.569 USDC
- 淨收益: 0.569 USDC (5 → 5.569)

---

## 🎯 測試目標

1. ✅ 驗證 Receipt Token 機制
2. ✅ 驗證自動增值（收益分配）
3. ✅ 驗證安全機制（時間鎖定、早期提款費）
4. ✅ 驗證多用戶公平分配

---

## ⚠️ 注意事項

1. **必須先創建 Vault** - 這是測試的前提
2. **記錄所有 Object ID** - 每個操作都需要正確的 Object ID
3. **USDC 類型地址** - 確保使用 testnet USDC 類型
4. **Gas 預算** - 複雜操作可能需要更多 gas
5. **早期提款懲罰** - 24 小時內提款會被收取 1% 費用

---

## 📝 測試結果記錄模板

測試完成後，請記錄：

```
測試時間: [時間戳]
Vault Object ID: [ID]

=== 存款測試 ===
Navi 存款:
- TX: [digest]
- 存入: 5 USDC
- 獲得: [X] H2OUSD
- H2OUSD 價值: [Y] USDC

victim 存款:
- TX: [digest]
- 存入: 3 USDC
- 獲得: [X] H2OUSD
- H2OUSD 價值: [Y] USDC

=== 收益測試 ===
記錄收益:
- TX: [digest]
- 收益金額: 1 USDC
- 新 H2OUSD 價值: [Y] USDC

=== 提款測試 ===
Navi 提款:
- TX: [digest]
- 銷毀 H2OUSD: 5
- 獲得 USDC: [X]
- 手續費: [Y]
- 淨收益: [Z]
```

---

**當前狀態**: 🔧 部署完成，等待測試
**下一步**: 創建 Vault → 測試存款 → 記錄收益 → 測試提款
