-- Rails 用データベースを作成
-- (Dify は公式 compose 側で自前の Postgres を持つためここでは作らない)
CREATE DATABASE app_test;

-- pgvector / pg_trgm 拡張 (商品検索 / Rails 側の埋め込み用)
\c app_development
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
