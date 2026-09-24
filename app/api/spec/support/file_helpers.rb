require "zlib"

# アップロード用のテストファイル
module FileHelpers
  def stl_upload(filename = "part.stl", body: "solid part\nendsolid part\n")
    Rack::Test::UploadedFile.new(StringIO.new(body), "model/stl", original_filename: filename)
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
