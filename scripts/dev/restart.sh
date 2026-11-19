#!/usr/bin/env bash
# Redémarre le serveur de production local sur le port 3000 (tue d'abord tout processus qui l'occupe).
PIDS=$(lsof -t -iTCP:3000 -sTCP:LISTEN 2>/dev/null; pgrep -f 'next start'; pgrep -f 'next-server')
[ -n "$PIDS" ] && kill $PIDS 2>/dev/null
for i in $(seq 1 20); do lsof -t -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1 || break; sleep 0.5; done
NODE_USE_ENV_PROXY=1 NODE_NO_WARNINGS=1 nohup npx next start -p 3000 > "${LOG:-/tmp/next-prod.log}" 2>&1 &
for i in $(seq 1 40); do curl -s -o /dev/null http://localhost:3000/ && break; sleep 0.5; done
echo "serveur prêt"
