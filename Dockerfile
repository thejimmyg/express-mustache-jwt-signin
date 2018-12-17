FROM node:alpine as base

FROM base as builder
RUN mkdir /app
WORKDIR /app
COPY package.json /app
COPY package-lock.json /app
RUN npm install --only=prod

FROM base

COPY --from=builder /app /app
COPY bin/ /app/bin/
COPY views/ /app/views/
COPY lib/ /app/lib/
COPY public/ /app/public/
# Note that when running from Docker, we don't use the development yaml/users.yml
# you are expected to mount your own `yaml` volume containing your `users.yml` into `/app/yaml`.
WORKDIR /app
EXPOSE 9005
ENV NODE_PATH=/app/node_modules
ENV NODE_ENV=production
ENV PATH="${PATH}:/app/node_modules/.bin"
CMD ["node", "bin/server.js"]
