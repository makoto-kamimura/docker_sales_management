require "prawn"

# 組み立て説明書 PDF (A4)。管理画面からの出力と、購入者向けのダウンロードで共通に使う
class AssemblyGuidePdf
  class Error < StandardError; end

  FONT_PATH = ENV.fetch("PDF_FONT_PATH", "/usr/share/fonts/opentype/ipaexfont-gothic/ipaexg.ttf")
  LINK_EXPIRES_IN = 5.minutes
  ACCENT = "B26A2E"
  MUTED  = "7A6E64"

  # 購入者向けの期限付きリンク用トークン (ブラウザ・アプリで直接開けるようにヘッダ認証を使わない)
  def self.signed_token(model_asset)
    verifier.generate(model_asset.id, expires_in: LINK_EXPIRES_IN, purpose: :assembly_guide)
  end

  def self.find_by_token(token)
    id = verifier.verified(token.to_s, purpose: :assembly_guide)
    id && ModelAsset.find_by(id: id)
  rescue ArgumentError, ActiveSupport::MessageVerifier::InvalidSignature
    nil
  end

  def self.verifier
    @verifier ||= ActiveSupport::MessageVerifier.new(
      Rails.application.key_generator.generate_key("assembly_guide_pdf"), url_safe: true
    )
  end

  def initialize(model_asset)
    @model = model_asset
  end

  def filename
    "#{@model.name.gsub(%r{[\\/:*?"<>|]}, '_')}_組み立て説明書.pdf"
  end

  def render
    raise Error, "PDF用の日本語フォントが見つかりません (#{FONT_PATH})" unless File.exist?(FONT_PATH)

    pdf = Prawn::Document.new(page_size: "A4", margin: [48, 48, 60, 48],
                              info: { Title: "#{@model.name} 組み立て説明書", Creator: "CraftFlow" })
    pdf.font_families.update("IPAexGothic" => { normal: FONT_PATH, bold: FONT_PATH })
    pdf.font "IPAexGothic"

    header(pdf)
    overview(pdf)
    parts(pdf)
    steps(pdf)
    pdf.number_pages "<page> / <total>", at: [0, -24], width: pdf.bounds.width, align: :center, size: 8, color: MUTED
    pdf.render
  end

  private

  # Prawn は空白でしか改行しないため、日本語など ASCII 以外の文字の後ろにゼロ幅スペース (改行位置) を入れる。
  # ゼロ幅スペースは描画時に取り除かれる
  def wrappable(text)
    text.to_s.gsub(/([^\x00-\x7F])/) { "#{Regexp.last_match(1)}#{Prawn::Text::ZWSP}" }
  end

  def header(pdf)
    pdf.text "組み立て説明書", size: 10, color: ACCENT
    pdf.text wrappable(@model.name), size: 22, leading: 2
    version = @model.current_version
    printed = "出力日 #{Time.current.in_time_zone('Asia/Tokyo').strftime('%Y/%m/%d')}"
    pdf.text [version && "v#{version.number}", printed].compact.join("  ·  "), size: 9, color: MUTED
    pdf.move_down 10
    pdf.stroke_color "D9CFC5"
    pdf.stroke_horizontal_rule
    pdf.move_down 16
  end

  def overview(pdf)
    embed_image(pdf, @model.preview_image, height: 230)
    return if @model.description.blank?

    pdf.text wrappable(@model.description), size: 10.5, leading: 3
    pdf.move_down 16
  end

  def parts(pdf)
    return if @model.assembly_notes.blank?

    heading(pdf, "必要な部品・工具")
    markdown(pdf).render(@model.assembly_notes)
    pdf.move_down 10
  end

  def steps(pdf)
    heading(pdf, "組み立て手順")
    if @model.assembly_steps.empty?
      pdf.text "組み立て手順はまだ登録されていません。", size: 10.5, color: MUTED
      return
    end

    @model.assembly_steps.each.with_index(1) do |step, i|
      # 見出しだけがページ末尾に残らないよう、余裕がなければ改ページする
      pdf.start_new_page if pdf.cursor < (step.image.attached? ? 260 : 90)
      pdf.text "STEP #{i}", size: 9, color: ACCENT
      pdf.text wrappable(step.title), size: 13, leading: 2 if step.title.present?
      pdf.move_down 4
      markdown(pdf).render(step.body)
      embed_image(pdf, step.image, height: 200)
      pdf.move_down 10
    end
  end

  # 手順の説明・部品/工具は Markdown で書ける
  def markdown(pdf)
    MarkdownPdf.new(pdf, wrap: method(:wrappable))
  end

  def heading(pdf, text)
    pdf.start_new_page if pdf.cursor < 80
    pdf.text text, size: 14
    pdf.move_down 8
  end

  # 画像が壊れているなどで埋め込めなくても、PDF 自体は出力する
  def embed_image(pdf, attachment, height:)
    return unless attachment.attached?

    pdf.move_down 6
    pdf.image StringIO.new(attachment.download), fit: [pdf.bounds.width, height], position: :center
    pdf.move_down 10
  rescue StandardError => e
    Rails.logger.warn("assembly guide image skipped: #{e.class}: #{e.message}")
    pdf.text "(画像を表示できませんでした)", size: 9, color: MUTED
  end
end
