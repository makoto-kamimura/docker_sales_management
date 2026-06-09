require "rails_helper"

RSpec.describe ServiceRequest, type: :model do
  it "整備予約 (preferred_at あり) は有効" do
    expect(build(:service_request)).to be_valid
  end

  it "開発依頼 (system) は有効" do
    expect(build(:service_request, :system)).to be_valid
  end

  it "kind が不正なら無効" do
    expect(build(:service_request, kind: "unknown")).not_to be_valid
  end

  it "body が空なら無効" do
    expect(build(:service_request, body: "")).not_to be_valid
  end

  it "整備予約は preferred_at が必須" do
    req = build(:service_request, preferred_at: nil)
    expect(req).not_to be_valid
    expect(req.errors[:preferred_at]).to be_present
  end

  it "kind に存在しないステータスは無効 (maintenance に quoted)" do
    expect(build(:service_request, status: "quoted")).not_to be_valid
  end

  it "system では quoted ステータスが有効" do
    expect(build(:service_request, :system, status: "quoted")).to be_valid
  end

  describe "#transition_to!" do
    it "許可されたステータスに遷移できる" do
      req = create(:service_request)
      req.transition_to!("confirmed")
      expect(req.reload.status).to eq("confirmed")
    end

    it "kind に存在しないステータスは ArgumentError" do
      req = create(:service_request)
      expect { req.transition_to!("in_progress") }.to raise_error(ArgumentError)
    end
  end
end
