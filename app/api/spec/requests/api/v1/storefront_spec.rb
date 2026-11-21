require "rails_helper"

RSpec.describe "販売するカテゴリの切り替え", type: :request do
  let(:buyer) { create(:user) }
  let!(:models) { create(:category, name: "3Dモデルデータ", slug: "3d-models", position: 2) }
  let!(:prints) { create(:category, name: "3Dプリント品", slug: "3d-prints", position: 1) }
  let!(:custom) { create(:category, :custom, position: 5) }
  let!(:data) { create(:product, :digital, category: models, name: "スタンドのデータ") }
  let!(:print) { create(:product, :stocked, category: prints, name: "スタンド (完成品)") }

  def body
    response.parsed_body
  end

  def stop_selling(category)
    category.update!(active: false)
  end

  it "店頭の状態は販売中のカテゴリ・オーダーメイド・定期便の可否を返す" do
    get "/api/v1/storefront"
    expect(body["categories"].map { |c| c["slug"] }).to eq(%w[3d-prints 3d-models custom])
    expect(body).to include("custom_orders" => true, "subscriptions" => false)

    create(:product, category: prints, is_subscribable: true)
    stop_selling(custom)
    get "/api/v1/storefront"
    expect(body).to include("custom_orders" => false, "subscriptions" => true)

    stop_selling(prints)
    get "/api/v1/storefront"
    expect(body["categories"].map { |c| c["slug"] }).to eq(%w[3d-models])
    expect(body["subscriptions"]).to be(false)
  end

  it "販売を止めたカテゴリの商品は、一覧・詳細・カート・注文から外れる" do
    post "/api/v1/cart/items", params: { product_id: print.id }, headers: auth_headers(buyer), as: :json
    expect(response).to have_http_status(:created)

    stop_selling(prints)

    get "/api/v1/products"
    expect(body.map { |p| p["id"] }).to eq([data.id])
    get "/api/v1/products", params: { category_slug: "3d-prints" }
    expect(body).to eq([])
    get "/api/v1/products/#{print.id}"
    expect(response).to have_http_status(:not_found)

    post "/api/v1/cart/items", params: { product_id: print.id }, headers: auth_headers(buyer), as: :json
    expect(response).to have_http_status(:not_found)

    # 止める前にカートに入れていた商品は、注文できない
    post "/api/v1/orders", params: { address_id: create(:address, user: buyer).id }, headers: auth_headers(buyer), as: :json
    expect(response).to have_http_status(:unprocessable_entity)
    expect(body.dig("error", "message")).to include("現在お取り扱いしていない商品です")

    get "/api/v1/categories"
    expect(body.find { |c| c["slug"] == "3d-prints" }).to include("active" => false)
  end

  it "オーダーメイドを止めると、依頼は受け付けず、問い合わせは受け付ける" do
    stop_selling(custom)
    post "/api/v1/service_requests", params: { kind: "custom", subject: "名入れ", body: "お願いします" }, headers: auth_headers(buyer), as: :json
    expect(response).to have_http_status(:unprocessable_entity)
    expect(body.dig("error", "code")).to eq("custom_orders_paused")

    post "/api/v1/service_requests", params: { kind: "inquiry", subject: "納期", body: "いつ届きますか" }, headers: auth_headers(buyer), as: :json
    expect(response).to have_http_status(:created)
  end

  describe "管理画面 (販売権限)" do
    let(:seller) { create(:user, role: "staff", permissions: %w[sales]) }
    let(:maker) { create(:user, role: "staff", permissions: %w[production]) }

    it "販売権限があれば切り替えられ、なければ断られる" do
      get "/api/v1/admin/categories", headers: auth_headers(seller)
      expect(body.map { |c| c["slug"] }).to eq(%w[3d-prints 3d-models custom])
      expect(body.find { |c| c["slug"] == "3d-models" }).to include("active" => true, "published_products_count" => 1)

      patch "/api/v1/admin/categories/#{prints.id}", params: { active: false }, headers: auth_headers(seller), as: :json
      expect(response).to have_http_status(:ok)
      expect(prints.reload.active).to be(false)

      patch "/api/v1/admin/categories/#{prints.id}", params: { active: true }, headers: auth_headers(maker), as: :json
      expect(response).to have_http_status(:forbidden)
      patch "/api/v1/admin/categories/#{prints.id}", params: { active: true }, headers: auth_headers(buyer), as: :json
      expect(response).to have_http_status(:forbidden)
      expect(prints.reload.active).to be(false)
    end

    it "カテゴリを追加でき、追加したては停止中で並びの最後に入る" do
      post "/api/v1/admin/categories",
           params: { slug: "leather", name: "レザー小物", label: "LEATHER", description: "手縫いの革小物。" },
           headers: auth_headers(seller), as: :json
      expect(response).to have_http_status(:created)
      expect(body).to include("slug" => "leather", "label" => "LEATHER", "active" => false, "deletable" => true)

      get "/api/v1/storefront"
      expect(body["categories"].map { |c| c["slug"] }).not_to include("leather")

      leather = Category.find_by!(slug: "leather")
      patch "/api/v1/admin/categories/#{leather.id}", params: { active: true, name: "レザー" }, headers: auth_headers(seller), as: :json
      get "/api/v1/storefront"
      expect(body["categories"].last).to include("slug" => "leather", "name" => "レザー", "description" => "手縫いの革小物。")

      post "/api/v1/admin/categories", params: { slug: "Leather Goods", name: "x" }, headers: auth_headers(seller), as: :json
      expect(response).to have_http_status(:unprocessable_entity)
      post "/api/v1/admin/categories", params: { slug: "leather", name: "x" }, headers: auth_headers(seller), as: :json
      expect(response).to have_http_status(:unprocessable_entity)
      post "/api/v1/admin/categories", params: { slug: "toys", name: "おもちゃ" }, headers: auth_headers(maker), as: :json
      expect(response).to have_http_status(:forbidden)
    end

    it "slug はあとから変えられない" do
      patch "/api/v1/admin/categories/#{prints.id}", params: { slug: "prints", name: "プリント品" }, headers: auth_headers(seller), as: :json
      expect(response).to have_http_status(:ok)
      expect(prints.reload).to have_attributes(slug: "3d-prints", name: "プリント品")
    end

    it "▲▼ で並べ替えると、店頭の並びも変わる" do
      patch "/api/v1/admin/categories/#{custom.id}/move", params: { direction: "up" }, headers: auth_headers(seller), as: :json
      expect(response).to have_http_status(:ok)
      expect(body.map { |c| c["slug"] }).to eq(%w[3d-prints custom 3d-models])
      expect(body.map { |c| c["position"] }).to eq([1, 2, 3])

      # 端より先には動かない
      patch "/api/v1/admin/categories/#{prints.id}/move", params: { direction: "up" }, headers: auth_headers(seller), as: :json
      expect(body.map { |c| c["slug"] }).to eq(%w[3d-prints custom 3d-models])

      get "/api/v1/storefront"
      expect(body["categories"].map { |c| c["slug"] }).to eq(%w[3d-prints custom 3d-models])
      get "/api/v1/categories"
      expect(body.map { |c| c["slug"] }).to eq(%w[3d-prints custom 3d-models])

      patch "/api/v1/admin/categories/#{prints.id}/move", params: { direction: "left" }, headers: auth_headers(seller), as: :json
      expect(response).to have_http_status(:bad_request)
    end

    it "商品がなく、コードが使っていないカテゴリだけ消せる" do
      empty = create(:category, slug: "toys")
      used = create(:category, slug: "leather")
      create(:product, :stocked, category: used, published_at: nil)

      get "/api/v1/admin/categories", headers: auth_headers(seller)
      deletable = body.to_h { |c| [c["slug"], c["deletable"]] }
      expect(deletable).to include("toys" => true, "leather" => false, "custom" => false, "3d-models" => false)

      delete "/api/v1/admin/categories/#{used.id}", headers: auth_headers(seller)
      expect(response).to have_http_status(:unprocessable_entity)
      expect(body.dig("error", "message")).to include("商品があるカテゴリは消せません")

      delete "/api/v1/admin/categories/#{custom.id}", headers: auth_headers(seller)
      expect(response).to have_http_status(:unprocessable_entity)
      expect(body.dig("error", "message")).to include("消せません")

      delete "/api/v1/admin/categories/#{empty.id}", headers: auth_headers(seller)
      expect(response).to have_http_status(:no_content)
      expect(Category.exists?(empty.id)).to be(false)
      expect(Category.exists?(custom.id)).to be(true)
    end
  end
end
