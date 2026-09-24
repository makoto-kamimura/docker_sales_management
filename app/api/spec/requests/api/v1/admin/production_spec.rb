require "rails_helper"

RSpec.describe "Admin production board / materials", type: :request do
  let(:staff) { create(:user, :staff) }
  let(:member) { create(:user) }
  let(:material) { create(:material, stock: 100, reorder_point: 50) }
  let(:product) { create(:product, :stocked).tap { |p| p.product_materials.create!(material: material, quantity: 20) } }
  let!(:order) { create(:order, product: product, quantity: 2) }

  describe "GET /api/v1/admin/production" do
    it "制作スタッフはステータス列ごとの注文カードを取得できる" do
      get "/api/v1/admin/production", headers: auth_headers(staff)
      expect(response).to have_http_status(:ok)
      columns = response.parsed_body["columns"]
      expect(columns.map { |c| c["status"] }).to eq(Order::STATUSES - %w[cancelled])
      expect(columns.first["orders"].map { |o| o["id"] }).to eq([order.id])
      expect(response.parsed_body["staff"].map { |u| u["id"] }).to include(staff.id)
    end

    it "一般会員は 403" do
      get "/api/v1/admin/production", headers: auth_headers(member)
      expect(response).to have_http_status(:forbidden)
    end

    it "製作担当の候補は制作スタッフと管理者のみ" do
      admin = create(:user, :admin)
      get "/api/v1/admin/staff", headers: auth_headers(staff)
      expect(response.parsed_body.map { |u| u["id"] }).to contain_exactly(staff.id, admin.id)
    end
  end

  describe "PATCH /api/v1/admin/production/:id" do
    def move(params)
      patch "/api/v1/admin/production/#{order.id}", params: params, headers: auth_headers(staff), as: :json
    end

    it "カードを工程間で移動し、担当・納期を設定できる" do
      move(status: "paid")
      move(status: "in_production", assignee_id: staff.id, due_on: Date.tomorrow.to_s)
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body).to include("status" => "in_production", "status_label" => "制作中",
                                              "assignee" => { "id" => staff.id, "name" => staff.name })
      expect(material.reload.stock).to eq(60)
    end

    it "入金確認前に制作へ進めると 422" do
      move(status: "in_production")
      expect(response).to have_http_status(:unprocessable_entity)
      expect(response.parsed_body.dig("error", "code")).to eq("bad_transition")
    end
  end

  describe "材料管理" do
    it "一覧で発注点割れと制作待ち注文での必要量を返す" do
      OrderWorkflow.new(order).transition!("paid") # 制作待ち (材料未消費) の注文
      get "/api/v1/admin/materials", headers: auth_headers(staff)
      m = response.parsed_body.find { |x| x["id"] == material.id }
      expect(m).to include("stock" => 100.0, "required_for_queue" => 40.0, "projected_stock" => 60.0, "low" => false)
      expect(m["products"].map { |p| p["id"] }).to eq([product.id])
    end

    it "入荷・棚卸しで在庫を増減できる" do
      post "/api/v1/admin/materials/#{material.id}/adjust", params: { delta: -60 }, headers: auth_headers(staff), as: :json
      expect(response.parsed_body).to include("stock" => 40.0, "low" => true)
    end

    it "商品のレシピを置き換えられる" do
      other = create(:material)
      put "/api/v1/admin/products/#{product.id}/materials",
          params: { items: [{ material_id: other.id, quantity: 3.5 }] }, headers: auth_headers(staff), as: :json
      expect(response.parsed_body["items"]).to eq([{ "material_id" => other.id, "name" => other.name, "unit" => "g", "quantity" => 3.5 }])
      expect(product.product_materials.reload.map(&:material_id)).to eq([other.id])
    end
  end
end
