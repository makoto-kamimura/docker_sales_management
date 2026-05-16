-- Rails 用 / Dify 用のデータベースを作成
CREATE DATABASE app_test;
CREATE DATABASE dify;

-- pgvector 拡張 (Dify のベクトル検索 / 商品検索 で使用)
\c dify
CREATE EXTENSION IF NOT EXISTS vector;

\c app_development
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
