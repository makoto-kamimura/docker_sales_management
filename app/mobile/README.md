# Mobile (React Native + Expo)

Expo Router 構成のクライアント。

## 初回ブートストラップ

```bash
cd ../../platform
docker compose run --rm mobile sh -lc \
  "npx --yes create-expo-app@latest . --template tabs"
```

## 起動

```bash
docker compose up mobile
```

ターミナルに表示される QR を Expo Go (iOS/Android) で読み取る。

> 物理デバイスでの開発時は `.env` で `EXPO_PUBLIC_API_BASE=http://<開発PCのLAN IP>/api` に書き換える。
