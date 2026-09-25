#!/usr/bin/env bash
# Build MacAgentMenuBar into a locally installable .app (personal / no paid Developer ID).
#
# Why permissions reset on each install:
#   macOS TCC keys Microphone/Accessibility grants to the code-signing identity
#   (Team ID + designated requirement), not just the bundle id / app name.
#   Ad-hoc signing (`codesign -s -`) produces a NEW identity every build → TCC
#   treats each rebuild as a different app and asks again.
#
# Fix (default here): sign with a STABLE identity:
#   1) $MAC_AGENT_SIGN_IDENTITY if set
#   2) first "Apple Development: …" identity in Keychain (free Xcode cert)
#   3) local self-signed "Mac Agent Local" cert (created once)
#   4) ad-hoc only as last resort (TCC will reset every build)
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="/usr/bin:/opt/homebrew/bin:${PATH}"

DIST="dist"
APP="$DIST/MacAgent.app"
INSTALL_DIR="${MAC_AGENT_INSTALL_DIR:-$HOME/Applications}"
NOTARY_PROFILE="${MAC_AGENT_NOTARY_PROFILE:-}"
DO_INSTALL=0
DO_OPEN=0

for arg in "$@"; do
  case "$arg" in
    --install) DO_INSTALL=1 ;;
    --open) DO_OPEN=1 ;;
    --help|-h)
      cat <<'EOF'
Usage: ./scripts/package-macos-app.sh [--install] [--open]

  --install  Install/replace ~/Applications/Mac Agent.app (same path every time)
  --open     Launch after build/install

Stable signing keeps Microphone/Accessibility grants across updates.
Override with: export MAC_AGENT_SIGN_IDENTITY="Apple Development: …"
EOF
      exit 0
      ;;
  esac
done

ensure_local_cert() {
  local name="Mac Agent Local"
  if security find-identity -v -p codesigning 2>/dev/null | grep -q "\"$name\""; then
    echo "$name"
    return 0
  fi
  echo "Creating one-time local code-signing certificate '$name'…" >&2
  local tmp
  tmp="$(mktemp -d)"
  # Self-signed code-signing cert in login keychain (personal projects).
  cat >"$tmp/cert.cnf" <<'CNF'
[ req ]
distinguished_name = req_distinguished_name
prompt = no
[ req_distinguished_name ]
CN = Mac Agent Local
[ extensions ]
keyUsage = critical, digitalSignature
extendedKeyUsage = critical, codeSigning
basicConstraints = critical, CA:false
CNF
  openssl req -x509 -newkey rsa:2048 -keyout "$tmp/key.pem" -out "$tmp/cert.pem" \
    -days 3650 -nodes -config "$tmp/cert.cnf" -extensions extensions >/dev/null 2>&1
  openssl pkcs12 -export -out "$tmp/cert.p12" -inkey "$tmp/key.pem" -in "$tmp/cert.pem" \
    -passout pass:macagent -name "$name" >/dev/null 2>&1
  security import "$tmp/cert.p12" -k ~/Library/Keychains/login.keychain-db \
    -P macagent -T /usr/bin/codesign -T /usr/bin/security >/dev/null 2>&1 || \
  security import "$tmp/cert.p12" -k login.keychain \
    -P macagent -T /usr/bin/codesign -T /usr/bin/security >/dev/null 2>&1 || true
  # Allow codesign to use the cert without UI prompt in this session.
  security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "" \
    ~/Library/Keychains/login.keychain-db >/dev/null 2>&1 || true
  rm -rf "$tmp"
  if security find-identity -v -p codesigning 2>/dev/null | grep -q "\"$name\""; then
    echo "$name"
  else
    echo ""
  fi
}

resolve_identity() {
  if [[ -n "${MAC_AGENT_SIGN_IDENTITY:-}" ]]; then
    echo "$MAC_AGENT_SIGN_IDENTITY"
    return 0
  fi
  # Prefer free Xcode "Apple Development" cert — stable Team ID → stable TCC.
  local apple_dev
  apple_dev="$(security find-identity -v -p codesigning 2>/dev/null \
    | sed -n 's/.*"\(Apple Development:.*\)".*/\1/p' | head -1 || true)"
  if [[ -n "$apple_dev" ]]; then
    echo "$apple_dev"
    return 0
  fi
  local local_cert
  local_cert="$(ensure_local_cert)"
  if [[ -n "$local_cert" ]]; then
    echo "$local_cert"
    return 0
  fi
  echo ""
}

IDENTITY="$(resolve_identity)"

mkdir -p "$DIST"
rm -rf "$APP"

echo "Building MacAgentMenuBar (release)…"
swift build -c release --product MacAgentMenuBar

BIN=".build/release/MacAgentMenuBar"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$BIN" "$APP/Contents/MacOS/MacAgentMenuBar"
cp Sources/MacAgentMenuBar/Info.plist "$APP/Contents/Info.plist"
chmod +x "$APP/Contents/MacOS/MacAgentMenuBar"
echo -n 'APPL????' > "$APP/Contents/PkgInfo"

if [[ -n "$IDENTITY" ]]; then
  echo "Codesigning with stable identity: $IDENTITY"
  ENTITLEMENTS="Sources/MacAgentMenuBar/MacAgent.entitlements"
  # Hardened runtime WITHOUT audio-input entitlement → mic TCC never registers the app.
  codesign --force --deep --options runtime --entitlements "$ENTITLEMENTS" --sign "$IDENTITY" "$APP"
else
  echo "WARNING: no stable signing identity — using ad-hoc."
  echo "         Microphone/Accessibility will reset on every install."
  codesign --force --deep --sign - "$APP"
fi
codesign --verify --verbose=2 "$APP" || true
codesign -d --entitlements - "$APP" 2>&1 | head -40 || true
codesign -dv --verbose=2 "$APP" 2>&1 | grep -E '^(Identifier|Signature|TeamIdentifier|Authority)=' || true

xattr -cr "$APP" 2>/dev/null || true

if [[ -n "$NOTARY_PROFILE" && -n "${MAC_AGENT_SIGN_IDENTITY:-}" ]]; then
  ZIP="$DIST/MacAgent.zip"
  ditto -c -k --keepParent "$APP" "$ZIP"
  echo "Submitting to notarytool profile=$NOTARY_PROFILE…"
  xcrun notarytool submit "$ZIP" --keychain-profile "$NOTARY_PROFILE" --wait
  xcrun stapler staple "$APP"
  echo "notarized=YES"
else
  echo "notarize=skipped (not required for personal local install)"
fi

# A second launch with the same bundle id quits itself and leaves the old menu bar up.
if pgrep -f "Mac Agent.app/Contents/MacOS/MacAgentMenuBar" >/dev/null 2>&1; then
  osascript -e 'tell application id "com.mcpui.mac-agent" to quit' >/dev/null 2>&1 || true
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    pgrep -f "Mac Agent.app/Contents/MacOS/MacAgentMenuBar" >/dev/null 2>&1 || break
    sleep 0.2
  done
  pkill -f "Mac Agent.app/Contents/MacOS/MacAgentMenuBar" >/dev/null 2>&1 || true
fi

TARGET="$APP"
if [[ "$DO_INSTALL" -eq 1 ]]; then
  mkdir -p "$INSTALL_DIR"
  DEST="$INSTALL_DIR/Mac Agent.app"
  # Replace in place at the SAME path so TCC path affinity stays stable.
  rm -rf "$DEST"
  ditto "$APP" "$DEST"
  xattr -cr "$DEST" 2>/dev/null || true
  TARGET="$DEST"
  echo "Installed: $DEST"
fi

echo "Built: $APP"
if [[ "$DO_OPEN" -eq 1 ]]; then
  open "$TARGET"
  echo "Launched: $TARGET"
else
  echo "Launch with: open \"$TARGET\""
fi
