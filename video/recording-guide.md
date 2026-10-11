# Android Recording Guide

**Target:** VaultRail Dashboard Demo  
**Device:** Android with UserLAnd Ubuntu  
**Output:** 16:9 MP4 for YouTube/Loom

---

## Prerequisites

1. Chrome or Edge browser installed on Android
2. Loom app or screen recording permission enabled
3. Quiet recording environment
4. Headphone with microphone (optional but recommended)

---

## Method 1: Loom Mobile App (Recommended)

### Step 1: Install and Open Loom
1. Download "Loom - Video Screen Recorder" from Play Store
2. Open the app and sign in (Google/Email)
3. Tap "New Recording" → "Screen + Camera"

### Step 2: Configure Recording
1. Select "Chrome" or "Browser" from app list
2. Toggle "Record computer sound" OFF
3. Toggle "Microphone" ON (if available)
4. Tap "Start Recording"

### Step 3: Record the Demo
1. When prompted, tap "Start" in Chrome
2. Navigate to: https://vaultrail-dashboard.vercel.app/
3. Follow the demo sequence:
   - Show header (logo + "PROTOTYPE" badge)
   - Show notice banner
   - Scroll to timeline (3 milestones)
   - Scroll to ledger (4 transaction rows)
   - Click "Simulate Milestone 3 Approval"
   - Show updated status
   - Click "Reset Demo"
   - Show reset animation
4. Click "Stop" when finished

### Step 4: Save and Share
1. Preview the recording
2. Add title: "VaultRail Dashboard Demo - Hackathon"
3. Copy share link
4. Done

---

## Method 2: Chrome Built-in Capture

### Step 1: Prepare Chrome
1. Open Chrome → chrome://flags
2. Enable: "WebRTC screenshot capturing"
3. Restart Chrome

### Step 2: Record
1. Open Chrome developer tools (F12 or Menu → More tools → Developer tools)
2. Click the "three dots" menu in DevTools
3. Select "Capture screenshot"
4. Choose "Capture full size screenshot"
5. Save as PNG
6. Use external tool to create video from screenshots

---

## Method 3: Android Native Screen Record

### Step 1: Enable Developer Options (if not done)
1. Settings → About phone → Tap "Build number" 7 times
2. Settings → System → Developer options
3. Enable "Screen record"

### Step 2: Record
1. Press Volume Down + Power (hold 3 seconds)
2. Tap "Screen record"
3. Toggle "Show touches" ON
4. Toggle "Microphone" ON
5. Tap "Start recording"
6. Navigate to https://vaultrail-dashboard.vercel.app/
7. Complete demo sequence
8. Pull down notification shade → Stop recording
9. Video saved to Gallery/Files app

---

## Scene Sequence for Recording

**Duration:** 2-3 minutes total

| Time | Action | Notes |
|------|--------|-------|
| 0:00-0:10 | Load page | Show full header |
| 0:10-0:20 | Scroll down | Show notice banner |
| 0:20-0:35 | Show project info | Escrow VR-DEMO-001 |
| 0:35-0:55 | Timeline close-up | Milestone 1,2,3 animation |
| 0:55-1:20 | Ledger view | Highlight transaction table |
| 1:20-1:50 | Click "Simulate Milestone 3 Approval" | Show state change |
| 1:50-2:10 | Click "Reset Demo" | Show reset animation |
| 2:10-2:25 | Final view | Header + footer |
| 2:25-2:30 | Don't forget disclaimer | Verbal or on-screen |

---

## File Requirements

**MP4 Specifications:**
- Resolution: 1920x1080 (preferred) or 1280x720 minimum
- Frame rate: 30 fps
- Codec: H.264
- Audio: AAC 128kbps (if recorded)
- File size: Under 500MB for YouTube

**Naming Convention:**
```
vaultrail-demo-[date]-[time].mp4
Example: vaultrail-demo-20261011-1430.mp4
```

---

## Post-Processing (Optional)

### Trim Start/End
Use any video editor to remove:
- Loading time at start
- Black screen at end

### Add Text Overlay (if needed)
On Android you can:
1. Use CapCut app
2. Add "VaultRail Dashboard Demo" title
3. Add timestamp or duration

### Export Settings
- Format: MP4
- Quality: High
- Size: Original or optimized

---

## Troubleshooting

**Problem:** Screen recording disabled
**Solution:** Enable in Developer options or use Loom app

**Problem:** No audio recorded
**Solution:** Check microphone permission in app settings

**Problem:** Video too long
**Solution:** Use Loom's trimming feature before sharing

**Problem:** Controls not visible
**Solution:** Enable "Show touches" in developer options

---

## Platform-Specific Notes

**Loom:** Best quality, auto-upload, works everywhere
**OBS:** Highest quality, requires PC connection
**Built-in Android:** No audio, lower quality