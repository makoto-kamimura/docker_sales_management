class EnableExtensions < ActiveRecord::Migration[7.2]
  def change
    enable_extension "pgcrypto"
    enable_extension "pg_trgm"
    enable_extension "vector"
    enable_extension "citext"
  end
end
