"""Build icon.ico from icon.png for the window, taskbar, and executable."""

from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "icon.png"
TARGET = ROOT / "icon.ico"
SIZES = (16, 24, 32, 48, 64, 128, 256)
PAPER = (255, 235, 200, 255)


def clear_background(image):
    """Turn the black field around the paper transparent. Ink on the page stays."""
    image = image.convert("RGBA")
    pixels = image.load()
    width, height = image.size
    seen = bytearray(width * height)
    queue = deque()

    def consider(x, y):
        index = y * width + x
        if seen[index]:
            return
        red, _green, _blue, alpha = pixels[x, y]
        if alpha >= 10 and red >= 180:
            return
        seen[index] = 1
        queue.append((x, y))

    for x in range(width):
        consider(x, 0)
        consider(x, height - 1)
    for y in range(height):
        consider(0, y)
        consider(width - 1, y)

    while queue:
        x, y = queue.popleft()
        red, _green, _blue, _alpha = pixels[x, y]
        if red < 40:
            pixels[x, y] = (0, 0, 0, 0)
        else:
            pixels[x, y] = (PAPER[0], PAPER[1], PAPER[2], red)
        for next_x, next_y in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= next_x < width and 0 <= next_y < height:
                consider(next_x, next_y)
    return image


def main():
    image = clear_background(Image.open(SOURCE))
    image.save(TARGET, format="ICO", sizes=[(size, size) for size in SIZES])


if __name__ == "__main__":
    main()
