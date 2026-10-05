# ショップ情報 (1行だけ)。特定商取引法に基づく表記に使う販売者の情報と、店舗の方針の文面。
# 送料・税率・支払方法・定期便のプランなどはコードと DB から自動で表示するので、ここには持たない
class ShopSetting < ApplicationRecord
  # 初めて作るときの方針の文面 (管理画面で書き換える)
  DEFAULTS = {
    transfer_payment_due: "ご注文から7日以内にお振り込みください。期限を過ぎた場合はキャンセルとさせていただくことがあります。",
    shipping_lead_time: "入金確認後、通常7〜14日以内に制作・発送します。",
    returns_policy: <<~TEXT.strip
      ・不良品・誤配送の場合は、商品到着後7日以内にご連絡ください。送料当店負担で交換または返金します。
      ・お客様のご都合による返品は、未使用かつ商品到着後7日以内に限り、送料お客様負担で受け付けます。
      ・3Dデータ・DIY設計図は、商品の性質上、返品・キャンセルできません。
      ・オーダーメイドは、制作開始後のキャンセルはできません。
      ・定期便はいつでも解約でき、次回の決済から止まります。
    TEXT
  }.freeze

  EDITABLE = %i[seller_name representative_name address phone email disclose_on_request contact_hours
                transfer_payment_due shipping_lead_time returns_policy extra_notes].freeze

  validates :email, format: { with: URI::MailTo::EMAIL_REGEXP }, allow_blank: true

  def self.current
    first || create!(DEFAULTS)
  end

  # 表記に必要な項目がそろっているか
  def complete?
    [seller_name, representative_name, email, transfer_payment_due, shipping_lead_time, returns_policy].all?(&:present?) &&
      (disclose_on_request? || (address.present? && phone.present?))
  end
end
