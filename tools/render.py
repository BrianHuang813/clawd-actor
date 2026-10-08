"""Render clawd-actor frames (frames.json from frames.ts) into a GIF that looks like the terminal."""
import json
import sys

from PIL import Image, ImageDraw, ImageFont

FONT = ImageFont.truetype('/usr/share/fonts/dejavu/DejaVuSansMono.ttf', 18)
FRAME_MS = 140
PAD = 18
BG = (24, 24, 27)
COLORS = {
    None: (220, 220, 220),
    '#D77757': (215, 119, 87),
    'gray': (128, 128, 128),
    'white': (232, 232, 232),
    'yellow': (229, 192, 123),
    'red': (224, 108, 117),
    'green': (152, 195, 121),
    'cyan': (86, 182, 194),
    'magenta': (198, 120, 221),
}
DIM = (120, 120, 120)
BORDER = (90, 90, 96)
ORANGE = COLORS['#D77757']
SUBST = {'∿': '~'}  # no installed font has U+223F

data = json.load(open(sys.argv[1], encoding='utf-8'))
cols = data['width']
ascent, descent = FONT.getmetrics()
CW = round(FONT.getlength('M'))
CH = ascent + descent  # block elements span ascent+descent, so rows touch
ROWS = 4 + 1 + 1 + 1 + 3  # stage, gap, spinner, gap, prompt box
W, H = PAD * 2 + CW * cols, PAD * 2 + CH * ROWS


# Block elements as exact rectangles (quadrants UL, UR, LL, LR), so neighbouring cells meet with no seam
QUADS = {
    '█': 'abcd', '▀': 'ab', '▄': 'cd', '▌': 'ac', '▐': 'bd',
    '▖': 'c', '▗': 'd', '▘': 'a', '▝': 'b',
    '▙': 'acd', '▛': 'abc', '▜': 'abd', '▟': 'bcd',
}


def rgb(name):
    if name in COLORS:
        return COLORS[name]
    if name and name.startswith('#') and len(name) == 7:
        return tuple(int(name[i:i + 2], 16) for i in (1, 3, 5))
    return COLORS[None]


def cell(draw, col, row, ch, color, bg=None):
    ch = SUBST.get(ch, ch)
    x, y = PAD + col * CW, PAD + row * CH
    if bg:
        draw.rectangle([x, y, x + CW - 0.01, y + CH - 0.01], fill=bg)
    if ch == ' ':
        return
    if ch in QUADS:
        hw, hh = CW / 2, CH / 2
        for q in QUADS[ch]:
            qx = x + (hw if q in 'bd' else 0)
            qy = y + (hh if q in 'cd' else 0)
            draw.rectangle([qx, qy, qx + hw - 0.01, qy + hh - 0.01], fill=color)
        return
    if ch == '▁':
        draw.rectangle([x, y + CH * 7 / 8, x + CW - 0.01, y + CH - 0.01], fill=color)
        return
    draw.text((x, y), ch, font=FONT, fill=color, anchor='la')


def line(draw, col, row, text, color):
    for i, ch in enumerate(text):
        cell(draw, col + i, row, ch, color)


def frame(i, f):
    im = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(im)
    for r, runs in enumerate(f['rows']):
        c = 0
        for run in runs:
            color = rgb(run.get('color'))
            bg = rgb(run['bg']) if run.get('bg') else None
            for ch in run['text']:
                cell(d, c, r, ch, color, bg)
                c += 1
    spin = '✻✶'[(i // 3) % 2]
    word = f"{f['word']}…"
    line(d, 0, 5, spin, ORANGE)
    line(d, 2, 5, word, ORANGE)
    tail = f" · {f['note']}" if f['note'] else ' (esc to interrupt)'
    line(d, 2 + len(word), 5, tail, DIM)
    box = cols
    line(d, 0, 7, '╭' + '─' * (box - 2) + '╮', BORDER)
    line(d, 0, 8, '│', BORDER)
    line(d, 2, 8, '>', DIM)
    line(d, box - 1, 8, '│', BORDER)
    line(d, 0, 9, '╰' + '─' * (box - 2) + '╯', BORDER)
    return im


frames = [frame(i, f) for i, f in enumerate(data['frames'])]
# One palette for every frame, built from a sample of them, so colours never flicker
sample = Image.new('RGB', (W, H * 4))
for k, idx in enumerate([0, len(frames) // 3, 2 * len(frames) // 3, len(frames) - 1]):
    sample.paste(frames[idx], (0, H * k))
pal = sample.quantize(colors=96, method=Image.Quantize.MEDIANCUT)
out = [f.quantize(palette=pal, dither=Image.Dither.NONE) for f in frames]
out[0].save(sys.argv[2], save_all=True, append_images=out[1:], duration=FRAME_MS, loop=0, optimize=True, disposal=1)
print(f'{len(out)} frames, {W}x{H}px ->', sys.argv[2])
