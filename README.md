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

Type a deadline or a task for a day. Press Enter to start the next one. Hover a task and drag the lines at its left to reorder it, or drop it on another day.

Once a task has text, you can set what it costs and mark what happened to it:

- **Time.** Hours, shown as `2 h` or `0.5 h`.
- **Tick.** Marks the task finished and strikes it through. The close mark hides until you click the tick again.
- **Close.** Marks the task skipped, turns it grey, and shows **Why this was skipped**. The tick hides until you click the close mark again.

The format buttons mark the selected text **bold**, *italic*, <u>underline</u>, or ~~strikethrough~~. The same marks are available with Ctrl+B, Ctrl+I, Ctrl+U, and Ctrl+Shift+X. Copying from the window keeps those four formats.

**Reminders**, at the top of the week, is one paragraph for every week. Open or close it with the heading. Editing it in any week changes it for the others.

The left arrow opens the previous week. The right arrow opens the next week, including weeks still ahead. What you type is saved on its own.

Hover the right side of a task or a deadline for the trash icon. Confirm deletes it. Cancel leaves it. Ctrl+Z puts it back.

## Buttons

- **Minimize**, the dash at the top left. Shrinks the window into the floating note. Click that note to open the window again. Drag the note to move it.
- **Previous week**, the left arrow. Opens the week before this one.
- **Next week**, the right arrow. Opens the following week, including weeks still ahead.
- **Settings**, the gear at the top right.
  - **Show in folder.** Opens the folder that holds the saved tasks.
  - **Export.** Copies the save to a JSON file you choose.
  - **Import.** Replaces the current tasks with a JSON save you choose.
  - **English** and **中文.** Switch the language. The choice stays on this computer. Chinese starts in 汇文明朝体. English starts in ELEGANT TYPEWRITER.
  - **Size.** The slider sets how large the note text is, from 10 to 24. It stays on this computer.
  - **Font.** Each language keeps its own font. Chinese starts in 汇文明朝体, and Chinese fonts are listed first under their Chinese names. English starts in ELEGANT TYPEWRITER. The list opens at once, then the installed fonts fill in. The search box filters the list as you type. Enter uses the first match.
  - **Default.** Restores English to ELEGANT TYPEWRITER and Chinese to 汇文明朝体.
  - **Close.** Closes settings.
- **B**, **I**, **U**, and **S.** Bold, italic, underline, and strikethrough for the selected text. Ctrl+B, Ctrl+I, Ctrl+U, and Ctrl+Shift+X do the same.
- **Reminders.** Opens or closes the paragraph shared by every week.
- **Drag**, the three lines at the left of a task. Drag them to change the order, or drop the task on another day. They appear when the pointer is on the task.
- **Done**, the tick. Marks the task finished and strikes it through. Click it again to clear that.
- **Skip**, the cross. Marks the task skipped, turns it grey, and shows **Why this was skipped**. Click it again to clear that.
- **Delete**, the trash can. **Cancel** leaves the task. **Confirm** deletes it. Ctrl+Z puts the last deleted task back.

## 中文

一个记下本周的小窗口。日期已经填好。每一天可以写任务、花费的时间，以及跳过某项任务的原因。

笔记保存在这台电脑的 `%APPDATA%\week-note\note.json`。

### 打开

下载这个仓库，双击 `Week Note.exe`。不需要另外安装 Python。

当前的 Windows 10 和 Windows 11 已经带有 WebView2。窗口打开后显示本周，从周一到周日。

### 重新构建

可执行文件由 `app.py` 构建。重新构建需要 Python 3.14：

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt pyinstaller pillow
.\.venv\Scripts\python make_icon.py
.\.venv\Scripts\python -m PyInstaller --noconfirm --clean --distpath . --workpath build week-note.spec
```

### 使用

在截止日期或某一天里写下任务。按 Enter 开始下一条。把指针放在任务上，拖左侧的三条线可以调整顺序，也可以拖到另一天。

任务有文字之后，可以记下耗时和结果：

- **时间。** 小时，显示为 `2 h` 或 `0.5 h`。
- **勾。** 标为完成，并加上删除线。叉号会先隐藏，再次点击勾之后才重新出现。
- **叉。** 标为跳过，文字变灰，并显示 **跳过的原因**。勾会先隐藏，再次点击叉之后才重新出现。

格式按钮可以把选中的文字标成 **粗体**、*斜体*、<u>下划线</u>或~~删除线~~。Ctrl+B、Ctrl+I、Ctrl+U 和 Ctrl+Shift+X 作用相同。从窗口里复制时，这四种格式会保留。

最上方的 **提醒** 是一段每周都在的文字。点击标题可以展开或收起。在任意一周里修改，其他周也会一起改变。

左箭头打开上一周。右箭头打开下一周，也包括还没到的周。输入的内容会自行保存。

把指针移到任务或截止日期右侧，会出现垃圾桶。确认后删除。取消则保留。Ctrl+Z 可以撤销上一次删除。

### 按钮

- **最小化**，左上角的横线。窗口会缩小成悬浮的笔记图标。点击那个图标可以重新打开窗口。拖动图标可以移动它。
- **上一周**，左箭头。打开这一周之前的一周。
- **下一周**，右箭头。打开后面的一周，也包括还没到的周。
- **设置**，右上角的齿轮。
  - **打开位置。** 打开保存任务的文件夹。
  - **导出。** 把存档复制到你选择的 JSON 文件。
  - **导入。** 用你选择的 JSON 存档替换当前任务。
  - **English** 和 **中文。** 切换语言。选择会留在这台电脑上。中文默认使用汇文明朝体。英文默认使用 ELEGANT TYPEWRITER。
  - **字号。** 滑块设置笔记文字大小，范围是 10 到 24。选择会留在这台电脑上。
  - **字体。** 每种语言各自记住字体。中文默认使用汇文明朝体，中文字体以中文名排在列表前面。英文默认使用 ELEGANT TYPEWRITER。列表会先打开，已安装的字体随后填入。搜索框会随输入筛选列表。按 Enter 使用第一个匹配项。
  - **默认。** 英文恢复为 ELEGANT TYPEWRITER，中文恢复为汇文明朝体。
  - **关闭。** 关闭设置。
- **B**、**I**、**U**、**S。** 把选中的文字设为粗体、斜体、下划线或删除线。Ctrl+B、Ctrl+I、Ctrl+U 和 Ctrl+Shift+X 作用相同。
- **提醒。** 展开或收起每周共用的那段文字。
- **拖动**，任务左侧的三条线。拖动它们可以调整顺序，或把任务放到另一天。指针放在任务上时才会出现。
- **完成**，勾。把任务标为完成并加上删除线。再点一次可以取消。
- **跳过**，叉。把任务标为跳过，文字变灰，并显示 **跳过的原因**。再点一次可以取消。
- **删除**，垃圾桶。**取消** 会留下任务。**确认** 会删除它。Ctrl+Z 可以恢复刚删除的任务。
