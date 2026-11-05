"""Week Note: a small desktop window for the current week."""

import json
import os
import sys
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

    def load_note(self):
        if not self._path.exists():
            return {"weeks": {}}
        try:
            data = json.loads(self._path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            self._broken = True
            return {"weeks": {}, "unreadable": True}
        if not isinstance(data, dict) or not isinstance(data.get("weeks"), dict):
            self._broken = True
            return {"weeks": {}, "unreadable": True}
        return {"weeks": data["weeks"]}

    def save_note(self, note):
        if self._broken:
            return {"ok": False, "error": "unreadable"}
        if not isinstance(note, dict) or not isinstance(note.get("weeks"), dict):
            return {"ok": False, "error": "invalid"}
        try:
            payload = json.dumps({"weeks": note["weeks"]}, ensure_ascii=False, indent=2)
        except (TypeError, ValueError):
            return {"ok": False, "error": "invalid"}
        self._path.parent.mkdir(parents=True, exist_ok=True)
        temporary = self._path.with_suffix(".json.tmp")
        temporary.write_text(payload, encoding="utf-8")
        temporary.replace(self._path)
        return {"ok": True}


def window_path():
    return note_path().with_name("window.json")


def load_window():
    path = window_path()
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        x = int(data["x"])
        y = int(data["y"])
        width = int(data["width"])
        height = int(data["height"])
    except (OSError, json.JSONDecodeError, KeyError, TypeError, ValueError):
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


def save_window(x, y, width, height, maximized):
    if width < MIN_WIDTH or height < MIN_HEIGHT:
        return
    path = window_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".json.tmp")
    temporary.write_text(
        json.dumps(
            {"x": x, "y": y, "width": width, "height": height, "maximized": bool(maximized)}
        ),
        encoding="utf-8",
    )
    temporary.replace(path)


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


def main():
    os.chdir(ROOT)
    try:
        import ctypes

        ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID("Fatcat1015.WeekNote")
    except Exception:
        pass
    saved = load_window()
    window = webview.create_window(
        "Week Note",
        str(UI),
        js_api=Api(),
        width=saved["width"] if saved else DEFAULT_WIDTH,
        height=saved["height"] if saved else DEFAULT_HEIGHT,
        x=saved["x"] if saved else None,
        y=saved["y"] if saved else None,
        maximized=bool(saved and saved["maximized"]),
        min_size=(MIN_WIDTH, MIN_HEIGHT),
        background_color="#F4F0E6",
        text_select=True,
    )

    def before_show():
        try:
            keep_on_screen(window)
        except Exception:
            return

    def closing():
        try:
            remember_window(window)
        except Exception:
            return

    window.events.before_show += before_show
    window.events.closing += closing
    webview.start(icon=str(ICON) if ICON.is_file() else None)


if __name__ == "__main__":
    main()
