from PIL import Image, ImageDraw, ImageFont
import os

# Moto Import brand colors
BACKGROUND_COLOR = (24, 24, 27)  # #18181b (zinc-900)
ACCENT_COLOR = (220, 38, 38)      # #DC2626 (red-600)
TEXT_COLOR = (255, 255, 255)      # white

# Splash screen sizes for iOS devices
SPLASH_SIZES = [
    (1125, 2436),  # iPhone X, XS, 11 Pro, 12 Mini, 13 Mini
    (1242, 2688),  # iPhone XR, 11, XS Max, 11 Pro Max
    (1170, 2532),  # iPhone 12, 12 Pro, 13, 13 Pro, 14
    (1284, 2778),  # iPhone 12 Pro Max, 13 Pro Max, 14 Plus
    (1179, 2556),  # iPhone 14 Pro
    (1290, 2796),  # iPhone 14 Pro Max, 15 Pro Max
    (2048, 2732),  # iPad Pro 12.9"
    (1668, 2388),  # iPad Pro 11"
    (1620, 2160),  # iPad Air, iPad 10.2"
]

def create_splash(width, height):
    # Create image with background
    img = Image.new('RGB', (width, height), BACKGROUND_COLOR)
    draw = ImageDraw.Draw(img)
    
    # Calculate center
    center_x = width // 2
    center_y = height // 2
    
    # Draw red circle/logo area
    logo_size = min(width, height) // 6
    logo_x = center_x - logo_size // 2
    logo_y = center_y - logo_size - 20
    
    # Red rounded rectangle as logo background
    draw.rounded_rectangle(
        [logo_x, logo_y, logo_x + logo_size, logo_y + logo_size],
        radius=logo_size // 5,
        fill=ACCENT_COLOR
    )
    
    # Draw motorcycle icon (simplified)
    icon_padding = logo_size // 5
    # Wheels
    wheel_radius = logo_size // 8
    wheel_y = logo_y + logo_size - icon_padding - wheel_radius
    draw.ellipse([
        logo_x + icon_padding, wheel_y - wheel_radius,
        logo_x + icon_padding + wheel_radius * 2, wheel_y + wheel_radius
    ], outline=TEXT_COLOR, width=3)
    draw.ellipse([
        logo_x + logo_size - icon_padding - wheel_radius * 2, wheel_y - wheel_radius,
        logo_x + logo_size - icon_padding, wheel_y + wheel_radius
    ], outline=TEXT_COLOR, width=3)
    
    # Body line connecting wheels
    draw.line([
        logo_x + icon_padding + wheel_radius, wheel_y - wheel_radius // 2,
        logo_x + logo_size - icon_padding - wheel_radius, wheel_y - wheel_radius // 2
    ], fill=TEXT_COLOR, width=3)
    
    # Handlebar
    draw.line([
        logo_x + logo_size - icon_padding - wheel_radius, wheel_y - wheel_radius,
        logo_x + logo_size - icon_padding - wheel_radius // 2, wheel_y - wheel_radius * 2
    ], fill=TEXT_COLOR, width=3)
    
    # Text "MOTO IMPORT"
    text = "MOTO IMPORT"
    # Use default font with appropriate size
    font_size = logo_size // 3
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
    except:
        font = ImageFont.load_default()
    
    text_bbox = draw.textbbox((0, 0), text, font=font)
    text_width = text_bbox[2] - text_bbox[0]
    text_x = center_x - text_width // 2
    text_y = logo_y + logo_size + 30
    
    draw.text((text_x, text_y), text, fill=TEXT_COLOR, font=font)
    
    return img

# Generate all splash screens
for width, height in SPLASH_SIZES:
    img = create_splash(width, height)
    filename = f"splash-{width}x{height}.png"
    img.save(filename, 'PNG', optimize=True)
    print(f"Created {filename}")

print("All splash screens generated!")
