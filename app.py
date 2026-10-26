"""Week Note: a small desktop window for the current week."""

import json
import os
from pathlib import Path

import webview

ROOT = Path(__file__).resolve().parent
UI = ROOT / "ui" / "index.html"


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


def main():
    os.chdir(ROOT)
    window = webview.create_window(
        "Week Note",
        str(UI),
        js_api=Api(),
        width=400,
        height=700,
        min_size=(340, 480),
        background_color="#F4F0E6",
        text_select=True,
    )
    webview.start()


if __name__ == "__main__":
    main()
