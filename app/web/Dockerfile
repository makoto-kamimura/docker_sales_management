FROM node:20-alpine

ENV TZ=Asia/Tokyo

RUN apk add --no-cache libc6-compat tzdata && \
    cp /usr/share/zoneinfo/Asia/Tokyo /etc/localtime

WORKDIR /app

COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install || true; fi

COPY . /app

EXPOSE 3001

CMD ["npm", "run", "dev", "--", "-p", "3001", "-H", "0.0.0.0"]
