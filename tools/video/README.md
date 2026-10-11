# Video Recording Tool for VaultRail Dashboard

This tool generates screen recordings of the live VaultRail dashboard using GitHub Actions and Playwright.

## Quick Start (GitHub Actions)

1. Go to: https://github.com/rann-xyz/vaultrail/actions
2. Select "Generate VaultRail Demo Video" workflow
3. Click "Run workflow"
4. Configure:
   - Duration: 120 (seconds)
   - Width: 1920
   - Height: 1080
5. Click "Run workflow"

Download the `vaultrail-dashboard-video` artifact when complete.

## Local Development

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
# Install dependencies
npm ci
npx playwright install chromium
npx playwright install-deps chromium
```

### Run Recording

```bash
# Default settings
npm run record

# Custom settings
DASHBOARD_URL=https://vaultrail-dashboard.vercel.app/ \
RECORDING_DURATION=120 \
RECORDING_WIDTH=1920 \
RECORDING_HEIGHT=1080 \
npm run record
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DASHBOARD_URL` | https://vaultrail-dashboard.vercel.app/ | Dashboard to record |
| `RECORDING_DURATION` | 120 | Duration in seconds |
| `RECORDING_WIDTH` | 1920 | Video width |
| `RECORDING_HEIGHT` | 1080 | Video height |
| `VERBOSE` | false | Enable verbose output |

## Output

- `dashboard-demo.mp4` - MP4 video file (H.264)
- `artifacts/` - Directory for GitHub Actions output

## Troubleshooting

### Browser not found

```bash
npx playwright install chromium
npx playwright install-deps chromium
```

### Recording is blank

1. Check DASHBOARD_URL is accessible
2. Increase RECORDING_DURATION
3. Check browser console for errors

### Video file empty

1. Increase timeout: `timeout 120 npm run record:ci`
2. Check browser can load the page

## Security Notes

- No secrets or tokens required
- Read-only repository access
- Artifacts expire after 30 days

## Disclaimer

This is a prototype dashboard. It is not connected to Solana, and on-chain transactions have not been demonstrated.