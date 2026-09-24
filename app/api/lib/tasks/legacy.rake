# 旧コンセプトのカテゴリ・商品を掃除する一回限りのタスク。
# CraftFlow への刷新で 3d-prints / 3d-models / handmade / materials / custom に移行したため、
# 旧カテゴリ (汎用EC: tea / snack / navi、ライダーズカフェ: coffee / parts / maintenance / system) を片付ける。
#
# 使い方:
#   bundle exec rails legacy:cleanup_categories            # 実行
#   DRY_RUN=1 bundle exec rails legacy:cleanup_categories  # 確認のみ (変更しない)
#
# 注文に含まれる商品は order_items の restrict_with_error により削除できない (購入履歴を保持するため)。
# その商品は非公開 (published_at = NULL) にして残し、カテゴリも残す。
namespace :legacy do
  LEGACY_SLUGS = %w[tea snack navi coffee parts maintenance system].freeze

  desc "旧カテゴリとその商品を削除する (注文履歴のある商品は非公開にして残す)"
  task cleanup_categories: :environment do
    dry = ENV["DRY_RUN"].present?
    puts dry ? "[DRY_RUN] 変更は行いません" : "旧カテゴリの掃除を開始します"

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
          puts "    #{dry ? 'would unpublish' : 'unpublish'}: #{product.sku} (注文履歴があるため削除しません)"
          product.update!(published_at: nil) unless dry
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
        puts "    category kept: #{cat.slug} (注文履歴のある商品が残存)"
      end
    end

    puts dry ? "[DRY_RUN] 完了" : "掃除が完了しました"
  end
end
