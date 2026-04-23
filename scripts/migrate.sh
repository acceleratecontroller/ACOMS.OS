#!/bin/sh
# Retry prisma migrate deploy to handle Neon cold-start timeouts.
# Fails the build on persistent migration failure — deploying new code
# against an out-of-date schema produces runtime P2022 column-missing errors
# and a broken app, which is worse than a failed build.
MAX_RETRIES=5
RETRY=0

while [ $RETRY -lt $MAX_RETRIES ]; do
  RETRY=$((RETRY + 1))
  echo "Migration attempt $RETRY of $MAX_RETRIES..."
  npx prisma migrate deploy 2>&1 && exit 0
  echo "Attempt $RETRY failed, waiting $((RETRY * 2))s before retry..."
  sleep $((RETRY * 2))
done

echo "Migration failed after $MAX_RETRIES attempts — aborting build."
exit 1
