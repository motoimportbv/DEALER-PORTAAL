"""
Generate dealer flyers for Moto Import - "Adverteer op Google" campaign
Creates both A4 print-ready and Instagram social media format
"""
import io
import httpx
import qrcode
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance

# === CONFIG ===
HERO_IMAGE_URL = "https://images.unsplash.com/photo-1595822388819-468d10427c02?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA0MTJ8MHwxfHNlYXJjaHwxfHxtb3RvcmN5Y2xlJTIwcm9hZCUyMHNwZWVkfGVufDB8fHx8MTc3NDkwNTQ2OXww&ixlib=rb-4.1.0&q=85&w=1920"
QR_URL = "https://motoimportbv.nl/google"
OUTPUT_A4 = "/app/backend/uploads/flyer_google_motoren_a4.png"
OUTPUT_INSTA = "/app/backend/uploads/flyer_google_motoren_instagram.png"

# Colors
RED = '#dc2626'
DARK = '#18181b'
WHITE = '#ffffff'
LIGHT_GRAY = '#f4f4f5'
ZINC = '#71717a'

def load_fonts():
    """Load system fonts at various sizes"""
    fonts = {}
    try:
        base = "/usr/share/fonts/truetype/dejavu/"
        for size in [18, 22, 26, 30, 36, 42, 52, 64, 80, 96, 110]:
            fonts[f'bold_{size}'] = ImageFont.truetype(f"{base}DejaVuSans-Bold.ttf", size)
            fonts[f'reg_{size}'] = ImageFont.truetype(f"{base}DejaVuSans.ttf", size)
    except:
        default = ImageFont.load_default()
        for size in [18, 22, 26, 30, 36, 42, 52, 64, 80, 96, 110]:
            fonts[f'bold_{size}'] = default
            fonts[f'reg_{size}'] = default
    return fonts

def generate_qr(url, size=300):
    """Generate QR code image"""
    qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=10, border=2)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color=DARK, back_color=WHITE).convert('RGB')
    return img.resize((size, size), Image.Resampling.LANCZOS)

def draw_rounded_rect(draw, xy, radius, fill):
    """Draw a rounded rectangle"""
    x1, y1, x2, y2 = xy
    draw.rectangle([x1 + radius, y1, x2 - radius, y2], fill=fill)
    draw.rectangle([x1, y1 + radius, x2, y2 - radius], fill=fill)
    draw.pieslice([x1, y1, x1 + 2*radius, y1 + 2*radius], 180, 270, fill=fill)
    draw.pieslice([x2 - 2*radius, y1, x2, y1 + 2*radius], 270, 360, fill=fill)
    draw.pieslice([x1, y2 - 2*radius, x1 + 2*radius, y2], 90, 180, fill=fill)
    draw.pieslice([x2 - 2*radius, y2 - 2*radius, x2, y2], 0, 90, fill=fill)

def load_hero_image():
    """Download hero motorcycle image"""
    resp = httpx.get(HERO_IMAGE_URL, timeout=15, follow_redirects=True)
    return Image.open(io.BytesIO(resp.content)).convert('RGB')

def create_a4_flyer(hero_img, fonts):
    """Create A4 format flyer (2480 x 3508 px at 300dpi)"""
    W, H = 2480, 3508
    img = Image.new('RGB', (W, H), WHITE)
    draw = ImageDraw.Draw(img)
    
    # === TOP HERO SECTION (40% of height) ===
    hero_h = 1300
    hero = hero_img.copy()
    hero = hero.resize((W, hero_h), Image.Resampling.LANCZOS)
    # Darken the hero image
    enhancer = ImageEnhance.Brightness(hero)
    hero = enhancer.enhance(0.4)
    img.paste(hero, (0, 0))
    
    # Gradient overlay from bottom of hero
    for y in range(hero_h - 400, hero_h):
        alpha = int(255 * ((y - (hero_h - 400)) / 400))
        draw.line([(0, y), (W, y)], fill=(24, 24, 27, alpha))
    
    # Red accent bar at top
    draw.rectangle([0, 0, W, 12], fill=RED)
    
    # Moto Import Logo area (top left)
    draw.rectangle([80, 50, 200, 120], fill=RED)
    draw.text((90, 55), "MI", font=fonts['bold_42'], fill=WHITE)
    draw.text((220, 62), "MOTO IMPORT", font=fonts['bold_36'], fill=WHITE)
    
    # Main headline on hero
    draw.text((120, 400), "VERGROOT", font=fonts['bold_110'], fill=WHITE)
    draw.text((120, 530), "UW BEREIK", font=fonts['bold_110'], fill=RED)
    
    # Subheadline
    draw.text((120, 700), "Zet uw motoren op Google en bereik", font=fonts['reg_42'], fill='#d4d4d8')
    draw.text((120, 760), "miljoenen kopers in heel Nederland", font=fonts['reg_42'], fill='#d4d4d8')
    
    # Guarantee badge
    draw_rounded_rect(draw, [120, 880, 1100, 960], 20, RED)
    draw.text((160, 892), "GEGARANDEERD MEER MOTOREN VERKOPEN", font=fonts['bold_30'], fill=WHITE)
    
    # === FREE WEEK BANNER ===
    banner_y = hero_h + 20
    draw.rectangle([0, banner_y, W, banner_y + 160], fill=RED)
    draw.text((W//2 - 500, banner_y + 30), "EERSTE WEEK GRATIS!", font=fonts['bold_80'], fill=WHITE)
    
    # === HOW IT WORKS SECTION ===
    section_y = banner_y + 220
    draw.text((120, section_y), "HOE WERKT HET?", font=fonts['bold_52'], fill=DARK)
    draw.rectangle([120, section_y + 70, 320, section_y + 76], fill=RED)
    
    steps = [
        ("1", "Meld u aan op het platform", "Log in als dealer en ga naar 'Google Motoren'"),
        ("2", "Kies uw abonnement", "Per motor (€2,95/week) of onbeperkt (€45/maand)"),
        ("3", "Upload uw motoren", "Foto's, beschrijving en prijs toevoegen"),
        ("4", "Google doet de rest!", "Uw motor verschijnt in Google zoekresultaten"),
    ]
    
    step_y = section_y + 120
    for num, title, desc in steps:
        # Number circle
        cx, cy = 200, step_y + 50
        draw.ellipse([cx-40, cy-40, cx+40, cy+40], fill=RED)
        draw.text((cx-14, cy-25), num, font=fonts['bold_42'], fill=WHITE)
        # Text
        draw.text((300, step_y + 10), title, font=fonts['bold_36'], fill=DARK)
        draw.text((300, step_y + 60), desc, font=fonts['reg_26'], fill=ZINC)
        step_y += 140
    
    # === PRICING SECTION ===
    price_y = step_y + 60
    draw.text((120, price_y), "TARIEVEN", font=fonts['bold_52'], fill=DARK)
    draw.rectangle([120, price_y + 70, 320, price_y + 76], fill=RED)
    
    # Per motor card
    card_y = price_y + 120
    draw_rounded_rect(draw, [120, card_y, 1180, card_y + 300], 24, LIGHT_GRAY)
    draw.text((200, card_y + 30), "PER MOTOR", font=fonts['bold_42'], fill=DARK)
    draw.text((200, card_y + 90), "€2,95", font=fonts['bold_80'], fill=RED)
    draw.text((620, card_y + 120), "/ motor / week", font=fonts['reg_30'], fill=ZINC)
    draw.text((200, card_y + 200), "1 motor op Google - 7 dagen zichtbaar", font=fonts['reg_26'], fill=ZINC)
    
    # Monthly card
    draw_rounded_rect(draw, [1300, card_y, 2360, card_y + 300], 24, DARK)
    draw_rounded_rect(draw, [1800, card_y + 15, 2100, card_y + 60], 12, RED)
    draw.text((1820, card_y + 18), "POPULAIR", font=fonts['bold_22'], fill=WHITE)
    draw.text((1380, card_y + 30), "MAANDELIJKS", font=fonts['bold_42'], fill=WHITE)
    draw.text((1380, card_y + 90), "€45", font=fonts['bold_80'], fill=RED)
    draw.text((1700, card_y + 120), "/ maand", font=fonts['reg_30'], fill='#a1a1aa')
    draw.text((1380, card_y + 200), "Onbeperkt motoren - 30 dagen geldig", font=fonts['reg_26'], fill='#a1a1aa')
    
    # === BENEFITS ===
    ben_y = card_y + 380
    benefits = [
        "Uw motoren verschijnen in Google zoekresultaten",
        "Alle dealer contactgegevens direct zichtbaar voor kopers",
        "Social media post automatisch gegenereerd bij goedkeuring",
        "Professionele presentatie met foto's en beschrijving",
    ]
    for b in benefits:
        # Checkmark
        draw.ellipse([160, ben_y + 4, 196, ben_y + 40], fill='#16a34a')
        draw.text((170, ben_y + 4), "v", font=fonts['bold_22'], fill=WHITE)
        draw.text((220, ben_y + 4), b, font=fonts['reg_30'], fill=DARK)
        ben_y += 60
    
    # === BOTTOM CTA WITH QR ===
    cta_y = H - 440
    draw.rectangle([0, cta_y, W, H], fill=DARK)
    draw.rectangle([0, cta_y, W, cta_y + 8], fill=RED)
    
    # QR Code
    qr = generate_qr(QR_URL, 300)
    # White background for QR
    draw_rounded_rect(draw, [140, cta_y + 60, 480, cta_y + 400], 16, WHITE)
    img.paste(qr, (155, cta_y + 75))
    
    # CTA text
    draw.text((540, cta_y + 70), "START VANDAAG GRATIS", font=fonts['bold_64'], fill=WHITE)
    draw.text((540, cta_y + 160), "Scan de QR-code of ga naar:", font=fonts['reg_30'], fill='#a1a1aa')
    draw.text((540, cta_y + 210), "motoimportbv.nl/google", font=fonts['bold_42'], fill=RED)
    
    # Contact info
    draw.text((540, cta_y + 310), "Moto Import B.V.  |  +31 6 24264861  |  motoimportbv@gmail.com", font=fonts['reg_22'], fill='#71717a')
    
    # Red bottom bar
    draw.rectangle([0, H - 16, W, H], fill=RED)
    
    img.save(OUTPUT_A4, 'PNG', dpi=(300, 300))
    print(f"A4 flyer saved: {OUTPUT_A4}")
    return img

def create_instagram_flyer(hero_img, fonts):
    """Create Instagram format flyer (1080 x 1080 px)"""
    W, H = 1080, 1080
    img = Image.new('RGB', (W, H), DARK)
    draw = ImageDraw.Draw(img)
    
    # === HERO BACKGROUND (TOP HALF) ===
    hero = hero_img.copy()
    hero = hero.resize((W, 540), Image.Resampling.LANCZOS)
    enhancer = ImageEnhance.Brightness(hero)
    hero = enhancer.enhance(0.3)
    img.paste(hero, (0, 0))
    
    # Gradient overlay
    for y in range(300, 540):
        alpha = int(255 * ((y - 300) / 240))
        draw.line([(0, y), (W, y)], fill=(24, 24, 27, alpha))
    
    # Red top bar
    draw.rectangle([0, 0, W, 6], fill=RED)
    
    # Logo
    draw.rectangle([40, 30, 110, 72], fill=RED)
    draw.text((48, 33), "MI", font=fonts['bold_26'], fill=WHITE)
    draw.text((120, 36), "MOTO IMPORT", font=fonts['bold_22'], fill=WHITE)
    
    # Main headline
    draw.text((60, 140), "VERGROOT", font=fonts['bold_64'], fill=WHITE)
    draw.text((60, 215), "UW BEREIK", font=fonts['bold_64'], fill=RED)
    
    # Subtext
    draw.text((60, 310), "Zet uw motoren op Google", font=fonts['reg_26'], fill='#d4d4d8')
    draw.text((60, 345), "en bereik miljoenen kopers", font=fonts['reg_26'], fill='#d4d4d8')
    
    # Guarantee badge
    draw_rounded_rect(draw, [60, 400, 620, 450], 12, RED)
    draw.text((80, 408), "GEGARANDEERD MEER VERKOPEN", font=fonts['bold_22'], fill=WHITE)
    
    # === FREE WEEK BANNER ===
    draw.rectangle([0, 490, W, 570], fill=RED)
    draw.text((W//2 - 280, 503), "EERSTE WEEK GRATIS!", font=fonts['bold_42'], fill=WHITE)
    
    # === PRICING ===
    # Per motor
    draw_rounded_rect(draw, [40, 595, 525, 730], 16, '#27272a')
    draw.text((70, 608), "PER MOTOR", font=fonts['bold_22'], fill='#a1a1aa')
    draw.text((70, 642), "€2,95", font=fonts['bold_52'], fill=RED)
    draw.text((310, 662), "/week", font=fonts['reg_22'], fill='#71717a')
    draw.text((70, 700), "1 motor, 7 dagen op Google", font=fonts['reg_18'], fill='#a1a1aa')
    
    # Monthly
    draw_rounded_rect(draw, [555, 595, 1040, 730], 16, '#27272a')
    draw.rectangle([555, 595, 1040, 601], fill=RED)
    draw_rounded_rect(draw, [870, 600, 1020, 632], 8, RED)
    draw.text((880, 604), "POPULAIR", font=fonts['bold_18'], fill=WHITE)
    draw.text((585, 608), "MAANDELIJKS", font=fonts['bold_22'], fill='#a1a1aa')
    draw.text((585, 642), "€45", font=fonts['bold_52'], fill=RED)
    draw.text((750, 662), "/maand", font=fonts['reg_22'], fill='#71717a')
    draw.text((585, 700), "Onbeperkt motoren plaatsen", font=fonts['reg_18'], fill='#a1a1aa')
    
    # === BOTTOM: QR + CTA ===
    draw.rectangle([0, 760, W, 764], fill='#27272a')
    
    # QR Code
    qr = generate_qr(QR_URL, 200)
    draw_rounded_rect(draw, [40, 790, 260, 1010], 12, WHITE)
    img.paste(qr, (50, 800))
    
    # CTA
    draw.text((290, 800), "START VANDAAG", font=fonts['bold_42'], fill=WHITE)
    draw.text((290, 855), "GRATIS", font=fonts['bold_42'], fill=RED)
    draw.text((290, 920), "Scan de QR-code of ga naar:", font=fonts['reg_18'], fill='#a1a1aa')
    draw.text((290, 948), "motoimportbv.nl/google", font=fonts['bold_26'], fill=RED)
    draw.text((290, 990), "+31 6 24264861", font=fonts['reg_18'], fill='#71717a')
    
    # Red bottom bar
    draw.rectangle([0, H - 8, W, H], fill=RED)
    
    img.save(OUTPUT_INSTA, 'PNG')
    print(f"Instagram flyer saved: {OUTPUT_INSTA}")
    return img


if __name__ == "__main__":
    print("Loading fonts...")
    fonts = load_fonts()
    
    print("Loading hero image...")
    hero = load_hero_image()
    
    print("Creating A4 flyer...")
    create_a4_flyer(hero, fonts)
    
    print("Creating Instagram flyer...")
    create_instagram_flyer(hero, fonts)
    
    print("\nDone! Flyers generated:")
    print(f"  A4: {OUTPUT_A4}")
    print(f"  Instagram: {OUTPUT_INSTA}")
