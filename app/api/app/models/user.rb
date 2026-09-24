class User < ApplicationRecord
  # member: 購入者 / staff: スタッフ (付与された権限の管理画面だけ使える) / admin: 店舗管理者 (全権限 + 権限設定)
  ROLES = %w[member staff admin].freeze

  # スタッフに付与できる権限
  PERMISSIONS = {
    "sales"      => "販売", # 商品管理・在庫・売上分析
    "production" => "制作", # 制作ボード・材料管理 (製作担当に指定できる)
    "orders"     => "注文"  # 注文管理・発送・顧客管理・問い合わせ
  }.freeze

  # 権限を持つユーザー (管理者 + その権限を付与されたスタッフ)
  scope :with_permission, ->(permission) {
    where(role: "admin").or(where(role: "staff").where("? = ANY(users.permissions)", permission.to_s))
  }

  has_secure_password

  has_many :addresses, dependent: :destroy
  has_many :payment_methods, dependent: :destroy
  has_one  :cart, dependent: :destroy
  has_many :orders, dependent: :destroy
  has_many :subscriptions, dependent: :destroy
  has_many :service_requests, dependent: :destroy
  has_many :ai_conversations, dependent: :nullify
  has_many :assigned_orders, class_name: "Order", foreign_key: :assignee_id, dependent: :nullify, inverse_of: :assignee
  has_many :model_assets, foreign_key: :created_by_id, dependent: :nullify, inverse_of: :created_by
  has_many :model_versions, foreign_key: :created_by_id, dependent: :nullify, inverse_of: :created_by
  has_many :tips, dependent: :destroy
  has_many :confirmed_tips, class_name: "Tip", foreign_key: :confirmed_by_id, dependent: :nullify, inverse_of: :confirmed_by

  validates :email, presence: true, uniqueness: { case_sensitive: false },
                    format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :role, inclusion: { in: ROLES }
  validates :name, presence: true
  validate :permissions_must_be_known

  before_validation :normalize_permissions
  before_save { self.email = email.to_s.downcase.strip }
  after_create :ensure_cart

  def admin?
    role == "admin"
  end

  # 管理画面に入れるユーザー (実際に使える画面は権限による)
  def staff?
    %w[staff admin].include?(role)
  end

  # 実際に持っている権限。管理者はすべて、会員はなし
  def effective_permissions
    return PERMISSIONS.keys if admin?
    return permissions if role == "staff"

    []
  end

  def can?(permission)
    effective_permissions.include?(permission.to_s)
  end

  def default_address
    addresses.find_by(is_default: true) || addresses.first
  end

  def default_payment_method
    payment_methods.find_by(is_default: true) || payment_methods.first
  end

  # 支払い済み注文で購入したデジタル商品 (再ダウンロード可能なライブラリ)
  def purchased_digital_products
    Product.where(is_digital: true)
           .where(id: OrderItem.joins(:order)
                               .where(orders: { user_id: id, status: Order::DOWNLOADABLE_STATUSES })
                               .select(:product_id))
  end

  def owns_digital?(product)
    product.is_digital? && purchased_digital_products.exists?(product.id)
  end

  private

  # 権限はスタッフだけが個別に持つ (管理者は全権限、会員は権限なし)
  def normalize_permissions
    self.permissions = role == "staff" ? Array(permissions).map(&:to_s).compact_blank.uniq : []
  end

  def permissions_must_be_known
    unknown = permissions - PERMISSIONS.keys
    errors.add(:permissions, "に不明な権限があります: #{unknown.join(', ')}") if unknown.any?
  end

  def ensure_cart
    create_cart! unless cart
  end
end
