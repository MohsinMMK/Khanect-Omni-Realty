#!/usr/bin/env bash
# One-time Hostinger VPS bootstrap for automated GitHub Actions deploys.
# Run as root on the VPS: curl -fsSL ... | bash  OR  ./scripts/vps-bootstrap.sh
set -euo pipefail

REPO_URL="${REPO_URL:-git@github.com:MohsinMMK/Khanect-Omni-Realty.git}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-codex/production-website-chatbot-platform}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/khanect-omni-realty}"
DEPLOY_KEY_PATH="${DEPLOY_KEY_PATH:-/root/.ssh/khanect_deploy_key}"
GITHUB_ACTIONS_PUBKEY="${GITHUB_ACTIONS_PUBKEY:-}"

echo "==> Khanect VPS bootstrap"
echo "    path:   $DEPLOY_PATH"
echo "    branch: $DEPLOY_BRANCH"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker not found. Install Docker Engine first:" >&2
  echo "  https://docs.docker.com/engine/install/ubuntu/" >&2
  echo "Or switch the VPS to Hostinger's Docker template:" >&2
  echo "  https://www.hostinger.com/support/8306612-how-to-use-the-docker-vps-template-at-hostinger/" >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose plugin not found." >&2
  exit 1
fi

mkdir -p "$(dirname "$DEPLOY_KEY_PATH")"
chmod 700 "$(dirname "$DEPLOY_KEY_PATH")"

if [[ ! -f "$DEPLOY_KEY_PATH" ]]; then
  ssh-keygen -t ed25519 -f "$DEPLOY_KEY_PATH" -N "" -C "khanect-vps-deploy-key"
  echo ""
  echo "==> Add this deploy key to GitHub (repo → Settings → Deploy keys → read-only):"
  cat "${DEPLOY_KEY_PATH}.pub"
  echo ""
  read -r -p "Press Enter after the deploy key is added to GitHub..."
fi

mkdir -p "$DEPLOY_PATH"
export GIT_SSH_COMMAND="ssh -i ${DEPLOY_KEY_PATH} -o StrictHostKeyChecking=accept-new"

if [[ ! -d "${DEPLOY_PATH}/.git" ]]; then
  git clone "$REPO_URL" "$DEPLOY_PATH"
fi

cd "$DEPLOY_PATH"
git fetch origin
git checkout "$DEPLOY_BRANCH"
git reset --hard "origin/${DEPLOY_BRANCH}"

if [[ ! -f .env.production ]]; then
  cp env.production.example .env.production
  echo ""
  echo "==> Created .env.production — edit secrets before first deploy:"
  echo "    nano ${DEPLOY_PATH}/.env.production"
  echo ""
fi

if [[ -n "$GITHUB_ACTIONS_PUBKEY" ]]; then
  mkdir -p /root/.ssh
  chmod 700 /root/.ssh
  if ! grep -qF "$GITHUB_ACTIONS_PUBKEY" /root/.ssh/authorized_keys 2>/dev/null; then
    echo "$GITHUB_ACTIONS_PUBKEY" >> /root/.ssh/authorized_keys
    chmod 600 /root/.ssh/authorized_keys
    echo "==> Added GitHub Actions public key to authorized_keys"
  fi
else
  echo ""
  echo "==> Add GitHub Actions SSH public key to /root/.ssh/authorized_keys"
  echo "    (generate: ssh-keygen -t ed25519 -f github_actions_vps -N \"\")"
  echo "    Or re-run: GITHUB_ACTIONS_PUBKEY='ssh-ed25519 AAAA...' ./scripts/vps-bootstrap.sh"
  echo ""
fi

chmod +x scripts/deploy-vps.sh

echo ""
echo "==> Bootstrap complete. Next steps:"
echo "  1. Finish editing ${DEPLOY_PATH}/.env.production"
echo "  2. First deploy:  cd ${DEPLOY_PATH} && ./scripts/deploy-vps.sh"
echo "  3. GitHub repo → Settings → Secrets and variables → Actions:"
echo "       VPS_HOST          = your VPS IP"
echo "       VPS_USER          = root"
echo "       VPS_SSH_KEY       = private key for GitHub Actions (github_actions_vps)"
echo "       VPS_DEPLOY_PATH   = ${DEPLOY_PATH}"
echo "       DEPLOY_HEALTH_URL = https://yourdomain.com/api/v1/health/ready  (optional)"
echo "  4. GitHub repo → Settings → Environments → create 'production' (optional approvals)"
echo "  5. Push to ${DEPLOY_BRANCH} — Actions runs verify → deploy automatically"