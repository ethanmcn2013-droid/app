from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import sys

ROOT = Path("artifacts/tasks-redesign/screenshots")
OPTIONS = [("a", "A · Quiet Command"), ("b", "B · Editorial Project Room"), ("c", "C · Signal Spatial")]
VIEWS = ["board", "list", "timeline", "calendar"]
CELL_W, CELL_H = 400, 306
LABEL_H = 34
GUTTER = 12


def font(size: int, bold: bool = False):
    path = Path("C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf")
    return ImageFont.truetype(str(path), size) if path.exists() else ImageFont.load_default()


def build(dataset: str, width: str):
    sheet = Image.new("RGB", (CELL_W * 4 + GUTTER * 5, CELL_H * 3 + GUTTER * 4), "#20211f")
    draw = ImageDraw.Draw(sheet)
    for row, (option, option_name) in enumerate(OPTIONS):
        for column, view in enumerate(VIEWS):
            source = ROOT / f"{option}-{view}-{dataset}-{width}.png"
            image = Image.open(source).convert("RGB")
            max_w, max_h = CELL_W, CELL_H - LABEL_H
            image.thumbnail((max_w, max_h), Image.Resampling.LANCZOS)
            x = GUTTER + column * (CELL_W + GUTTER)
            y = GUTTER + row * (CELL_H + GUTTER)
            frame = Image.new("RGB", (CELL_W, max_h), "#f3f3f0")
            frame.paste(image, ((CELL_W - image.width) // 2, 0))
            sheet.paste(frame, (x, y + LABEL_H))
            draw.text((x + 2, y + 5), f"{option_name} · {view.title()}", fill="#ffffff", font=font(15, True))
    target = Path(f"artifacts/tasks-redesign/comparison-{dataset}-{width}.png")
    target.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(target, optimize=True)
    print(target)


if __name__ == "__main__":
    dataset = sys.argv[1] if len(sys.argv) > 1 else "normal"
    width = sys.argv[2] if len(sys.argv) > 2 else "1440"
    build(dataset, width)
