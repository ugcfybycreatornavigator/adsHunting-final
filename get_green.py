from PIL import Image
import sys

img = Image.open('public/logo.png')
img = img.convert('RGBA')

greens = []
# Get the top 10 rows of non-transparent pixels
for y in range(img.height):
    row_has_pixels = False
    for x in range(img.width):
        r, g, b, a = img.getpixel((x, y))
        if a > 200:
            greens.append((r,g,b))
            row_has_pixels = True
    if row_has_pixels and len(greens) > 100:
        break

if greens:
    avg_r = sum(c[0] for c in greens) // len(greens)
    avg_g = sum(c[1] for c in greens) // len(greens)
    avg_b = sum(c[2] for c in greens) // len(greens)
    print(f"Top Green: #{avg_r:02x}{avg_g:02x}{avg_b:02x}")
