namespace :ai do
  desc "AIコンシェルジュ (Claude API) への接続を確かめる (モデルの情報を取るだけで、料金はかからない)"
  task check: :environment do
    unless ClaudeConcierge.enabled?
      abort "NG  ANTHROPIC_API_KEY が空です。AIコンシェルジュは無効です (画面にチャットを出しません)。"
    end

    concierge = ClaudeConcierge.new
    puts "モデル: #{ClaudeConcierge.model}"
    begin
      info = concierge.check
    rescue ClaudeConcierge::Error => e
      abort "NG  #{e.message}"
    end
    puts "OK  Claude API に接続できました (#{info.display_name})"
    puts(concierge.fallback_enabled? ? "OK  断られたときのフォールバック: 有効" : "注意 このモデルではフォールバックを使わない")
    puts "OK  店頭に並んでいる商品: #{Product.on_sale.count} 件 (販売中のカテゴリ: #{Category.active_slugs.join(', ').presence || 'なし'})"
  end
end
