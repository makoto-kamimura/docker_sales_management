class User < ApplicationRecord
  ROLES = %w[member admin].freeze

  has_secure_password

  has_many :addresses, dependent: :destroy
  has_many :payment_methods, dependent: :destroy
  has_one  :cart, dependent: :destroy
  has_many :orders, dependent: :destroy
  has_many :subscriptions, dependent: :destroy
  has_many :ai_conversations, dependent: :nullify

  validates :email, presence: true, uniqueness: { case_sensitive: false },
                    format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :role, inclusion: { in: ROLES }
  validates :name, presence: true

  before_save { self.email = email.to_s.downcase.strip }
  after_create :ensure_cart

  def admin?
    role == "admin"
  end

  def default_address
    addresses.find_by(is_default: true) || addresses.first
  end

  def default_payment_method
    payment_methods.find_by(is_default: true) || payment_methods.first
  end

  private

  def ensure_cart
    create_cart! unless cart
  end
end
