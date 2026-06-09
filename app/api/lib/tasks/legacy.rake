# 旧コンセプト (汎用EC) のカテゴリ・商品を掃除する一回限りのタスク。
# ライダーズカフェ刷新で coffee / parts / maintenance / system の4カテゴリへ移行したため、
# tea / snack / navi とその商品 (TEA-* / SNK-* / NAV-*) を削除する。
#
# 使い方:
#   bundle exec rails legacy:cleanup_categories            # 実削除
#   DRY_RUN=1 bundle exec rails legacy:cleanup_categories  # 確認のみ (削除しない)
#
# 注文に含まれる商品は order_items の restrict_with_error により削除できないため、
# その商品はスキップし、警告を表示する (購入履歴を保持するため)。
namespace :legacy do
  LEGACY_SLUGS = %w[tea snack navi].freeze

  desc "旧カテゴリ (tea/snack/navi) とその商品を削除する"
  task cleanup_categories: :environment do
    dry = ENV["DRY_RUN"].present?
    puts dry ? "[DRY_RUN] 削除は行いません" : "旧カテゴリの掃除を開始します"

    categories = Category.where(slug: LEGACY_SLUGS)
    if categories.empty?
      puts "対象カテゴリはありません。掃除済みです。"
      next
    end

    categories.each do |cat|
      products = cat.products.to_a
      puts "- #{cat.slug} (#{cat.name}): 商品 #{products.size} 件"

      products.each do |product|
        if product.order_items.exists?
          puts "    skip: #{product.sku} は注文履歴があるため削除しません"
          next
        end
        puts "    #{dry ? 'would delete' : 'delete'}: #{product.sku} #{product.name}"
        product.destroy! unless dry
      end

      # 商品が全て消えていればカテゴリも削除
      if !dry && cat.reload.products.empty?
        cat.destroy!
        puts "    category deleted: #{cat.slug}"
      elsif cat.products.exists?
        puts "    category kept: #{cat.slug} (残存商品あり)"
      end
    end

    puts dry ? "[DRY_RUN] 完了" : "掃除が完了しました"
  end
end
