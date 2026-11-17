# いま店頭で扱っているもの (販売中のカテゴリ・オーダーメイドの受付・定期便)。
# 画面のメニューの出し分けと、AIコンシェルジュの案内に使う。販売中かどうかは、管理画面でカテゴリごとに切り替える
class Storefront
  CUSTOM_SLUG = "custom"

  def self.categories
    Category.active.to_a
  end

  # オーダーメイド (custom) の依頼を受け付けているか
  def self.custom_orders?
    Category.slug_active?(CUSTOM_SLUG)
  end

  # 定期便を申し込める商品 (販売中のカテゴリで公開中の、サブスク対応の商品) があるか
  def self.subscriptions?
    Product.on_sale.where(is_subscribable: true).exists?
  end

  def self.as_json
    {
      categories: categories.map { |c| { id: c.id, slug: c.slug, name: c.name, service: c.service? } },
      custom_orders: custom_orders?,
      subscriptions: subscriptions?
    }
  end
end
