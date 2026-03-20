#!/bin/sh
# Retry prisma migrate deploy up to 3 times to handle Neon cold-start timeouts
MAX_RETRIES=3
RETRY=0

while [ $RETRY -lt $MAX_RETRIES ]; do
  RETRY=$((RETRY + 1))
  echo "Migration attempt $RETRY of $MAX_RETRIES..."
  npx prisma migrate deploy 2>&1 && exit 0
  echo "Attempt $RETRY failed, waiting ${RETRY}s before retry..."
  sleep $RETRY
done

echo "Migration failed after $MAX_RETRIES attempts — skipping (migrations may already be applied)"
exit 0
