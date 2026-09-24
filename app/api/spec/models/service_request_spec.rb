require "rails_helper"

RSpec.describe ServiceRequest, type: :model do
  it "問い合わせ (inquiry) は件名と本文があれば有効" do
    expect(build(:service_request)).to be_valid
    expect(build(:service_request, subject: "")).not_to be_valid
  end

  it "オーダーメイド依頼 (custom) は有効" do
    expect(build(:service_request, :custom)).to be_valid
  end

  it "kind が不正なら無効" do
    expect(build(:service_request, kind: "maintenance")).not_to be_valid
  end

  it "body が空なら無効" do
    expect(build(:service_request, body: "")).not_to be_valid
  end

  it "kind に存在しないステータスは無効 (inquiry に quoted)" do
    expect(build(:service_request, status: "quoted")).not_to be_valid
    expect(build(:service_request, :custom, status: "quoted")).to be_valid
  end

  it "他人の注文は対象にできない" do
    req = build(:service_request, order: create(:order))
    expect(req).not_to be_valid
    expect(req.errors[:order]).to be_present
  end

  describe "#reply!" do
    it "未対応の問い合わせは回答で「回答済み」になる" do
      req = create(:service_request)
      req.reply!("間に合います")
      expect(req.reload).to have_attributes(status: "answered", reply: "間に合います")
      expect(req.replied_at).to be_present
    end
  end

  describe "#transition_to!" do
    it "kind に存在しないステータスは ArgumentError" do
      expect { create(:service_request).transition_to!("in_progress") }.to raise_error(ArgumentError)
    end
  end
end
