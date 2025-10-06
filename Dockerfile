FROM node:18 AS base

# RUN npm install -g pnpm

WORKDIR /server
COPY package.json ./

RUN npm install


COPY . .

# RUN npx prisma generate

# Development stage
FROM base AS development
CMD /bin/bash -c "npx prisma migrate dev && npx prisma db push && npm run start:dev"

# Test stage
FROM base AS test
CMD /bin/bash -c "npx prisma migrate deploy && npx prisma db push && npm run start:test"

# Production stage
FROM base AS production
RUN npm install --only=production
CMD /bin/bash -c "npx prisma migrate deploy && npx prisma db push && npm run start:prod"
