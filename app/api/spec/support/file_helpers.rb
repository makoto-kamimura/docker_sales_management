require "zlib"

# アップロード用のテストファイル
module FileHelpers
  def stl_upload(filename = "part.stl", body: "solid part\nendsolid part\n")
    Rack::Test::UploadedFile.new(StringIO.new(body), "model/stl", original_filename: filename)
  end

  # DIY設計図 (図面 PDF)。中身は検証しないので最小限の PDF
  def pdf_upload(filename = "plan.pdf")
    body = "%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n"
    Rack::Test::UploadedFile.new(StringIO.new(body), "application/pdf", true, original_filename: filename)
  end

  # DIY設計図 (CAD の DXF。テキスト形式)
  def dxf_upload(filename = "plan.dxf")
    body = "0\nSECTION\n2\nENTITIES\n0\nLINE\n8\n0\n10\n0\n20\n0\n11\n100\n21\n0\n0\nENDSEC\n0\nEOF\n"
    Rack::Test::UploadedFile.new(StringIO.new(body), "image/vnd.dxf", original_filename: filename)
  end

  def png_upload(filename = "shot.png")
    Rack::Test::UploadedFile.new(StringIO.new(png_bytes), "image/png", true, original_filename: filename)
  end

  # 1x1 の PNG (PDF に埋め込めることの確認用)
  def png_bytes
    chunk = ->(type, data) { [data.bytesize].pack("N") + type + data + [Zlib.crc32(type + data)].pack("N") }
    header = [1, 1, 8, 2, 0, 0, 0].pack("NNCCCCC")
    pixels = Zlib::Deflate.deflate("\x00\xB2\x6A\x2E".b)
    "\x89PNG\r\n\x1A\n".b + chunk.call("IHDR".b, header) + chunk.call("IDAT".b, pixels) + chunk.call("IEND".b, "".b)
  end
end

RSpec.configure do |config|
  config.include FileHelpers
end
