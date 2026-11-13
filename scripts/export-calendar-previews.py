"""Render the approved print PDF into trim-sized website images (cover + 12 months)."""
import hashlib
import json
import subprocess
import sys
import tempfile
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
EXPECTED = 'd42ee835e4e82f5fb05f02073583f7f1aa4f8e7cc4ca6ee2f12ddb88707656c8'

def export(pdf, rendered=None):
    if hashlib.sha256(pdf.read_bytes()).hexdigest() != EXPECTED:
        raise SystemExit('Source does not match approved print PDF')
    destination = ROOT / 'public/shop/wanderkalender-2027'
    destination.mkdir(parents=True, exist_ok=True)
    temporary = None
    if rendered is None:
        temporary = tempfile.TemporaryDirectory()
        rendered = Path(temporary.name)
        subprocess.run(['pdftoppm', '-f', '1', '-l', '13', '-r', '150', '-jpeg', '-jpegopt', 'quality=95', str(pdf), str(rendered / 'page')], check=True)
    files = sorted(rendered.glob('page-*.jpg'))
    if len(files) != 13:
        raise SystemExit('Expected cover and twelve month pages')
    manifest = {'sourceSha256': EXPECTED, 'trimMm': [297, 420], 'images': []}
    sheet = Image.new('RGB', (5 * 240, 3 * 365), '#e9e5dc')
    draw = ImageDraw.Draw(sheet)
    labels = ['Cover', 'Januar', 'Februar', 'Maerz', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
    for index, file in enumerate(files):
        image = Image.open(file).convert('RGB')
        # PDF MediaBox 305 x 428 mm; TrimBox has 4 mm bleed on each side.
        w, h = image.size
        image = image.crop((round(w * 4 / 305), round(h * 4 / 428), round(w * 301 / 305), round(h * 424 / 428)))
        name = 'cover-final.webp' if index == 0 else f'month-{index}-final.webp'
        image.save(destination / name, 'WEBP', quality=90, method=6)
        manifest['images'].append({'page': index + 1, 'file': name, 'width': image.width, 'height': image.height})
        thumbnail = ImageOps.contain(image, (220, 325))
        x, y = index % 5 * 240, index // 5 * 365
        sheet.paste(thumbnail, (x + (240-thumbnail.width)//2, y))
        draw.text((x + 12, y + 335), labels[index], fill='#242b24')
    out = ROOT / 'tmp/pdfs/calendar-previews'
    out.mkdir(parents=True, exist_ok=True)
    sheet.save(out / 'contact-sheet.jpg', quality=90)
    (destination / 'preview-manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
    if temporary: temporary.cleanup()
    print('Exported 13 verified PDF previews at final trim size.')

if __name__ == '__main__':
    export(Path(sys.argv[1]), Path(sys.argv[2]) if len(sys.argv) > 2 else None)
