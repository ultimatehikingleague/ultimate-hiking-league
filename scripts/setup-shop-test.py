#!/usr/bin/env python3
"""Store sandbox credentials locally without echoing them or enabling live sales."""
import getpass
import os
import re
import secrets
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENV = ROOT / '.env.local'

def save(values):
    if ENV.is_symlink():
        raise SystemExit('Abbruch: .env.local ist eine Verknüpfung.')
    text = ENV.read_text() if ENV.exists() else ''
    for key, value in values.items():
        line = f'{key}={value}'
        pattern = rf'^{re.escape(key)}=.*$'
        if re.search(pattern, text, re.M):
            text = re.sub(pattern, lambda _: line, text, flags=re.M)
        else:
            text = text.rstrip('\n') + '\n' + line + '\n'
    fd, filename = tempfile.mkstemp(prefix='.shop-env-', dir=ROOT)
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, 'w') as handle:
            handle.write(text)
        os.replace(filename, ENV)
    finally:
        if os.path.exists(filename):
            os.unlink(filename)

if __name__ == '__main__':
    print('ULTIMATE – lokale Test-Zahlungen (keine echten Zahlungen)')
    print('Eingaben bleiben unsichtbar. Enter überspringt ein Feld.')
    existing = ENV.read_text() if ENV.exists() else ''
    if re.search(r'^SHOP_PAYMENT_MODE=live\s*$', existing, re.M):
        raise SystemExit('Abbruch: Bestehende Live-Konfiguration bitte zuerst getrennt sichern.')
    values = {'SHOP_PAYMENT_MODE': 'test', 'SHOP_LIVE_APPROVED': 'false'}
    if not re.search(r'^SHOP_TOKEN_SECRET=.+$', existing, re.M):
        values['SHOP_TOKEN_SECRET'] = secrets.token_hex(32)
    for key, label, prefix in [
        ('STRIPE_SECRET_KEY', 'Stripe geheimer TEST-Schlüssel (sk_test_)', 'sk_test_'),
        ('STRIPE_WEBHOOK_SECRET', 'Stripe Signatur-Schlüssel (whsec_)', 'whsec_'),
        ('PAYPAL_CLIENT_ID', 'PayPal SANDBOX Client ID', ''),
        ('PAYPAL_CLIENT_SECRET', 'PayPal SANDBOX Secret', ''),
        ('PAYPAL_MERCHANT_ID', 'PayPal SANDBOX Händler-ID', ''),
        ('PAYPAL_WEBHOOK_ID', 'PayPal SANDBOX Webhook-ID', ''),
    ]:
        value = getpass.getpass(label + ': ').strip()
        if not value:
            continue
        if (prefix and not value.startswith(prefix)) or not re.fullmatch(r'[A-Za-z0-9_\-]+', value):
            raise SystemExit('Ungültiges Format. Es wurde nichts gespeichert.')
        values[key] = value
    save(values)
    print('Gespeichert in .env.local. Bestehende andere Einstellungen bleiben erhalten.')
    print('Der Live-Verkauf bleibt gesperrt. Den lokalen Server danach neu starten.')
