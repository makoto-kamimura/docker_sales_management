require "rails_helper"

RSpec.describe "特定商取引法に基づく表記", type: :request do
  let(:admin) { create(:user, :admin) }

  def body
    response.parsed_body
  end

  it "初めは方針の初期文面だけがあり、販売者の情報がないので未完成。料金はコードの定数を返す" do
    SubscriptionPlan.create!(name: "毎週お届け", code: "weekly", interval_days: 7, discount_percent: 5)
    get "/api/v1/legal_notice"
    expect(response).to have_http_status(:ok)
    expect(body["complete"]).to be(false)
    expect(body["returns_policy"]).to include("3Dデータ・DIY設計図")
    expect(body["pricing"]).to eq("tax_rate_percent" => 10, "shipping_flat_cents" => 500, "free_shipping_threshold_cents" => 5_000)
    expect(body["subscription_plans"]).to eq([{ "name" => "毎週お届け", "interval_days" => 7, "discount_percent" => 5 }])
    expect(body["tip_range_cents"]).to eq("min" => 100, "max" => 100_000)
  end

  it "管理者が販売者の情報を入れると完成し、請求時開示なら住所・電話番号を出さない" do
    patch "/api/v1/admin/shop_setting", params: { seller_name: "CraftFlow", representative_name: "山田太郎", email: "shop@example.com",
                                                  address: "東京都千代田区千代田1-1", phone: "03-0000-0000" },
                                        headers: auth_headers(admin), as: :json
    expect(response).to have_http_status(:ok)
    expect(body["complete"]).to be(true)

    get "/api/v1/legal_notice"
    expect(body["seller"]).to include("name" => "CraftFlow", "address" => "東京都千代田区千代田1-1", "phone" => "03-0000-0000")

    patch "/api/v1/admin/shop_setting", params: { disclose_on_request: true, address: "", phone: "" },
                                        headers: auth_headers(admin), as: :json
    expect(body["complete"]).to be(true)
    ShopSetting.current.update!(address: "東京都千代田区千代田1-1", phone: "03-0000-0000")
    get "/api/v1/legal_notice"
    expect(body["seller"]).to include("disclose_on_request" => true, "address" => nil, "phone" => nil)
    expect(response.body).not_to include("千代田1-1")

    patch "/api/v1/admin/shop_setting", params: { email: "not-an-email" }, headers: auth_headers(admin), as: :json
    expect(response).to have_http_status(:unprocessable_entity)
  end

  it "ショップ情報の編集は管理者だけ" do
    staff = create(:user, role: "staff", permissions: %w[sales production orders])
    get "/api/v1/admin/shop_setting", headers: auth_headers(staff)
    expect(response).to have_http_status(:forbidden)
    patch "/api/v1/admin/shop_setting", params: { seller_name: "x" }, headers: auth_headers(create(:user)), as: :json
    expect(response).to have_http_status(:forbidden)
    expect(ShopSetting.current.seller_name).to eq("")
  end

  it "カートの税・送料・合計は、注文を確定したときの金額と一致する" do
    buyer = create(:user)
    address = create(:address, user: buyer)
    product = create(:product, :stocked, price_cents: 1_200)
    post "/api/v1/cart/items", params: { product_id: product.id, quantity: 3 }, headers: auth_headers(buyer), as: :json

    get "/api/v1/cart", headers: auth_headers(buyer)
    expect(body).to include("subtotal_cents" => 3_600, "tax_cents" => 360, "shipping_cents" => 500, "total_cents" => 4_460)
    cart_totals = body.slice("tax_cents", "shipping_cents", "total_cents")

    post "/api/v1/orders", params: { address_id: address.id }, headers: auth_headers(buyer), as: :json
    expect(body.slice("tax_cents", "shipping_cents", "total_cents")).to eq(cart_totals)
  end
end
