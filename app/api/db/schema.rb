# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[7.2].define(version: 2026_05_17_000015) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "citext"
  enable_extension "pg_trgm"
  enable_extension "pgcrypto"
  enable_extension "plpgsql"
  enable_extension "vector"

  create_table "active_storage_attachments", force: :cascade do |t|
    t.string "name", null: false
    t.string "record_type", null: false
    t.bigint "record_id", null: false
    t.bigint "blob_id", null: false
    t.datetime "created_at", null: false
    t.index ["blob_id"], name: "index_active_storage_attachments_on_blob_id"
    t.index ["record_type", "record_id", "name", "blob_id"], name: "index_active_storage_attachments_uniqueness", unique: true
  end

  create_table "active_storage_blobs", force: :cascade do |t|
    t.string "key", null: false
    t.string "filename", null: false
    t.string "content_type"
    t.text "metadata"
    t.string "service_name", null: false
    t.bigint "byte_size", null: false
    t.string "checksum"
    t.datetime "created_at", null: false
    t.index ["key"], name: "index_active_storage_blobs_on_key", unique: true
  end

  create_table "active_storage_variant_records", force: :cascade do |t|
    t.bigint "blob_id", null: false
    t.string "variation_digest", null: false
    t.index ["blob_id", "variation_digest"], name: "index_active_storage_variant_records_uniqueness", unique: true
  end

  create_table "addresses", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.string "label", default: "default", null: false
    t.string "recipient", null: false
    t.string "postal_code", null: false
    t.string "prefecture", null: false
    t.string "city", null: false
    t.string "line1", null: false
    t.string "line2"
    t.string "phone"
    t.boolean "is_default", default: false, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id"], name: "index_addresses_on_user_id"
  end

  create_table "ai_conversations", force: :cascade do |t|
    t.bigint "user_id"
    t.string "dify_conversation_id"
    t.datetime "started_at", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id"], name: "index_ai_conversations_on_user_id"
  end

  create_table "ai_messages", force: :cascade do |t|
    t.bigint "ai_conversation_id", null: false
    t.string "role", null: false
    t.text "content", null: false
    t.string "cta"
    t.datetime "created_at", null: false
    t.index ["ai_conversation_id"], name: "index_ai_messages_on_ai_conversation_id"
  end

  create_table "cart_items", force: :cascade do |t|
    t.bigint "cart_id", null: false
    t.bigint "product_id", null: false
    t.integer "quantity", default: 1, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["cart_id", "product_id"], name: "index_cart_items_on_cart_id_and_product_id", unique: true
    t.index ["cart_id"], name: "index_cart_items_on_cart_id"
    t.index ["product_id"], name: "index_cart_items_on_product_id"
  end

  create_table "carts", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id"], name: "index_carts_on_user_id", unique: true
  end

  create_table "categories", force: :cascade do |t|
    t.string "name", null: false
    t.string "slug", null: false
    t.bigint "parent_id"
    t.integer "position", default: 0
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["parent_id"], name: "index_categories_on_parent_id"
    t.index ["slug"], name: "index_categories_on_slug", unique: true
  end

  create_table "inventories", force: :cascade do |t|
    t.bigint "product_id", null: false
    t.integer "stock", default: 0, null: false
    t.integer "reserved", default: 0, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["product_id"], name: "index_inventories_on_product_id", unique: true
  end

  create_table "order_items", force: :cascade do |t|
    t.bigint "order_id", null: false
    t.bigint "product_id", null: false
    t.integer "quantity", null: false
    t.integer "unit_price_cents", null: false
    t.integer "line_total_cents", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["order_id"], name: "index_order_items_on_order_id"
    t.index ["product_id"], name: "index_order_items_on_product_id"
  end

  create_table "orders", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.bigint "address_id", null: false
    t.bigint "payment_method_id"
    t.string "status", default: "pending", null: false
    t.integer "subtotal_cents", default: 0, null: false
    t.integer "tax_cents", default: 0, null: false
    t.integer "shipping_cents", default: 0, null: false
    t.integer "total_cents", default: 0, null: false
    t.string "currency", default: "JPY", null: false
    t.string "stripe_payment_intent_id"
    t.datetime "placed_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["address_id"], name: "index_orders_on_address_id"
    t.index ["payment_method_id"], name: "index_orders_on_payment_method_id"
    t.index ["placed_at"], name: "index_orders_on_placed_at"
    t.index ["status"], name: "index_orders_on_status"
    t.index ["user_id"], name: "index_orders_on_user_id"
  end

  create_table "payment_methods", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.string "stripe_payment_method_id", null: false
    t.string "brand"
    t.string "last4"
    t.integer "exp_month"
    t.integer "exp_year"
    t.boolean "is_default", default: false, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["stripe_payment_method_id"], name: "index_payment_methods_on_stripe_payment_method_id", unique: true
    t.index ["user_id"], name: "index_payment_methods_on_user_id"
  end

  create_table "product_embeddings", primary_key: "product_id", force: :cascade do |t|
    t.vector "embedding", limit: 1536
    t.datetime "indexed_at"
    t.index ["embedding"], name: "index_product_embeddings_on_embedding", opclass: :vector_cosine_ops, using: :ivfflat
    t.index ["product_id"], name: "index_product_embeddings_on_product_id"
  end

  create_table "products", force: :cascade do |t|
    t.bigint "category_id", null: false
    t.string "sku", null: false
    t.string "name", null: false
    t.text "description", default: "", null: false
    t.string "tags", default: [], array: true
    t.integer "price_cents", null: false
    t.string "currency", default: "JPY", null: false
    t.boolean "is_subscribable", default: false, null: false
    t.datetime "published_at"
    t.string "image_url", default: "", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["category_id"], name: "index_products_on_category_id"
    t.index ["description"], name: "index_products_on_description_trgm", opclass: :gin_trgm_ops, using: :gin
    t.index ["name"], name: "index_products_on_name_trgm", opclass: :gin_trgm_ops, using: :gin
    t.index ["published_at"], name: "index_products_on_published_at"
    t.index ["sku"], name: "index_products_on_sku", unique: true
    t.index ["tags"], name: "index_products_on_tags", using: :gin
  end

  create_table "service_requests", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.bigint "product_id"
    t.string "kind", null: false
    t.string "status", default: "pending", null: false
    t.string "vehicle", default: "", null: false
    t.datetime "preferred_at"
    t.integer "budget_cents"
    t.text "body", default: "", null: false
    t.string "contact_phone", default: "", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["product_id"], name: "index_service_requests_on_product_id"
    t.index ["status"], name: "index_service_requests_on_status"
    t.index ["user_id", "kind"], name: "index_service_requests_on_user_id_and_kind"
    t.index ["user_id"], name: "index_service_requests_on_user_id"
  end

  create_table "shipments", force: :cascade do |t|
    t.bigint "order_id", null: false
    t.string "carrier"
    t.string "tracking_number"
    t.string "status", default: "preparing", null: false
    t.datetime "shipped_at"
    t.datetime "delivered_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["order_id"], name: "index_shipments_on_order_id", unique: true
  end

  create_table "subscription_deliveries", force: :cascade do |t|
    t.bigint "subscription_id", null: false
    t.bigint "order_id"
    t.date "scheduled_on", null: false
    t.string "status", default: "scheduled", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["order_id"], name: "index_subscription_deliveries_on_order_id"
    t.index ["subscription_id", "scheduled_on"], name: "idx_on_subscription_id_scheduled_on_b2761f8323", unique: true
    t.index ["subscription_id"], name: "index_subscription_deliveries_on_subscription_id"
  end

  create_table "subscription_plans", force: :cascade do |t|
    t.string "name", null: false
    t.string "code", null: false
    t.integer "interval_days", null: false
    t.integer "discount_percent", default: 0, null: false
    t.text "description", default: "", null: false
    t.boolean "active", default: true, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["code"], name: "index_subscription_plans_on_code", unique: true
  end

  create_table "subscriptions", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.bigint "subscription_plan_id", null: false
    t.bigint "product_id", null: false
    t.bigint "address_id", null: false
    t.bigint "payment_method_id"
    t.string "status", default: "active", null: false
    t.integer "quantity", default: 1, null: false
    t.integer "interval_days", null: false
    t.date "next_delivery_on", null: false
    t.string "stripe_subscription_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["address_id"], name: "index_subscriptions_on_address_id"
    t.index ["next_delivery_on"], name: "index_subscriptions_on_next_delivery_on"
    t.index ["payment_method_id"], name: "index_subscriptions_on_payment_method_id"
    t.index ["product_id"], name: "index_subscriptions_on_product_id"
    t.index ["status"], name: "index_subscriptions_on_status"
    t.index ["subscription_plan_id"], name: "index_subscriptions_on_subscription_plan_id"
    t.index ["user_id"], name: "index_subscriptions_on_user_id"
  end

  create_table "users", force: :cascade do |t|
    t.string "email", null: false
    t.string "password_digest", null: false
    t.string "name", default: "", null: false
    t.string "role", default: "member", null: false
    t.string "stripe_customer_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["email"], name: "index_users_on_email", unique: true
    t.index ["role"], name: "index_users_on_role"
  end

  add_foreign_key "active_storage_attachments", "active_storage_blobs", column: "blob_id"
  add_foreign_key "active_storage_variant_records", "active_storage_blobs", column: "blob_id"
  add_foreign_key "addresses", "users"
  add_foreign_key "ai_conversations", "users"
  add_foreign_key "ai_messages", "ai_conversations"
  add_foreign_key "cart_items", "carts"
  add_foreign_key "cart_items", "products"
  add_foreign_key "carts", "users"
  add_foreign_key "categories", "categories", column: "parent_id"
  add_foreign_key "inventories", "products"
  add_foreign_key "order_items", "orders"
  add_foreign_key "order_items", "products"
  add_foreign_key "orders", "addresses"
  add_foreign_key "orders", "payment_methods"
  add_foreign_key "orders", "users"
  add_foreign_key "payment_methods", "users"
  add_foreign_key "product_embeddings", "products"
  add_foreign_key "products", "categories"
  add_foreign_key "service_requests", "products"
  add_foreign_key "service_requests", "users"
  add_foreign_key "shipments", "orders"
  add_foreign_key "subscription_deliveries", "orders"
  add_foreign_key "subscription_deliveries", "subscriptions"
  add_foreign_key "subscriptions", "addresses"
  add_foreign_key "subscriptions", "payment_methods"
  add_foreign_key "subscriptions", "products"
  add_foreign_key "subscriptions", "subscription_plans"
  add_foreign_key "subscriptions", "users"
end
