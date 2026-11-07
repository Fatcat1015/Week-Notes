"""Week Note: a small desktop window for the current week."""

import ctypes
import json
import os
import subprocess
import sys
import threading
from pathlib import Path

import webview


def app_root():
    if getattr(sys, "frozen", False):
        return Path(sys._MEIPASS)
    return Path(__file__).resolve().parent


ROOT = app_root()
UI = ROOT / "ui" / "index.html"
ICON = ROOT / "icon.ico"
DEFAULT_WIDTH = 300
DEFAULT_HEIGHT = 640
MIN_WIDTH = 260
MIN_HEIGHT = 420
_settings_lock = threading.Lock()


def note_path():
    override = os.environ.get("WEEK_NOTE_HOME")
    if override:
        directory = Path(override)
    else:
        appdata = os.environ.get("APPDATA")
        directory = Path(appdata) / "week-note" if appdata else Path.home() / ".week-note"
    return directory / "note.json"


class Api:
    def __init__(self):
        self._path = note_path()
        self._broken = False
        self._save_lock = threading.Lock()
        self._window = None
        self._anchor = None

    def attach(self, window, anchor):
        self._window = window
        self._anchor = anchor

    def collapse_to_icon(self):
        window = self._window
        anchor = self._anchor
        if window is None or anchor is None or window.native is None:
            return {"ok": False}
        native = window.native

        def go():
            anchor.collapse_animated()

        if native.InvokeRequired:
            from System import Action

            native.BeginInvoke(Action(go))
        else:
            go()
        return {"ok": True}

    def load_note(self):
        if not self._path.exists():
            return {"weeks": {}}
        payload = note_from_file(self._path)
        if payload is None:
            self._broken = True
            return {"weeks": {}, "unreadable": True}
        return payload

    def get_settings(self):
        return load_settings()

    def set_language(self, language):
        if not save_language(language):
            return {"ok": False}
        return {"ok": True, "language": language}

    def list_fonts(self):
        return {"fonts": installed_fonts()}

    def set_font(self, name, language=None):
        if not isinstance(name, str):
            return {"ok": False}
        cleaned = " ".join(name.split())
        if language not in ("en", "zh"):
            language = None
        if not cleaned or len(cleaned) > 80:
            return {"ok": False}
        outcome = {"ok": False}

        def go():
            allowed = set(installed_font_names())
            allowed.update(FONT_CHOICES)
            if cleaned not in allowed:
                return
            with _settings_lock:
                chosen_language = language if language in ("en", "zh") else load_settings()["language"]
                fonts = load_settings()["fonts"]
                fonts[chosen_language] = cleaned
                data = read_settings_file()
                data["fonts"] = fonts
                data.pop("font", None)
                write_settings_file(data)
            outcome["ok"] = True
            outcome["font"] = cleaned
            outcome["language"] = chosen_language

        self._on_ui(go)
        return outcome

    def set_font_size(self, size):
        if isinstance(size, bool) or not isinstance(size, (int, float)):
            return {"ok": False}
        if isinstance(size, float) and not size.is_integer():
            return {"ok": False}
        cleaned = int(size)
        if cleaned < FONT_SIZE_MIN or cleaned > FONT_SIZE_MAX:
            return {"ok": False}
        update_settings(fontSize=cleaned)
        return {"ok": True, "fontSize": cleaned}

    def reset_fonts(self):
        with _settings_lock:
            data = read_settings_file()
            data["fonts"] = dict(DEFAULT_FONTS)
            data.pop("font", None)
            write_settings_file(data)
        return {"ok": True, "fonts": dict(DEFAULT_FONTS)}

    def open_save_folder(self):
        folder = self._path.parent
        folder.mkdir(parents=True, exist_ok=True)
        if self._path.exists():
            subprocess.Popen(["explorer.exe", "/select,", str(self._path)])
        else:
            subprocess.Popen(["explorer.exe", str(folder)])
        return {"ok": True}

    def export_note(self, language=None):
        outcome = {}

        def go():
            if self._broken:
                outcome.update({"ok": False, "error": "unreadable"})
                return
            titles = dialog_text(language)
            chosen = pick_note_file(self._window.native if self._window else None, titles["export"], save=True)
            if not chosen:
                outcome.update({"ok": False, "cancelled": True})
                return
            payload = note_from_file(self._path) if self._path.exists() else empty_note()
            if payload is None:
                outcome.update({"ok": False, "error": "unreadable"})
                return
            try:
                write_note(Path(chosen), payload)
            except OSError:
                outcome.update({"ok": False, "error": "failed"})
                return
            outcome.update({"ok": True})

        self._on_ui(go)
        return outcome

    def import_note(self, language=None):
        outcome = {}

        def go():
            titles = dialog_text(language)
            chosen = pick_note_file(self._window.native if self._window else None, titles["import"], save=False)
            if not chosen:
                outcome.update({"ok": False, "cancelled": True})
                return
            payload = note_from_file(Path(chosen))
            if payload is None:
                outcome.update({"ok": False, "error": "invalid"})
                return
            try:
                with self._save_lock:
                    write_note(self._path, payload)
            except OSError:
                outcome.update({"ok": False, "error": "failed"})
                return
            self._broken = False
            outcome.update({"ok": True, "weeks": payload["weeks"], "reminder": payload["reminder"], "reminderOpen": payload["reminderOpen"]})

        self._on_ui(go)
        return outcome

    def _on_ui(self, work):
        native = self._window.native if self._window is not None else None
        if native is not None and native.InvokeRequired:
            from System import Action

            native.Invoke(Action(work))
            return
        work()

    def save_note(self, note):
        if self._broken:
            return {"ok": False, "error": "unreadable"}
        if not isinstance(note, dict) or not isinstance(note.get("weeks"), dict):
            return {"ok": False, "error": "invalid"}
        reminder = note.get("reminder", "")
        if not isinstance(reminder, str):
            return {"ok": False, "error": "invalid"}
        try:
            payload = json.dumps(
                {
                    "weeks": note["weeks"],
                    "reminder": reminder,
                    "reminderOpen": note.get("reminderOpen") is True,
                },
                ensure_ascii=False,
                indent=2,
            )
        except (TypeError, ValueError):
            return {"ok": False, "error": "invalid"}
        self._path.parent.mkdir(parents=True, exist_ok=True)
        temporary = self._path.with_suffix(".json.tmp")
        with self._save_lock:
            temporary.write_text(payload, encoding="utf-8")
            temporary.replace(self._path)
        return {"ok": True}


def window_path():
    return note_path().with_name("window.json")


def _read_window_file():
    path = window_path()
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return data if isinstance(data, dict) else {}


def _write_window_file(data):
    path = window_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(data), encoding="utf-8")
    temporary.replace(path)


def load_window():
    data = _read_window_file()
    try:
        x = int(data["x"])
        y = int(data["y"])
        width = int(data["width"])
        height = int(data["height"])
    except (KeyError, TypeError, ValueError):
        return None
    if width < MIN_WIDTH or height < MIN_HEIGHT:
        return None
    return {
        "x": x,
        "y": y,
        "width": width,
        "height": height,
        "maximized": bool(data.get("maximized")),
    }


def load_anchor():
    data = _read_window_file()
    try:
        return int(data["anchorX"]), int(data["anchorY"])
    except (KeyError, TypeError, ValueError):
        return None


def save_window(x, y, width, height, maximized):
    if width < MIN_WIDTH or height < MIN_HEIGHT:
        return
    data = _read_window_file()
    data.update(
        {"x": x, "y": y, "width": width, "height": height, "maximized": bool(maximized)}
    )
    _write_window_file(data)


def save_anchor(x, y):
    data = _read_window_file()
    data["anchorX"] = int(x)
    data["anchorY"] = int(y)
    _write_window_file(data)


def settings_path():
    return note_path().with_name("settings.json")


def empty_note():
    return {"weeks": {}, "reminder": "", "reminderOpen": False}


def note_payload(data):
    if not isinstance(data, dict):
        return None
    weeks = data.get("weeks", {})
    if not isinstance(weeks, dict):
        return None
    reminder = data.get("reminder", "")
    if not isinstance(reminder, str):
        return None
    return {
        "weeks": weeks,
        "reminder": reminder,
        "reminderOpen": data.get("reminderOpen") is True,
    }


def note_from_file(path):
    try:
        data = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, UnicodeError):
        return None
    return note_payload(data)


def write_note(path, payload):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".json.tmp")
    temporary.write_text(
        json.dumps(note_payload(payload) or empty_note(), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    temporary.replace(path)


DEFAULT_FONTS = {"en": "ELEGANT TYPEWRITER", "zh": "汇文明朝体"}
FONT_SIZE_MIN = 10
FONT_SIZE_MAX = 24
DEFAULT_FONT_SIZE = 12
FONT_CHOICES = ("Courier Prime", "ELEGANT TYPEWRITER", "汇文明朝体", "Huiwen-mincho")


def read_settings_file():
    path = settings_path()
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, UnicodeError):
        return {}
    return data if isinstance(data, dict) else {}


def write_settings_file(data):
    path = settings_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    temporary.replace(path)


def load_settings():
    data = read_settings_file()
    language = "zh" if data.get("language") == "zh" else "en"
    fonts = {"en": "", "zh": ""}
    stored = data.get("fonts")
    if isinstance(stored, dict):
        for key in fonts:
            value = stored.get(key)
            if isinstance(value, str):
                fonts[key] = value.strip()
    elif isinstance(data.get("font"), str):
        fonts[language] = data["font"].strip()
    return {
        "language": language,
        "fonts": fonts,
        "fontSize": font_size_value(data.get("fontSize")),
        "savePath": str(note_path()),
    }


def font_size_value(value):
    if isinstance(value, bool) or not isinstance(value, (int, float, str)):
        return DEFAULT_FONT_SIZE
    try:
        size = int(value)
    except (TypeError, ValueError):
        return DEFAULT_FONT_SIZE
    if str(value).strip() != str(size) and not (isinstance(value, float) and value == size):
        return DEFAULT_FONT_SIZE
    if size < FONT_SIZE_MIN or size > FONT_SIZE_MAX:
        return DEFAULT_FONT_SIZE
    return size


def update_settings(**changes):
    with _settings_lock:
        data = read_settings_file()
        data.update(changes)
        write_settings_file(data)
    return True


def save_language(language):
    if language not in ("en", "zh"):
        return False
    return update_settings(language=language)


_installed_fonts = None
_installed_lock = threading.Lock()


def installed_font_names():
    return [item["name"] for item in installed_fonts()]


def installed_fonts():
    global _installed_fonts
    with _installed_lock:
        if _installed_fonts is None:
            _installed_fonts = _read_installed_fonts()
        return _installed_fonts


def _read_installed_fonts():
    import clr

    clr.AddReference("System.Drawing")
    from System.Drawing import Bitmap, Graphics
    from System.Drawing.Text import InstalledFontCollection
    from System.Globalization import CultureInfo

    gdi32 = ctypes.windll.gdi32
    gdi32.SelectObject.argtypes = [ctypes.c_void_p, ctypes.c_void_p]
    gdi32.SelectObject.restype = ctypes.c_void_p
    gdi32.DeleteObject.argtypes = [ctypes.c_void_p]
    gdi32.DeleteObject.restype = ctypes.c_bool
    gdi32.GetGlyphIndicesW.argtypes = [
        ctypes.c_void_p,
        ctypes.c_wchar_p,
        ctypes.c_int,
        ctypes.POINTER(ctypes.c_ushort),
        ctypes.c_uint,
    ]
    gdi32.GetGlyphIndicesW.restype = ctypes.c_uint
    chinese_locale = CultureInfo("zh-CN").LCID
    bitmap = Bitmap(1, 1)
    graphic = Graphics.FromImage(bitmap)
    hdc_ptr = graphic.GetHdc()
    hdc = ctypes.c_void_p(int(hdc_ptr.ToInt64()))
    collection = InstalledFontCollection()
    fonts = []
    seen = set()
    try:
        families = collection.Families
        for index in range(int(families.Length)):
            family = families[index]
            try:
                name = str(family.Name).strip()
                if not name or name in seen:
                    continue
                seen.add(name)
                localized = ""
                try:
                    localized = str(family.GetName(chinese_locale)).strip()
                except Exception:
                    localized = ""
                label = localized if _has_cjk(localized) else name
                fonts.append({
                    "name": name,
                    "label": label,
                    "chinese": _font_can_write_chinese(gdi32, hdc, name, localized),
                })
            finally:
                family.Dispose()
    finally:
        collection.Dispose()
        graphic.ReleaseHdc(hdc_ptr)
        graphic.Dispose()
        bitmap.Dispose()
    fonts.sort(key=lambda item: item["name"].casefold())
    return fonts


def _has_cjk(value):
    return any("\u3400" <= char <= "\u9fff" for char in value)


def _font_can_write_chinese(gdi32, hdc, name, localized):
    if _has_cjk(localized):
        return True
    from System.Drawing import Font

    try:
        font = Font(name, 12)
    except Exception:
        return False
    handle = font.ToHfont()
    previous = gdi32.SelectObject(hdc, ctypes.c_void_p(int(handle.ToInt64())))
    indices = (ctypes.c_ushort * 2)()
    try:
        found = gdi32.GetGlyphIndicesW(hdc, "中文", 2, indices, 1)
        return int(found) == 2 and indices[0] != 0xFFFF and indices[1] != 0xFFFF
    except Exception:
        return False
    finally:
        if previous:
            gdi32.SelectObject(hdc, previous)
        gdi32.DeleteObject(ctypes.c_void_p(int(handle.ToInt64())))
        font.Dispose()


def dialog_text(language):
    if language not in ("en", "zh"):
        language = load_settings()["language"]
    if language == "zh":
        return {"export": "导出存档", "import": "导入存档"}
    return {"export": "Export saves", "import": "Import saves"}


def pick_note_file(owner, title, save):
    from System.Windows.Forms import DialogResult, OpenFileDialog, SaveFileDialog

    dialog = SaveFileDialog() if save else OpenFileDialog()
    dialog.Title = title
    dialog.Filter = "JSON (*.json)|*.json"
    dialog.AddExtension = True
    dialog.DefaultExt = "json"
    if save:
        dialog.FileName = "week-note.json"
    result = dialog.ShowDialog(owner) if owner is not None else dialog.ShowDialog()
    if result != DialogResult.OK:
        return None
    return str(dialog.FileName)


def remember_window(window):
    """Read the frame on the UI thread and store it for the next launch."""
    form = window.native
    from System.Windows.Forms import FormWindowState

    scale = form._scale or 1
    maximized = form.WindowState == FormWindowState.Maximized
    if form.WindowState == FormWindowState.Normal:
        x, y = window.x, window.y
        width, height = window.width, window.height
    else:
        # Minimized and maximized forms report a standby rectangle in RestoreBounds.
        bounds = form.RestoreBounds
        x = int(bounds.X / scale)
        y = int(bounds.Y / scale)
        width = int(bounds.Width / scale)
        height = int(bounds.Height / scale)
    save_window(x, y, width, height, maximized)


ANCHOR_SIZE = 50
MOTION_MS = 220
ICON_PNG = ROOT / "icon.png"


def keep_on_screen(window):
    """Center the frame when a saved position is no longer on a connected display."""
    from System.Drawing import Rectangle
    from System.Windows.Forms import Screen

    form = window.native
    area = form.Bounds
    for screen in Screen.AllScreens:
        overlap = Rectangle.Intersect(area, screen.Bounds)
        if overlap.Width >= 80 and overlap.Height >= 80:
            return
    form.CenterToScreen()


def _hwnd(form):
    return int(form.Handle.ToInt64())


def _bind_anchor_api():
    user32 = ctypes.windll.user32
    gdi32 = ctypes.windll.gdi32
    kernel32 = ctypes.windll.kernel32
    user32.GetForegroundWindow.restype = ctypes.c_void_p
    user32.GetForegroundWindow.argtypes = []
    user32.SetForegroundWindow.argtypes = [ctypes.c_void_p]
    user32.SetForegroundWindow.restype = ctypes.c_bool
    user32.BringWindowToTop.argtypes = [ctypes.c_void_p]
    user32.BringWindowToTop.restype = ctypes.c_bool
    user32.ShowWindow.argtypes = [ctypes.c_void_p, ctypes.c_int]
    user32.ShowWindow.restype = ctypes.c_bool
    user32.SetWindowPos.argtypes = [
        ctypes.c_void_p,
        ctypes.c_void_p,
        ctypes.c_int,
        ctypes.c_int,
        ctypes.c_int,
        ctypes.c_int,
        ctypes.c_uint,
    ]
    user32.SetWindowPos.restype = ctypes.c_bool
    user32.GetWindowThreadProcessId.argtypes = [ctypes.c_void_p, ctypes.c_void_p]
    user32.GetWindowThreadProcessId.restype = ctypes.c_uint
    user32.AttachThreadInput.argtypes = [ctypes.c_uint, ctypes.c_uint, ctypes.c_bool]
    user32.AttachThreadInput.restype = ctypes.c_bool
    user32.UpdateLayeredWindow.argtypes = [
        ctypes.c_void_p,
        ctypes.c_void_p,
        ctypes.POINTER(_Point),
        ctypes.POINTER(_Size),
        ctypes.c_void_p,
        ctypes.POINTER(_Point),
        ctypes.c_uint32,
        ctypes.POINTER(_Blend),
        ctypes.c_uint32,
    ]
    user32.UpdateLayeredWindow.restype = ctypes.c_bool
    user32.GetDC.argtypes = [ctypes.c_void_p]
    user32.GetDC.restype = ctypes.c_void_p
    user32.ReleaseDC.argtypes = [ctypes.c_void_p, ctypes.c_void_p]
    user32.ReleaseDC.restype = ctypes.c_int
    user32.UnhookWinEvent.argtypes = [ctypes.c_void_p]
    user32.UnhookWinEvent.restype = ctypes.c_bool
    gdi32.CreateCompatibleDC.argtypes = [ctypes.c_void_p]
    gdi32.CreateCompatibleDC.restype = ctypes.c_void_p
    gdi32.CreateDIBSection.restype = ctypes.c_void_p
    gdi32.SelectObject.argtypes = [ctypes.c_void_p, ctypes.c_void_p]
    gdi32.SelectObject.restype = ctypes.c_void_p
    gdi32.DeleteObject.argtypes = [ctypes.c_void_p]
    gdi32.DeleteObject.restype = ctypes.c_bool
    gdi32.DeleteDC.argtypes = [ctypes.c_void_p]
    gdi32.DeleteDC.restype = ctypes.c_bool
    if ctypes.sizeof(ctypes.c_void_p) == 8:
        user32.GetWindowLongPtrW.argtypes = [ctypes.c_void_p, ctypes.c_int]
        user32.GetWindowLongPtrW.restype = ctypes.c_longlong
        user32.SetWindowLongPtrW.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_longlong]
        user32.SetWindowLongPtrW.restype = ctypes.c_longlong
        get_long = user32.GetWindowLongPtrW
        set_long = user32.SetWindowLongPtrW
    else:
        user32.GetWindowLongW.argtypes = [ctypes.c_void_p, ctypes.c_int]
        user32.GetWindowLongW.restype = ctypes.c_long
        user32.SetWindowLongW.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_long]
        user32.SetWindowLongW.restype = ctypes.c_long
        get_long = user32.GetWindowLongW
        set_long = user32.SetWindowLongW
    kernel32.GetCurrentThreadId.restype = ctypes.c_uint
    return user32, gdi32, kernel32, get_long, set_long


class _Point(ctypes.Structure):
    _fields_ = [("x", ctypes.c_long), ("y", ctypes.c_long)]


class _Size(ctypes.Structure):
    _fields_ = [("cx", ctypes.c_long), ("cy", ctypes.c_long)]


class _Blend(ctypes.Structure):
    _fields_ = [
        ("BlendOp", ctypes.c_ubyte),
        ("BlendFlags", ctypes.c_ubyte),
        ("SourceConstantAlpha", ctypes.c_ubyte),
        ("AlphaFormat", ctypes.c_ubyte),
    ]


class _BitmapInfo(ctypes.Structure):
    _fields_ = [
        ("biSize", ctypes.c_uint32),
        ("biWidth", ctypes.c_int32),
        ("biHeight", ctypes.c_int32),
        ("biPlanes", ctypes.c_uint16),
        ("biBitCount", ctypes.c_uint16),
        ("biCompression", ctypes.c_uint32),
        ("biSizeImage", ctypes.c_uint32),
        ("biXPelsPerMeter", ctypes.c_int32),
        ("biYPelsPerMeter", ctypes.c_int32),
        ("biClrUsed", ctypes.c_uint32),
        ("biClrImportant", ctypes.c_uint32),
    ]


def _note_is_front(form, user32):
    """True when the note, or the browser hosted inside it, is the foreground window."""
    from System.Windows.Forms import FormWindowState

    if form.WindowState == FormWindowState.Minimized:
        return False
    foreground = user32.GetForegroundWindow()
    if not foreground:
        return False
    user32.GetAncestor.argtypes = [ctypes.c_void_p, ctypes.c_uint]
    user32.GetAncestor.restype = ctypes.c_void_p
    root = user32.GetAncestor(foreground, 2) or foreground
    return int(root) == _hwnd(form)


def _note_form_type():
    from System.Windows.Forms import Form

    class NoteForm(Form):
        def get_ShowWithoutActivation(self):
            return True

    return NoteForm


def _clear_black(bitmap):
    """Drop the black field around the paper. Ink on the page stays."""
    from System.Drawing import Color

    width = bitmap.Width
    height = bitmap.Height
    pixels = []
    for y in range(height):
        row = []
        for x in range(width):
            color = bitmap.GetPixel(x, y)
            row.append((color.R, color.G, color.B, color.A))
        pixels.append(row)
    seen = bytearray(width * height)
    queue = []

    def consider(x, y):
        index = y * width + x
        if seen[index]:
            return
        red, _green, _blue, alpha = pixels[y][x]
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
        x, y = queue.pop()
        red, _green, _blue, _alpha = pixels[y][x]
        if red < 40:
            bitmap.SetPixel(x, y, Color.FromArgb(0, 0, 0, 0))
        else:
            bitmap.SetPixel(x, y, Color.FromArgb(int(red), 255, 235, 200))
        for next_x, next_y in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= next_x < width and 0 <= next_y < height:
                consider(next_x, next_y)


def _icon_bitmap():
    from System.Drawing import Bitmap, Graphics, Rectangle
    from System.Drawing.Drawing2D import InterpolationMode
    from System.Drawing.Imaging import PixelFormat

    source = Bitmap(str(ICON_PNG))
    try:
        canvas = Bitmap(ANCHOR_SIZE, ANCHOR_SIZE, PixelFormat.Format32bppPArgb)
        graphics = Graphics.FromImage(canvas)
        try:
            graphics.InterpolationMode = InterpolationMode.HighQualityBicubic
            graphics.DrawImage(source, Rectangle(0, 0, ANCHOR_SIZE, ANCHOR_SIZE))
        finally:
            graphics.Dispose()
        _clear_black(canvas)
        return canvas
    finally:
        source.Dispose()


def _clamp_anchor(x, y):
    from System.Drawing import Point
    from System.Windows.Forms import Screen

    screen = Screen.FromPoint(Point(int(x) + ANCHOR_SIZE // 2, int(y) + ANCHOR_SIZE // 2))
    area = screen.WorkingArea
    x = min(max(int(x), area.Left), area.Right - ANCHOR_SIZE)
    y = min(max(int(y), area.Top), area.Bottom - ANCHOR_SIZE)
    return x, y


def _paint_layered(form, bitmap, user32, gdi32):
    handle = ctypes.c_void_p(_hwnd(form))
    style = user32.GetWindowLongPtrW(handle, -20)
    user32.SetWindowLongPtrW(handle, -20, style | 0x00080000 | 0x00000080 | 0x08000000)
    width = bitmap.Width
    height = bitmap.Height
    info = _BitmapInfo()
    info.biSize = ctypes.sizeof(_BitmapInfo)
    info.biWidth = width
    info.biHeight = -height
    info.biPlanes = 1
    info.biBitCount = 32
    screen_dc = user32.GetDC(None)
    memory_dc = gdi32.CreateCompatibleDC(screen_dc)
    bits = ctypes.c_void_p()
    gdi32.CreateDIBSection.argtypes = [
        ctypes.c_void_p,
        ctypes.POINTER(_BitmapInfo),
        ctypes.c_uint,
        ctypes.POINTER(ctypes.c_void_p),
        ctypes.c_void_p,
        ctypes.c_uint,
    ]
    dib = gdi32.CreateDIBSection(memory_dc, ctypes.byref(info), 0, ctypes.byref(bits), None, 0)
    from System.Drawing import Rectangle
    from System.Drawing.Imaging import ImageLockMode, PixelFormat

    locked = bitmap.LockBits(
        Rectangle(0, 0, width, height),
        ImageLockMode.ReadOnly,
        PixelFormat.Format32bppPArgb,
    )
    try:
        row_bytes = width * 4
        source = locked.Scan0.ToInt64()
        stride = locked.Stride
        if stride < 0:
            source += (height - 1) * stride
            stride = -stride
        for row in range(height):
            ctypes.memmove(bits.value + row * row_bytes, source + row * stride, row_bytes)
    finally:
        bitmap.UnlockBits(locked)
    previous = gdi32.SelectObject(memory_dc, dib)
    origin = _Point(0, 0)
    destination = _Point(form.Left, form.Top)
    size = _Size(width, height)
    blend = _Blend(0, 0, 255, 1)
    painted = False
    try:
        painted = bool(
            user32.UpdateLayeredWindow(
                ctypes.c_void_p(_hwnd(form)),
                None,
                ctypes.byref(destination),
                ctypes.byref(size),
                ctypes.c_void_p(memory_dc),
                ctypes.byref(origin),
                0,
                ctypes.byref(blend),
                2,
            )
        )
    finally:
        if previous:
            gdi32.SelectObject(memory_dc, previous)
        if dib:
            gdi32.DeleteObject(dib)
        if memory_dc:
            gdi32.DeleteDC(memory_dc)
        if screen_dc:
            user32.ReleaseDC(None, screen_dc)
    return painted


def _ease(progress):
    progress = max(0.0, min(1.0, progress))
    return progress * progress * (3.0 - 2.0 * progress)


def _raise_window(form, user32, kernel32):
    from System.Windows.Forms import FormWindowState

    if form.WindowState == FormWindowState.Minimized:
        form.WindowState = FormWindowState.Normal
    if not form.Visible:
        form.Show()
    handle = ctypes.c_void_p(_hwnd(form))
    user32.ShowWindow(handle, 9)
    foreground = user32.GetForegroundWindow()
    foreground_thread = user32.GetWindowThreadProcessId(foreground, None) if foreground else 0
    this_thread = kernel32.GetCurrentThreadId()
    attached = False
    if foreground_thread and foreground_thread != this_thread:
        attached = bool(user32.AttachThreadInput(foreground_thread, this_thread, True))
    try:
        user32.BringWindowToTop(handle)
        user32.SetForegroundWindow(handle)
    finally:
        if attached:
            user32.AttachThreadInput(foreground_thread, this_thread, False)


class NoteAnchor:
    """A 50px note icon that stays above other windows while Week Note is not in front."""

    def __init__(self, window):
        self.window = window
        self.form = None
        self.bitmap = None
        self.hook = None
        self._callback = None
        self._user32 = None
        self._gdi32 = None
        self._kernel32 = None
        self._set_long = None
        self.timer = None
        self.bringing = False
        self.closed = False
        self.held = False
        self.anchor_pos = None
        self._press = None
        self._press_at = None
        self._moved = False
        self._motion = None
        self._home = None
        self.animating = False
        self._fitting = False
        self._saved_border = None
        self._saved_min = None
        self._saved_max = None

    def start(self):
        if self.closed or not ICON_PNG.is_file():
            return
        try:
            self._user32, self._gdi32, self._kernel32, get_long, self._set_long = _bind_anchor_api()
            self._get_long = get_long
            self.bitmap = _icon_bitmap()
            self.anchor_pos = load_anchor()
            self._create_form()
            self._watch_foreground()
            note = self.window.native
            note.Activated += self._on_note_active
            note.Deactivate += self._on_note_active
            from System.Windows.Forms import Timer

            self.timer = Timer()
            self.timer.Interval = 200
            self.timer.Tick += self._on_note_active
            self.timer.Start()
            self.window.native.Resize += self._on_note_resize
            self.sync()
        except Exception:
            self.stop()

    def stop(self):
        self.closed = True
        hook = self.hook
        self.hook = None
        if hook and self._user32 is not None:
            self._user32.UnhookWinEvent(hook)
        timer = self.timer
        self.timer = None
        if timer is not None:
            timer.Stop()
            timer.Dispose()
        self._stop_motion()
        form = self.form
        self.form = None
        if form is not None:
            form.Hide()
            form.Dispose()
        bitmap = self.bitmap
        self.bitmap = None
        if bitmap is not None:
            bitmap.Dispose()

    def sync(self):
        form = self.form
        note = self.window.native
        if self.closed or form is None or note is None or self.bringing or self.animating:
            return
        if form.InvokeRequired:
            from System import Action

            form.BeginInvoke(Action(self.sync))
            return
        if not self.held and _note_is_front(note, self._user32):
            if form.Visible:
                form.Hide()
            return
        self._ensure_position()
        if not form.IsHandleCreated:
            form.Handle
        if not form.Visible:
            self._user32.ShowWindow(ctypes.c_void_p(_hwnd(form)), 4)
        form.TopMost = True
        _paint_layered(form, self.bitmap, self._user32, self._gdi32)
        self._user32.SetWindowPos(
            ctypes.c_void_p(_hwnd(form)),
            ctypes.c_void_p(-1),
            0,
            0,
            0,
            0,
            0x0001 | 0x0002 | 0x0010 | 0x0040,
        )

    def _create_form(self):
        from System.Drawing import Size
        from System.Windows.Forms import AutoScaleMode, Cursors, FormBorderStyle, FormStartPosition

        form = _note_form_type()()
        form.AutoScaleMode = getattr(AutoScaleMode, "None")
        form.FormBorderStyle = getattr(FormBorderStyle, "None")
        form.ControlBox = False
        form.MaximizeBox = False
        form.MinimizeBox = False
        form.ShowInTaskbar = False
        form.TopMost = True
        form.StartPosition = FormStartPosition.Manual
        form.MinimumSize = Size(ANCHOR_SIZE, ANCHOR_SIZE)
        form.MaximumSize = Size(ANCHOR_SIZE, ANCHOR_SIZE)
        form.ClientSize = Size(ANCHOR_SIZE, ANCHOR_SIZE)
        form.Size = Size(ANCHOR_SIZE, ANCHOR_SIZE)
        form.Cursor = Cursors.SizeAll
        form.Text = "Week Note"
        form.HandleCreated += self._on_handle_created
        form.Shown += self._on_shown
        form.MouseDown += self._on_mouse_down
        form.MouseMove += self._on_mouse_move
        form.MouseUp += self._on_mouse_up
        self.form = form

    def _on_handle_created(self, sender, args):
        handle = ctypes.c_void_p(_hwnd(self.form))
        style = self._get_long(handle, -20)
        # Layered, tool window (no taskbar or Alt-Tab), and no activation when shown.
        self._set_long(handle, -20, style | 0x00080000 | 0x00000080 | 0x08000000)

    def _on_shown(self, sender, args):
        if self.bitmap is not None and self.form is not None:
            _paint_layered(self.form, self.bitmap, self._user32, self._gdi32)

    def reveal(self):
        if self.closed or self.form is None or self.bitmap is None:
            return
        form = self.form
        if form.InvokeRequired:
            from System import Action

            form.BeginInvoke(Action(self.reveal))
            return
        self._ensure_position()
        if not form.IsHandleCreated:
            form.Handle
        if not form.Visible:
            self._user32.ShowWindow(ctypes.c_void_p(_hwnd(form)), 4)
        form.TopMost = True
        _paint_layered(form, self.bitmap, self._user32, self._gdi32)
        self._user32.SetWindowPos(
            ctypes.c_void_p(_hwnd(form)),
            ctypes.c_void_p(-1),
            0,
            0,
            0,
            0,
            0x0001 | 0x0002 | 0x0010 | 0x0040,
        )

    def _on_mouse_down(self, sender, args):
        from System.Windows.Forms import Cursor, MouseButtons

        if args.Button != MouseButtons.Left or self.form is None:
            return
        self._press = Cursor.Position
        self._press_at = self.form.Location
        self._moved = False
        self.form.Capture = True

    def _on_mouse_move(self, sender, args):
        from System.Drawing import Point
        from System.Windows.Forms import Cursor

        if self._press is None or self.form is None:
            return
        pos = Cursor.Position
        dx = pos.X - self._press.X
        dy = pos.Y - self._press.Y
        if not self._moved and dx * dx + dy * dy < 16:
            return
        self._moved = True
        x, y = _clamp_anchor(self._press_at.X + dx, self._press_at.Y + dy)
        self.anchor_pos = (x, y)
        self.form.Location = Point(x, y)
        _paint_layered(self.form, self.bitmap, self._user32, self._gdi32)

    def _on_mouse_up(self, sender, args):
        if self._press is None:
            return
        moved = self._moved
        self._press = None
        self._press_at = None
        if self.form is not None:
            self.form.Capture = False
        if moved:
            if self.anchor_pos is not None:
                save_anchor(*self.anchor_pos)
            return
        self._on_click(sender, args)

    def _on_click(self, sender, args):
        if self.bringing or self.closed or self.animating:
            return
        self.expand_animated()

    def _icon_rect(self):
        self._ensure_position()
        point = self.form.Location
        return (int(point.X), int(point.Y), ANCHOR_SIZE, ANCHOR_SIZE)

    def _remember_note(self, note):
        from System.Windows.Forms import FormWindowState

        bounds = note.Bounds
        maximized = note.WindowState == FormWindowState.Maximized
        if maximized:
            restored = note.RestoreBounds
            self._home = (
                int(restored.X),
                int(restored.Y),
                int(restored.Width),
                int(restored.Height),
                True,
            )
        else:
            self._home = (
                int(bounds.X),
                int(bounds.Y),
                int(bounds.Width),
                int(bounds.Height),
                False,
            )
        return (int(bounds.X), int(bounds.Y), int(bounds.Width), int(bounds.Height))

    def _prepare_note(self, note):
        from System.Drawing import Size
        from System.Windows.Forms import FormBorderStyle

        if self._saved_border is None:
            self._saved_border = note.FormBorderStyle
            self._saved_min = note.MinimumSize
            self._saved_max = note.MaximumSize
        note.FormBorderStyle = getattr(FormBorderStyle, "None")
        note.MinimumSize = Size(1, 1)
        note.MaximumSize = Size(0, 0)

    def _restore_note_chrome(self, note):
        from System.Drawing import Size

        if self._saved_max is not None:
            note.MaximumSize = self._saved_max
        else:
            note.MaximumSize = Size(0, 0)
        if self._saved_min is not None:
            note.MinimumSize = self._saved_min
        else:
            note.MinimumSize = Size(MIN_WIDTH, MIN_HEIGHT)
        if self._saved_border is not None:
            note.FormBorderStyle = self._saved_border
        self._saved_border = None
        self._saved_min = None
        self._saved_max = None

    def _stop_motion(self):
        timer = self._motion
        self._motion = None
        if timer is None:
            return
        timer.Stop()
        timer.Dispose()

    def _place_note(self, note, rect):
        """Keep the growing window on top. The icon click does not activate the process."""
        if self._user32 is None:
            from System.Drawing import Rectangle

            note.Bounds = Rectangle(int(rect[0]), int(rect[1]), int(rect[2]), int(rect[3]))
            return
        self._user32.SetWindowPos(
            ctypes.c_void_p(_hwnd(note)),
            ctypes.c_void_p(-1),
            int(rect[0]),
            int(rect[1]),
            max(1, int(rect[2])),
            max(1, int(rect[3])),
            0x0040,
        )

    def _drop_topmost(self, note):
        note.TopMost = False
        if self._user32 is None:
            return
        # HWND_NOTOPMOST. SetWindowPos during the grow sets the topmost bit directly.
        self._user32.SetWindowPos(
            ctypes.c_void_p(_hwnd(note)),
            ctypes.c_void_p(-2),
            0,
            0,
            0,
            0,
            0x0001 | 0x0002 | 0x0010,
        )

    def _focus_note(self, note):
        if self._user32 is None or self._kernel32 is None:
            note.Activate()
            return
        user32 = self._user32
        kernel32 = self._kernel32
        handle = ctypes.c_void_p(_hwnd(note))
        foreground = user32.GetForegroundWindow()
        foreground_thread = user32.GetWindowThreadProcessId(foreground, None) if foreground else 0
        this_thread = kernel32.GetCurrentThreadId()
        attached = False
        if foreground_thread and foreground_thread != this_thread:
            attached = bool(user32.AttachThreadInput(foreground_thread, this_thread, True))
        try:
            user32.BringWindowToTop(handle)
            user32.SetForegroundWindow(handle)
        finally:
            if attached:
                user32.AttachThreadInput(foreground_thread, this_thread, False)

    def _animate(self, note, start, end, done):
        from System.Drawing import Rectangle, Size
        from System.Windows.Forms import Timer

        self._stop_motion()
        self.animating = True
        steps = 14
        state = {"i": 0}
        timer = Timer()
        timer.Interval = max(1, MOTION_MS // steps)

        def tick(sender, args):
            if self.closed:
                self._stop_motion()
                self.animating = False
                return
            state["i"] += 1
            progress = min(1.0, state["i"] / steps)
            eased = _ease(progress)
            x = int(round(start[0] + (end[0] - start[0]) * eased))
            y = int(round(start[1] + (end[1] - start[1]) * eased))
            width = max(1, int(round(start[2] + (end[2] - start[2]) * eased)))
            height = max(1, int(round(start[3] + (end[3] - start[3]) * eased)))
            try:
                note.MaximumSize = Size(0, 0)
                note.MinimumSize = Size(1, 1)
                note.MinimumSize = Size(width, height)
                note.MaximumSize = Size(width, height)
                note.Bounds = Rectangle(x, y, width, height)
            except Exception:
                pass
            if self.bringing:
                try:
                    self._place_note(note, (x, y, width, height))
                except Exception:
                    pass
            if progress < 1:
                return
            self._stop_motion()
            try:
                done()
            finally:
                self.animating = False

        self._motion = timer
        timer.Tick += tick
        timer.Start()

    def collapse_animated(self):
        note = self.window.native
        if note is None or self.form is None or self.animating or self.closed:
            return
        if note.InvokeRequired:
            from System import Action

            note.BeginInvoke(Action(self.collapse_animated))
            return
        from System.Drawing import Rectangle
        from System.Windows.Forms import FormWindowState

        self._fitting = True
        try:
            if note.WindowState == FormWindowState.Minimized:
                note.WindowState = FormWindowState.Normal
        finally:
            self._fitting = False
        if not note.Visible:
            self.held = True
            self.reveal()
            return
        self.held = True
        start = self._remember_note(note)
        end = self._icon_rect()
        if self.form.Visible:
            self.form.Hide()
        self._prepare_note(note)
        note.Bounds = Rectangle(*start)

        def done():
            note.Hide()
            self._drop_topmost(note)
            self._restore_note_chrome(note)
            if self._home is not None:
                x, y, width, height, _maximized = self._home
                note.Bounds = Rectangle(x, y, width, height)
            self.reveal()

        self._animate(note, start, end, done)

    def expand_animated(self):
        note = self.window.native
        if note is None or self.form is None or self.animating or self.closed:
            return
        if note.InvokeRequired:
            from System import Action

            note.BeginInvoke(Action(self.expand_animated))
            return
        from System.Drawing import Rectangle
        from System.Windows.Forms import FormWindowState

        self.bringing = True
        self.held = False
        start = self._icon_rect()
        if self._home is not None:
            end = self._home[:4]
            maximized = self._home[4]
        else:
            bounds = note.Bounds
            end = (int(bounds.X), int(bounds.Y), int(bounds.Width), int(bounds.Height))
            maximized = False
        if self.form.Visible:
            self.form.Hide()
        self._prepare_note(note)
        if note.WindowState == FormWindowState.Minimized:
            self._fitting = True
            try:
                note.WindowState = FormWindowState.Normal
            finally:
                self._fitting = False
        note.TopMost = True
        note.Bounds = Rectangle(*start)
        if not note.Visible:
            note.Show()
        self._place_note(note, start)
        self._focus_note(note)
        self._place_note(note, start)

        def done():
            from System.Drawing import Size

            note.MaximumSize = Size(0, 0)
            note.MinimumSize = Size(1, 1)
            note.Bounds = Rectangle(*end)
            self._restore_note_chrome(note)
            note.Bounds = Rectangle(*end)
            self._place_note(note, end)
            self._drop_topmost(note)
            note.Bounds = Rectangle(*end)
            _raise_window(note, self._user32, self._kernel32)
            if maximized:
                note.WindowState = FormWindowState.Maximized
            else:
                note.Bounds = Rectangle(*end)
            self.bringing = False

        self._animate(note, start, end, done)

    def _ensure_position(self):
        from System.Drawing import Point
        from System.Windows.Forms import Screen

        if self.anchor_pos is not None:
            x, y = _clamp_anchor(*self.anchor_pos)
            self.anchor_pos = (x, y)
            self.form.Location = Point(x, y)
            return
        area = Screen.FromHandle(self.window.native.Handle).WorkingArea
        margin = 16
        self.form.Location = Point(
            area.Right - ANCHOR_SIZE - margin,
            area.Bottom - ANCHOR_SIZE - margin,
        )

    def _watch_foreground(self):
        callback_type = ctypes.WINFUNCTYPE(
            None,
            ctypes.c_void_p,
            ctypes.c_uint,
            ctypes.c_void_p,
            ctypes.c_long,
            ctypes.c_long,
            ctypes.c_uint,
            ctypes.c_uint,
        )

        def on_foreground(hook, event, hwnd, id_object, id_child, thread, time):
            try:
                self.sync()
            except Exception:
                return

        self._callback = callback_type(on_foreground)
        self._user32.SetWinEventHook.restype = ctypes.c_void_p
        self._user32.SetWinEventHook.argtypes = [
            ctypes.c_uint,
            ctypes.c_uint,
            ctypes.c_void_p,
            callback_type,
            ctypes.c_uint,
            ctypes.c_uint,
            ctypes.c_uint,
        ]
        self.hook = self._user32.SetWinEventHook(3, 3, None, self._callback, 0, 0, 0)

    def _on_note_active(self, sender, args):
        self.sync()

    def _on_note_resize(self, sender, args):
        note = self.window.native
        if self._fitting or self.animating or self.closed or note is None or note.Disposing:
            return
        from System.Windows.Forms import FormWindowState

        if note.WindowState != FormWindowState.Minimized:
            return
        self._fitting = True
        try:
            note.WindowState = FormWindowState.Normal
        finally:
            self._fitting = False
        self.collapse_animated()


def main():
    os.chdir(ROOT)
    try:
        import ctypes

        ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID("Fatcat1015.WeekNote")
    except Exception:
        pass
    saved = load_window()
    api = Api()
    threading.Thread(target=installed_fonts, name="week-note-fonts", daemon=True).start()
    window = webview.create_window(
        "Week Note",
        str(UI),
        js_api=api,
        width=saved["width"] if saved else DEFAULT_WIDTH,
        height=saved["height"] if saved else DEFAULT_HEIGHT,
        x=saved["x"] if saved else None,
        y=saved["y"] if saved else None,
        maximized=bool(saved and saved["maximized"]),
        min_size=(MIN_WIDTH, MIN_HEIGHT),
        background_color="#F4F0E6",
        text_select=True,
    )

    anchor = NoteAnchor(window)
    api.attach(window, anchor)

    def before_show():
        try:
            keep_on_screen(window)
        except Exception:
            return

    def shown():
        note = window.native

        def launch():
            anchor.start()

        if note.InvokeRequired:
            from System import Action

            note.BeginInvoke(Action(launch))
        else:
            launch()

    def closing():
        anchor.stop()
        try:
            remember_window(window)
        except Exception:
            return

    window.events.before_show += before_show
    window.events.shown += shown
    window.events.closing += closing
    webview.start(icon=str(ICON) if ICON.is_file() else None)


if __name__ == "__main__":
    main()
