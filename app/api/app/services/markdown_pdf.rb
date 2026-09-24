require "kramdown"
require "kramdown-parser-gfm"

# Markdown (GFM) を Prawn の PDF に描画する。組み立て説明書の手順・部品/工具で使う。
# 見出し・段落・改行・箇条書き/番号リスト・引用・コード・表・リンク・取り消し線に対応する。
# 日本語フォント (IPAex ゴシック) に太字・斜体の書体がないため、太字は濃い茶色、斜体は薄い色で表す。
# 生の HTML は中の文字だけを出し、画像は代替テキストだけを出す。
class MarkdownPdf
  TEXT   = "2B2420"
  ACCENT = "8A4B1D"
  MUTED  = "7A6E64"
  LINK   = "2A6FB0"
  SIZE   = 10.5

  SMART_QUOTES = { lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”" }.freeze
  TYPOGRAPHIC  = { hellip: "…", mdash: "—", ndash: "–", laquo: "«", raquo: "»", laquo_space: "« ", raquo_space: " »" }.freeze

  # wrap: 日本語の改行位置を入れる処理 (AssemblyGuidePdf#wrappable)
  def initialize(pdf, wrap:)
    @pdf = pdf
    @wrap = wrap
  end

  def render(markdown)
    return if markdown.blank?

    root = Kramdown::Document.new(markdown.to_s, input: "GFM", hard_wrap: true).root
    root.children.each { |el| block(el) }
  end

  private

  def block(el)
    case el.type
    when :blank then nil
    when :p then paragraph(inline(el.children), tight: el.options[:transparent])
    when :header then heading(el)
    when :ul, :ol then list(el)
    when :blockquote then quote(el)
    when :codeblock then code_block(el.value.to_s.chomp)
    when :hr then rule
    when :table then table(el)
    else paragraph(inline(el.children.presence || [el]))
    end
  end

  def paragraph(markup, tight: false)
    return if markup.strip.empty?

    @pdf.text markup, size: SIZE, leading: 3, color: TEXT, inline_format: true
    @pdf.move_down(tight ? 2 : 6)
  end

  def heading(el)
    size = { 1 => 14, 2 => 12.5 }.fetch(el.options[:level], 11.5)
    @pdf.move_down 4
    @pdf.text inline(el.children), size: size, leading: 2, color: TEXT, inline_format: true
    @pdf.move_down 4
  end

  # 記号 (・ / 1.) を左に置き、本文はぶら下げインデントにする
  def list(el)
    first = el.type == :ol ? (el.options[:first_list_number] || 1) : nil
    el.children.select { |li| li.type == :li }.each.with_index do |li, i|
      marker = first ? "#{first + i}." : "・"
      @pdf.float { @pdf.text marker, size: SIZE, leading: 3, color: ACCENT }
      @pdf.indent(first ? 18 : 12) { li.children.each { |c| block(c) } }
    end
    @pdf.move_down 4
  end

  def quote(el)
    top = @pdf.cursor
    page = @pdf.page_number
    @pdf.indent(12) { el.children.each { |c| block(c) } }
    return unless page == @pdf.page_number # ページをまたいだら縦線は省く

    @pdf.stroke_color "D9CFC5"
    @pdf.line_width 2
    @pdf.stroke_line [3, top], [3, @pdf.cursor + 6]
    @pdf.line_width 1
  end

  def code_block(code)
    text = @wrap.call(code)
    width = @pdf.bounds.width - 16
    height = @pdf.height_of(text, size: 9.5, leading: 2, width: width) + 14
    @pdf.start_new_page if @pdf.cursor < height && height < @pdf.bounds.height
    top = @pdf.cursor
    @pdf.fill_color "F3EEE8"
    @pdf.fill_rectangle [0, top], @pdf.bounds.width, height
    @pdf.fill_color "000000"
    @pdf.bounding_box([8, top - 7], width: width) { @pdf.text text, size: 9.5, leading: 2, color: TEXT }
    @pdf.move_down 13
  end

  def rule
    @pdf.move_down 4
    @pdf.stroke_color "D9CFC5"
    @pdf.stroke_horizontal_rule
    @pdf.move_down 8
  end

  def table(el)
    el.children.each do |section| # thead / tbody / tfoot
      section.children.each do |row|
        cells = row.children.map { |cell| inline(cell.children) }
        @pdf.text cells.join("  │  "), size: 9.5, leading: 2, inline_format: true,
                                        color: section.type == :thead ? ACCENT : TEXT
      end
    end
    @pdf.move_down 6
  end

  # Prawn の inline_format (<color> <link> <u> <strikethrough>) の文字列にする。
  # hard_wrap の改行 (:br) の後ろのテキストにも元の改行が残るため、連続した改行は1つにまとめる
  def inline(elements)
    elements.map { |el| inline_element(el) }.join.gsub(/\n{2,}/, "\n")
  end

  def inline_element(el)
    case el.type
    when :text then escape(@wrap.call(el.value))
    when :br then "\n"
    when :strong then "<color rgb='#{ACCENT}'>#{inline(el.children)}</color>"
    when :em then "<color rgb='#{MUTED}'>#{inline(el.children)}</color>"
    when :codespan then "<color rgb='#{ACCENT}'>#{escape(@wrap.call(el.value))}</color>"
    when :a then link(el)
    when :img then "<color rgb='#{MUTED}'>[画像: #{escape(el.attr['alt'].to_s)}]</color>"
    when :smart_quote then SMART_QUOTES.fetch(el.value, "'")
    when :typographic_sym then TYPOGRAPHIC.fetch(el.value, "")
    when :entity then escape(el.value.char.to_s)
    when :html_element
      body = inline(el.children)
      el.value == "del" ? "<strikethrough>#{body}</strikethrough>" : body # GFM の ~~取り消し線~~
    else el.children.any? ? inline(el.children) : escape(@wrap.call(el.value.to_s))
    end
  end

  def link(el)
    href = el.attr["href"].to_s
    label = inline(el.children)
    return label unless href.match?(%r{\A(https?://|mailto:)}i) # javascript: などはリンクにしない

    "<link href='#{escape(href).gsub("'", '%27')}'><color rgb='#{LINK}'><u>#{label}</u></color></link>"
  end

  def escape(text)
    text.to_s.gsub("&", "&amp;").gsub("<", "&lt;").gsub(">", "&gt;")
  end
end
