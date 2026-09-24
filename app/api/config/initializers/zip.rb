# ZIP のファイル名 (日本語) を UTF-8 として記録する (3Dモデルの複数ファイルをまとめて配布するとき)
require "zip"

Zip.unicode_names = true
