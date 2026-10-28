# Week Note

A small desktop window for the current week. Dates are filled in for you. Each day holds tasks, how long they cost, and a place to say why a task was skipped.

Notes are saved on this computer at `%APPDATA%\week-note\note.json`.

## Install

You need Python 3 and the WebView2 runtime. WebView2 is already present on current Windows 10 and Windows 11.

```powershell
git clone https://github.com/Fatcat1015/Week-Notes.git
cd Week-Notes
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
```

## Open it

Double-click `week-note.bat`.

Or start it from the project folder:

```powershell
.\.venv\Scripts\python app.py
```

The window opens on this week, Monday through Sunday.

## Use it

Type a deadline or a task for a day. Press Enter to start the next one.

Once a task has text, you can set what it costs and mark what happened to it:

- **Time.** Hours and minutes, shown as `2 h / 30 m`. Minutes stop at 59.
- **Done.** Strikes the task through. Click Done again to reopen it.
- **Skip.** Turns the task grey and shows **Why this was skipped**.

The format buttons mark the selected text **bold**, *italic*, <u>underline</u>, or ~~strikethrough~~. The same marks are available with Ctrl+B, Ctrl+I, Ctrl+U, and Ctrl+Shift+X. Copying from the window keeps those four formats.

The left arrow opens the previous week. The right arrow returns toward this week and stays off while you are already here. What you type is saved on its own.
