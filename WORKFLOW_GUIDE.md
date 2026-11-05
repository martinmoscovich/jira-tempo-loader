# Tempo Loader - Workflow Guide

## 🎯 Quick Start

1. **Login** to your Jira account
2. **Follow the 5-step workflow** displayed on the left sidebar
3. **Each step validates** before moving to the next
4. **Upload to Tempo** with pause/resume control

---

## 📊 The 5-Step Workflow

```
┌─────────────────────────────────────────────────────────┐
│                    WORKFLOW OVERVIEW                     │
└─────────────────────────────────────────────────────────┘

Step 1: Data Entry
  ↓ Import or enter your time entries

Step 2: Validate Tickets
  ↓ Check all tickets exist in Jira

Step 3: Create Tickets (if needed)
  ↓ Create any missing tickets

Step 4: Validate Entries
  ↓ Final data quality check

Step 5: Export to Tempo
  ↓ Upload everything to Tempo

✅ COMPLETE!
```

---

## Step-by-Step Guide

### 📥 Step 1: Data Entry

**What you'll see:**
```
┌──────────────────────────────────────────┐
│  Entrada de Datos                        │
├──────────────────────────────────────────┤
│                                          │
│  [Paste] [Import] [Add Entry] [Copy]    │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │     Your Time Entries Table        │ │
│  │  Date | Start | End | Ticket       │ │
│  │  01/12  09:00  17:00  ABC-123      │ │
│  │  01/12  09:00  12:00  New Feature  │ │
│  └────────────────────────────────────┘ │
│                                          │
│            [Continue to Validate →]      │
└──────────────────────────────────────────┘
```

**Actions:**
- 📋 **Paste from Clipboard**: Copy from Excel/Sheets and paste
- 📊 **Import from Tempo**: Load existing Tempo data
- ➕ **Add Entry**: Create manual entry
- 📝 **Edit Inline**: Double-click any cell to edit

**Tips:**
- You can mix existing tickets (ABC-123) with new tickets (any text)
- The table auto-calculates duration
- Use Tab/Enter to navigate like Excel

---

### ✅ Step 2: Validate Tickets

**What you'll see:**
```
┌──────────────────────────────────────────┐
│  Validar Tickets                         │
├──────────────────────────────────────────┤
│                                          │
│  ┌────┐  ┌────┐  ┌────┐                │
│  │ 15 │  │  3 │  │ 18 │                │
│  └────┘  └────┘  └────┘                │
│  Existing  New    Total                 │
│                                          │
│      [Validate All Tickets]              │
│                                          │
│  Results:                                │
│  ✅ ABC-123 - Valid                     │
│  ✅ ABC-124 - Valid                     │
│  ⚠️  DEF - New project (needs tickets)  │
│                                          │
│  [← Back]        [Continue to Create →] │
└──────────────────────────────────────────┘
```

**What happens:**
- Checks if ticket numbers exist (ABC-123, XYZ-456)
- Validates project codes (ABC, XYZ, DEF)
- Groups new tickets by project
- Shows clear success/warning status

**Results:**
- ✅ **Green**: Ticket exists and is valid
- ⚠️ **Orange**: New ticket needs to be created
- ❌ **Red**: Invalid ticket or project (fix required)

---

### 🎫 Step 3: Create Tickets

**What you'll see:**
```
┌──────────────────────────────────────────┐
│  Crear Tickets Nuevos                    │
├──────────────────────────────────────────┤
│                                          │
│  Creating tickets... 2 of 3              │
│  ████████████░░░░░░░░ 66%               │
│                                          │
│  ▼ #1 ABC - Feature Implementation      │
│    ┌─────────────────────────────────┐  │
│    │ Title: Feature Implementation    │  │
│    │ Assignee: user@example.com      │  │
│    │ Status: Open                     │  │
│    │ Parent: ABC-100 (optional)      │  │
│    └─────────────────────────────────┘  │
│    Status: ✅ ABC-125 Created           │
│                                          │
│  ▶ #2 DEF - Bug fix                     │
│    Status: ⏸️ Pending                   │
│                                          │
│  [← Back]        [Create All Tickets →] │
└──────────────────────────────────────────┘
```

**Features:**
- 📝 **Accordion Forms**: Expand/collapse each ticket
- 🔗 **Link Entries**: Multiple entries can share one ticket
- 👤 **Assign**: Set assignee (defaults to you)
- 📊 **Set Status**: Open, In Progress, or Closed
- 🌳 **Parent Link**: Optional parent issue

**Progress:**
- ⏸️ **Pending**: Not configured yet
- ✅ **Ready**: Configured and ready to create
- 🎫 **Created**: Successfully created (shows ticket key)

**Tip:** If multiple entries have similar descriptions, they're auto-grouped!

---

### 🔍 Step 4: Validate Entries

**What you'll see:**
```
┌──────────────────────────────────────────┐
│  Validar Entradas                        │
├──────────────────────────────────────────┤
│                                          │
│  ┌────┐  ┌────┐  ┌────┐  ┌──────┐      │
│  │ 18 │  │  0 │  │  2 │  │ 45h  │      │
│  └────┘  └────┘  └────┘  └──────┘      │
│  Entries Errors Warnings  Time          │
│                                          │
│  ✅ All entries ready!                  │
│                                          │
│  Warnings (2):                           │
│  ⚠️  01/12 09:00-21:00 ABC-123          │
│      Duration very long: 12 hours       │
│  ⚠️  02/12 14:00-16:00 DEF-456          │
│      Overlap with another entry         │
│                                          │
│  [← Back]           [Continue to Export →]│
└──────────────────────────────────────────┘
```

**Validation Checks:**

**Errors (❌ Must Fix):**
- Missing ticket
- Missing start/end time
- Invalid date

**Warnings (⚠️ Can Continue):**
- Time overlaps
- Very long duration (>12h)
- Missing description

**Summary Cards:**
- 📊 Total Entries
- ❌ Errors Count
- ⚠️ Warnings Count
- ⏱️ Total Time

**What to do:**
- **Errors**: Go back and fix them
- **Warnings**: You can continue or go back to fix

---

### 🚀 Step 5: Export to Tempo

**What you'll see:**
```
┌──────────────────────────────────────────┐
│  Exportar a Tempo                        │
├──────────────────────────────────────────┤
│                                          │
│  ┌────┐  ┌────┐  ┌────┐  ┌──────┐      │
│  │ 18 │  │ 12 │  │  1 │  │ 45h  │      │
│  └────┘  └────┘  └────┘  └──────┘      │
│  Total   Success Errors   Time          │
│                                          │
│  Uploading... 12 of 18                   │
│  ████████████████░░░░░░░░ 66%           │
│  Elapsed: 2m 15s  |  Remaining: 1m 10s  │
│                                          │
│  ℹ️ Loading: ABC-123 - 01/12 09:00-17:00│
│                                          │
│  Failed Entries (1):                     │
│  ❌ DEF-456 - 02/12 14:00-16:00         │
│     Error: Worklog already exists       │
│                                          │
│  [Reset]    [⏸️ Pause]  or  [▶️ Resume] │
└──────────────────────────────────────────┘
```

**Controls:**
- ▶️ **Start Upload**: Begin uploading
- ⏸️ **Pause**: Temporarily stop (you can resume later)
- ▶️ **Resume**: Continue from where you paused
- 🔄 **Reset**: Clear all statuses and start over

**Progress Indicators:**
- 📊 **Progress Bar**: Visual upload progress
- ⏱️ **Time Elapsed**: How long it's been running
- 🎯 **Time Remaining**: Estimated time to complete
- 📍 **Current Entry**: Which entry is being uploaded now

**Entry Status Colors:**
- ⚪ **Idle**: Not started yet
- 🔵 **Uploading**: Currently being uploaded
- 🟢 **Success**: Successfully uploaded
- 🔴 **Error**: Failed (with error message)

**Error Handling:**
- Upload continues even if one entry fails
- All errors are listed at the bottom
- You can retry failed entries by resetting

---

## 🎨 Visual Guide to Status Indicators

### In the Table
```
┌─────────────────────────────────────────┐
│ Date    | Ticket  | Status              │
├─────────────────────────────────────────┤
│ 01/12   | ABC-123 | ✅ (green row)     │  Success
│ 01/12   | DEF-456 | 🔵 (blue row)      │  Uploading
│ 01/12   | XYZ-789 | ❌ (orange row)    │  Error
│ 01/12   | New     | ⚠️ (orange text)   │  New ticket
└─────────────────────────────────────────┘
```

### In the Sidebar
```
┌─────────────────────────────────┐
│ Flujo de Trabajo                │
│                                 │
│ Progress: Step 3 of 5           │
│ ████████████░░░░░░░░ 60%       │
│                                 │
│ ✅ ① Entrada de Datos          │
│     15 entradas                 │
│                                 │
│ ✅ ② Validar Tickets           │
│     12 válidos                  │
│                                 │
│ 🔵 ③ Crear Tickets ◄ NOW      │
│     3 nuevos                    │
│                                 │
│ ⚪ ④ Validar Entradas          │
│                                 │
│ ⚪ ⑤ Exportar a Tempo           │
└─────────────────────────────────┘
```

---

## ⌨️ Keyboard Tips

### In the Table (Step 1)
- **Tab/Shift+Tab**: Move between cells
- **Enter**: Edit cell
- **Escape**: Cancel edit
- **Ctrl+C**: Copy selected cells
- **Ctrl+V**: Paste data
- **Delete**: Delete selected rows

### Navigation
- **Enter**: Continue to next step (when enabled)
- **Click sidebar**: Jump to any completed step

---

## 🎯 Pro Tips

### Data Entry
1. **Use templates**: Copy a row and paste multiple times
2. **Bulk edit**: Select multiple cells and edit
3. **Quick dates**: Use the date picker for consistent formatting

### Ticket Creation
1. **Group similar work**: Entries with same description auto-group
2. **Link to existing**: Later tickets can link to earlier created ones
3. **Set parent**: Use parent issues for better organization

### Validation
1. **Fix errors first**: Warnings are OK, but fix errors
2. **Check overlaps**: Review time overlaps before uploading
3. **Total time**: Verify the total makes sense

### Export
1. **Pause if needed**: You can pause and come back later
2. **Don't refresh**: Keep the page open during upload
3. **Check errors**: Review failed entries and retry

---

## 🐛 Common Issues

### "Ticket doesn't exist"
**Solution**: Double-check the ticket number in Jira

### "Project not found"
**Solution**: Verify you have access to that project

### "Worklog already exists"
**Solution**: You may have already uploaded this entry

### "Overlap detected"
**Solution**: Check if you have two entries at the same time

### Upload stuck at 50%
**Solution**: Click Pause, then Resume

---

## 📊 Understanding the Dashboard

At each step, you'll see summary cards:

```
┌─────────────────────────────────────────────┐
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐   │
│  │  18  │  │  15  │  │   3  │  │  45h │   │
│  │Total │  │Valid │  │ New  │  │ Time │   │
│  └──────┘  └──────┘  └──────┘  └──────┘   │
└─────────────────────────────────────────────┘
```

These update in real-time as you progress!

---

## 🎉 Success!

When complete, you'll see:
```
┌─────────────────────────────────────────┐
│  ✅ ¡Proceso completado exitosamente!  │
│                                         │
│  18 entradas cargadas en Tempo         │
│  Total: 45h 30m                        │
│                                         │
│      [Ver Reporte en Tempo →]         │
└─────────────────────────────────────────┘
```

---

## Need Help?

- **Hover over elements** for tooltips
- **Check the sidebar** for current step progress
- **Review FEATURES.md** for detailed documentation
- **Look at error messages** - they tell you exactly what to fix

**Enjoy the best Tempo Loader ever!** 🚀
