# 注文ステータスの遷移履歴。制作状況の見える化とリードタイム分析に使う。
class OrderEvent < ApplicationRecord
  belongs_to :order
  belongs_to :actor, class_name: "User", optional: true # NULL はシステムによる自動遷移

  validates :status, inclusion: { in: Order::STATUSES }

  before_validation { self.created_at ||= Time.current }
end
