/// H2O Smart DCA - H2OUSD Receipt Token
/// H2OUSD 是一個收據代幣（Receipt Token），代表用戶在金庫中的資產份額
/// 價值隨著金庫收益增長而自動增值
module h2o_smart_dca::h2o_usd {
    use sui::coin::{Self, Coin, TreasuryCap};
    use sui::url;

    // ============ 錯誤碼 ============
    const E_NOT_AUTHORIZED: u64 = 1;

    // ============ One-Time-Witness ============

    /// H2OUSD 代幣的 OTW（One-Time-Witness）
    public struct H2O_USD has drop {}

    // ============ 初始化 ============

    /// 初始化 H2OUSD 代幣
    /// 這個函數在部署時自動調用一次
    fun init(witness: H2O_USD, ctx: &mut TxContext) {
        // 創建 H2OUSD 代幣
        let (treasury_cap, metadata) = coin::create_currency(
            witness,
            6, // decimals (與 USDC 相同)
            b"H2OUSD",
            b"H2O USD",
            b"H2O Smart DCA Receipt Token - Represents your share in the yield vault",
            option::some(url::new_unsafe_from_bytes(b"https://h2o-smart-dca.vercel.app/logo.png")),
            ctx
        );

        // 凍結 metadata（不可再修改）
        transfer::public_freeze_object(metadata);

        // 將 TreasuryCap 轉移給 vault 管理
        // 注意：這裡先轉給部署者，之後需要轉給 vault 合約
        transfer::public_transfer(treasury_cap, tx_context::sender(ctx));
    }

    // ============ 公開函數 ============

    /// Mint H2OUSD（只能由持有 TreasuryCap 的人調用）
    public fun mint(
        treasury_cap: &mut TreasuryCap<H2O_USD>,
        amount: u64,
        recipient: address,
        ctx: &mut TxContext
    ): Coin<H2O_USD> {
        let coin = coin::mint(treasury_cap, amount, ctx);
        coin
    }

    /// Burn H2OUSD（只能由持有 TreasuryCap 的人調用）
    public fun burn(
        treasury_cap: &mut TreasuryCap<H2O_USD>,
        coin: Coin<H2O_USD>
    ): u64 {
        coin::burn(treasury_cap, coin)
    }

    /// 獲取總供應量
    public fun total_supply(treasury_cap: &TreasuryCap<H2O_USD>): u64 {
        coin::total_supply(treasury_cap)
    }

    // ============ 測試 ============

    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(H2O_USD {}, ctx)
    }
}
