# syntax=docker/dockerfile:1.7

# ---------------------------------------------------------------------------
# Fancy Finery — production image.
#
# Three stages so the runtime carries neither the build toolchain nor the dev
# dependencies. The final image contains the traced standalone server, the
# static assets, and the migration scripts — nothing else.
# ---------------------------------------------------------------------------

# --- deps ------------------------------------------------------------------
FROM node:24-alpine AS deps
WORKDIR /app

# Only the manifests, so this layer is cached until a dependency actually
# changes. Copying the whole source here would rebuild node_modules on every
# edit to a component.
COPY package.json package-lock.json ./
RUN npm ci


# --- build -----------------------------------------------------------------
FROM node:24-alpine AS build
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* variables are inlined into the CLIENT bundle at build time, so
# they must be present now — reading them at runtime is too late. They are not
# secrets (they reach the browser either way), which is why passing them as
# build args is safe. Everything server-side is read at runtime from the
# container environment and is deliberately NOT baked in.
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_MEDIA_URL
ARG NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_MEDIA_URL=$NEXT_PUBLIC_MEDIA_URL \
    NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=$NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY \
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build


# --- runtime ---------------------------------------------------------------
FROM node:24-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Never run the server as root. Next's standalone output writes nothing to disk
# at runtime, so the app owns only what it needs to read.
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# `standalone` already contains a minimal node_modules traced from real imports.
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public

# Migrations run from inside this image (see the deploy workflow), so the SQL
# and the runner ship with it. `pg` is required by the runner and is already in
# the traced bundle because the app itself uses it.
COPY --from=build --chown=nextjs:nodejs /app/db ./db
COPY --from=build --chown=nextjs:nodejs /app/scripts ./scripts

USER nextjs
EXPOSE 3000

# Report unhealthy rather than serving errors, so the orchestrator can act.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
