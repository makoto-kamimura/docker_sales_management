require "rails_helper"

RSpec.describe "Admin permissions (販売 / 制作 / 注文)", type: :request do
  let(:admin) { create(:user, :admin) }
  let(:member) { create(:user) }

  def staff_with(*permissions)
    create(:user, role: "staff", permissions: permissions.map(&:to_s))
  end

  def status_of(user, path)
    get path, headers: auth_headers(user)
    response.status
  end

  describe "権限ごとに使える管理APIが切り替わる" do
    it "販売権限: 商品・分析のみ" do
      sales = staff_with(:sales)
      expect(status_of(sales, "/api/v1/admin/products")).to eq(200)
      expect(status_of(sales, "/api/v1/admin/dashboard/sales")).to eq(200)
      expect(status_of(sales, "/api/v1/admin/orders")).to eq(403)
      expect(status_of(sales, "/api/v1/admin/production")).to eq(403)
      expect(status_of(sales, "/api/v1/admin/users")).to eq(403)
      expect(response.parsed_body.dig("error", "message")).to eq("管理者権限が必要です")
    end

    it "注文権限: 注文・顧客・問い合わせと製作担当の候補" do
      orders = staff_with(:orders)
      expect(status_of(orders, "/api/v1/admin/orders")).to eq(200)
      expect(status_of(orders, "/api/v1/admin/customers")).to eq(200)
      expect(status_of(orders, "/api/v1/admin/service_requests")).to eq(200)
      expect(status_of(orders, "/api/v1/admin/staff")).to eq(200)
      expect(status_of(orders, "/api/v1/admin/products")).to eq(403)
      expect(response.parsed_body.dig("error", "message")).to eq("販売の権限が必要です")
      expect(status_of(orders, "/api/v1/admin/materials")).to eq(403)
    end

    it "権限なしのスタッフと会員はどこも使えない / 管理者はすべて使える" do
      none = staff_with
      %w[orders products production users].each do |p|
        expect(status_of(none, "/api/v1/admin/#{p}")).to eq(403)
        expect(status_of(member, "/api/v1/admin/#{p}")).to eq(403)
        expect(status_of(admin, "/api/v1/admin/#{p}")).to eq(200)
      end
    end

    it "製作担当の候補は制作権限を持つユーザーだけ" do
      producer = staff_with(:production, :orders)
      sales = staff_with(:sales)
      get "/api/v1/admin/staff", headers: auth_headers(admin)
      expect(response.parsed_body.map { |u| u["id"] }).to contain_exactly(admin.id, producer.id)

      order = create(:order)
      patch "/api/v1/admin/orders/#{order.id}", params: { assignee_id: sales.id }, headers: auth_headers(admin), as: :json
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "ログイン・プロフィールで実際に持っている権限を返す" do
      staff = staff_with(:orders)
      post "/api/v1/auth/login", params: { email: staff.email, password: "password" }, as: :json
      expect(response.parsed_body.dig("user", "permissions")).to eq(%w[orders])

      get "/api/v1/me", headers: auth_headers(admin)
      expect(response.parsed_body["permissions"]).to eq(%w[sales production orders])
    end
  end

  describe "権限設定 /api/v1/admin/users" do
    it "一覧はスタッフ・管理者、検索では会員も探せる" do
      staff = staff_with(:production)
      member
      get "/api/v1/admin/users", headers: auth_headers(admin)
      expect(response.parsed_body.map { |u| u["id"] }).to contain_exactly(admin.id, staff.id)

      get "/api/v1/admin/users", params: { q: member.email }, headers: auth_headers(admin)
      expect(response.parsed_body.map { |u| u["id"] }).to eq([member.id])
    end

    it "会員をスタッフにして権限を付け外しでき、すぐにAPIの可否に反映される" do
      patch "/api/v1/admin/users/#{member.id}", params: { role: "staff", permissions: %w[sales orders] },
                                                headers: auth_headers(admin), as: :json
      expect(response.parsed_body).to include("role" => "staff", "permissions" => %w[sales orders])
      expect(status_of(member, "/api/v1/admin/orders")).to eq(200)

      patch "/api/v1/admin/users/#{member.id}", params: { permissions: [] }, headers: auth_headers(admin), as: :json
      expect(response.parsed_body["permissions"]).to eq([])
      expect(status_of(member, "/api/v1/admin/orders")).to eq(403)
    end

    it "会員に戻すと権限は外れる" do
      staff = staff_with(:sales)
      patch "/api/v1/admin/users/#{staff.id}", params: { role: "member" }, headers: auth_headers(admin), as: :json
      expect(staff.reload.permissions).to eq([])
    end

    it "不明な権限・自分のロール変更は 422、管理者以外は 403" do
      patch "/api/v1/admin/users/#{member.id}", params: { role: "staff", permissions: %w[secret] },
                                                headers: auth_headers(admin), as: :json
      expect(response).to have_http_status(:unprocessable_entity)

      patch "/api/v1/admin/users/#{admin.id}", params: { role: "staff" }, headers: auth_headers(admin), as: :json
      expect(response.parsed_body.dig("error", "code")).to eq("own_role")
      expect(admin.reload.role).to eq("admin")

      patch "/api/v1/admin/users/#{member.id}", params: { role: "admin" }, headers: auth_headers(staff_with(:sales, :orders)), as: :json
      expect(response).to have_http_status(:forbidden)
    end
  end
end
