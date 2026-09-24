FROM node:20-alpine

ENV TZ=Asia/Tokyo
ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache libc6-compat tzdata && \
    cp /usr/share/zoneinfo/Asia/Tokyo /etc/localtime

WORKDIR /app

COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install || true; fi

COPY . /app

# ブラウザ側のコードに埋め込まれる公開 API URL。ビルド時に確定するため build-arg で渡す
# (本番は https://sales.makoto-kamimura.com/api を compose から指定)
ARG NEXT_PUBLIC_API_BASE=http://localhost/api
ENV NEXT_PUBLIC_API_BASE=$NEXT_PUBLIC_API_BASE

# メモリの少ないホストでもビルドが通るようにヒープ上限を明示する
ENV NODE_OPTIONS=--max-old-space-size=1024
RUN npm run build

# 本番は next start で配信する (開発サーバはビルドキャッシュを常駐させメモリを多く使うため)。
# ローカル開発は platform/docker-compose.yml が command で npm run dev に上書きする。
ENV NODE_ENV=production

EXPOSE 3001

CMD ["npm", "run", "start", "--", "-p", "3001", "-H", "0.0.0.0"]
