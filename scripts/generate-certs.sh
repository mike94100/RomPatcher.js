#!/usr/bin/env bash
#
# generate-certs.sh
# Generates a self-signed TLS certificate (cert.pem) and private key (key.pem)
# in the project root if they are missing or expired.
#
# Usage:
#   bash scripts/generate-certs.sh
#   ./scripts/generate-certs.sh   (after chmod +x)
#

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KEY_FILE="$ROOT_DIR/key.pem"
CERT_FILE="$ROOT_DIR/cert.pem"

DAYS=365
SUBJ="/C=US/ST=Local/L=Local/O=RomPatcher/CN=localhost"

cert_valid() {
    # Returns 0 if the certificate exists and is not expired.
    [[ -f "$CERT_FILE" ]] || return 1
    openssl x509 -in "$CERT_FILE" -noout -checkend 0 >/dev/null 2>&1
}

if [[ -f "$KEY_FILE" ]] && cert_valid; then
    echo "Certificates are valid: $CERT_FILE (key: $KEY_FILE)"
    exit 0
fi

echo "Certificates missing or expired. Generating new self-signed certificate..."
openssl req -x509 -newkey rsa:2048 \
    -keyout "$KEY_FILE" \
    -out "$CERT_FILE" \
    -days "$DAYS" \
    -nodes \
    -subj "$SUBJ" >/dev/null 2>&1

echo "Generated:"
echo "  Private key: $KEY_FILE"
echo "  Certificate: $CERT_FILE (valid for $DAYS days, CN=localhost)"
echo ""
echo "Note: This is a self-signed certificate. Browsers will show a warning —"
echo "      click Advanced → Proceed to localhost (unsafe)."
