# Week Note

A small desktop window for the current week. Dates are filled in for you. Each day holds tasks, how long they cost, and a place to say why a task was skipped.

Notes are saved on this computer at `%APPDATA%\week-note\note.json`.

## Open it

Download the repository and double-click `Week Note.exe`. Python does not need to be installed.

WebView2 is already present on current Windows 10 and Windows 11. The window opens on this week, Monday through Sunday.

## Change the app

The executable is built from `app.py`. To rebuild it you need Python 3.14:

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt pyinstaller pillow
.\.venv\Scripts\python make_icon.py
.\.venv\Scripts\python -m PyInstaller --noconfirm --clean --distpath . --workpath build week-note.spec
```

## Use it

Type a deadline or a task for a day. Press Enter to start the next one. Drag a task to reorder it, or drop it on another day.

Once a task has text, you can set what it costs and mark what happened to it:

- **Time.** Hours, shown as `2 h` or `0.5 h`.
- **Tick.** Marks the task finished and strikes it through. The close mark hides until you click the tick again.
- **Close.** Marks the task skipped, turns it grey, and shows **Why this was skipped**. The tick hides until you click the close mark again.

The format buttons mark the selected text **bold**, *italic*, <u>underline</u>, or ~~strikethrough~~. The same marks are available with Ctrl+B, Ctrl+I, Ctrl+U, and Ctrl+Shift+X. Copying from the window keeps those four formats.

**Reminders**, at the top of the week, is one paragraph for every week. Open or close it with the heading. Editing it in any week changes it for the others.

The left arrow opens the previous week. The right arrow opens the next week, including weeks still ahead. What you type is saved on its own.

Hover the right side of a task or a deadline for the trash icon. Confirm deletes it. Cancel leaves it. Ctrl+Z puts it back.
