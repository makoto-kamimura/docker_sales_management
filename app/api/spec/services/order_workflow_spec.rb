require "rails_helper"

RSpec.describe OrderWorkflow do
  let(:staff) { create(:user, :staff) }
  let(:material) { create(:material, stock: 100) }
  let(:product) do
    create(:product, :stocked).tap { |p| p.product_materials.create!(material: material, quantity: 15) }
  end
  let!(:order) { create(:order, product: product, quantity: 2) }

  def move(to, **opts)
    described_class.new(order, actor: staff).transition!(to, **opts)
  end

  it "注文受付 → 入金確認 で販売在庫の引き当てを確定する" do
    expect(product.inventory.reload).to have_attributes(stock: 10, reserved: 2)
    move("paid")
    expect(order.reload.paid_at).to be_present
    expect(product.inventory.reload).to have_attributes(stock: 8, reserved: 0)
  end

  it "入金確認前は制作・発送に進めない" do
    expect { move("in_production") }.to raise_error(OrderWorkflow::Error, /入金確認前/)
  end

  it "制作中に移ると材料をレシピ×数量ぶん1回だけ消費する" do
    move("paid")
    move("in_production")
    expect(material.reload.stock).to eq(70)
    move("inspection")
    move("in_production") # 検品から差し戻しても再消費しない
    expect(material.reload.stock).to eq(70)
  end

  it "工程を飛ばして発送済みにでき、配送情報を記録する" do
    move("paid")
    move("shipped", carrier: "ヤマト運輸", tracking_number: "1234")
    expect(order.shipment.reload).to have_attributes(status: "shipped", carrier: "ヤマト運輸", tracking_number: "1234")
    move("completed")
    expect(order.shipment.reload.status).to eq("delivered")
  end

  it "遷移の履歴を操作者つきで残す" do
    move("paid")
    move("awaiting_production", note: "材料入荷済み")
    expect(order.events.reload.map(&:status)).to eq(%w[received paid awaiting_production])
    expect(order.events.last).to have_attributes(from_status: "paid", actor: staff, note: "材料入荷済み")
  end

  it "入金前のキャンセルは販売在庫の仮押さえを解除し、以後は変更できない" do
    move("cancelled")
    expect(product.inventory.reload).to have_attributes(stock: 10, reserved: 0)
    expect { move("paid") }.to raise_error(OrderWorkflow::Error, /キャンセル済み/)
  end

  it "デジタル商品のみの注文は入金確認で自動的に完了する" do
    digital = create(:order, product: create(:product, :digital), address: nil)
    described_class.new(digital, actor: staff).transition!("paid")
    expect(digital.reload.status).to eq("completed")
    expect(digital.events.last).to have_attributes(status: "completed", actor: nil)
  end

  describe "#plan!" do
    it "製作担当を設定すると履歴に残す。スタッフ以外は担当にできない" do
      described_class.new(order, actor: staff).plan!(assignee_id: staff.id, due_on: Date.tomorrow)
      expect(order.reload).to have_attributes(assignee: staff, due_on: Date.tomorrow)
      expect(order.events.last.note).to include(staff.name)

      expect { described_class.new(order).plan!(assignee_id: create(:user).id) }
        .to raise_error(ActiveRecord::RecordInvalid)
    end
  end
end
