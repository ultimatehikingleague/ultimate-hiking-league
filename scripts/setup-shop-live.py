#!/usr/bin/env python3
"""Prepare live credentials separately without enabling sales."""
import getpass
import os
import re
import secrets
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENV = ROOT / '.env.shop-live.local'

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
    print('ULTIMATE – Live-Zugangsdaten vorbereiten; Verkauf bleibt gesperrt.')
    print('Eingaben bleiben unsichtbar. Enter überspringt ein Feld.')
    values = {'SHOP_PAYMENT_MODE': 'live', 'SHOP_LIVE_APPROVED': 'false', 'SHOP_CHECKOUT_ENABLED': 'false', 'SHOP_ORIGIN': 'https://www.ultimatehikingleague.com'}
    for key, label, prefix in [
        ('STRIPE_SECRET_KEY', 'Stripe LIVE-Schlüssel (sk_live_ oder rk_live_)', ('sk_live_', 'rk_live_')),
        ('STRIPE_WEBHOOK_SECRET', 'Stripe LIVE Signatur-Geheimnis (whsec_)', 'whsec_'),
        ('PAYPAL_CLIENT_ID', 'PayPal LIVE Client ID', ''),
        ('PAYPAL_CLIENT_SECRET', 'PayPal LIVE Secret', ''),
        ('PAYPAL_MERCHANT_ID', 'PayPal LIVE Händler-ID (echtes Geschäftskonto)', ''),
    ]:
        value = getpass.getpass(label + ': ').strip()
        if not value: continue
        if (prefix and not value.startswith(prefix)) or not re.fullmatch(r'[A-Za-z0-9_\-]+', value):
            raise SystemExit('Ungültiges Format. Es wurde nichts gespeichert.')
        values[key] = value
    save(values)
    print('Geschützt in .env.shop-live.local gespeichert. Testumgebung unverändert. Verkauf bleibt gesperrt.')
