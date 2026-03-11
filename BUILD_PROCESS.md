# Build Process Documentation

## Overview

This extension has a build process that generates browser-specific distributions from the `chrome/` and `firefox/` source directories.

## Build Structure

### Source Directories
- `chrome/` - Chrome-specific source code (Manifest V3)
- `firefox/` - Firefox-specific source code (Manifest V2)

### Output Directory
- `dist/` - Generated build outputs
  - `dist/chrome/` - Unpacked Chrome extension
  - `dist/firefox/` - Unpacked Firefox extension
  - `dist/chrome.zip` - Zipped Chrome extension for distribution
  - `dist/firefox.zip` - Zipped Firefox extension for distribution

## Build Commands

### Build All Browsers
```bash
npm run build
# or
node build.js
# or
node build.js all
```

### Build Single Browser
```bash
npm run build:chrome
# or
node build.js chrome

npm run build:firefox
# or
node build.js firefox
```

### Clean Build Directory
```bash
npm run clean
# or
node build.js clean
```

## Browser Differences

### Chrome (Manifest V3)
- Uses `chrome.*` APIs
- Uses async/await with fetch API
- Uses chrome.storage.local for persistence
- Background script is a service worker
- Uses host_permissions in manifest

### Firefox (Manifest V2)
- Uses `browser.*` APIs
- Uses XMLHttpRequest for API calls
- Uses in-memory storage (cards, sellers arrays)
- Background script is a persistent page
- Uses permissions in manifest
- Uses exportFunction in content script

### Shared Components
The following files are nearly identical between browsers (only API namespace differs):
- `popup.html` - Popup interface (100% identical)
- `popup.js` - Popup logic (identical except chrome/browser API)
- `content.js` - Content script (identical except chrome/browser API and exportFunction)
- `style.css` - Styling (100% identical)
- `icons/` - Icon files (100% identical)

### Browser-Specific Components
- `manifest.json` - Different versions (V2 vs V3) and structure
- `background.js` - Significantly different implementations due to API differences

## Development Workflow

1. Make changes to browser-specific source files in `chrome/` or `firefox/`
2. Run `npm run build` to generate distributions
3. Load `dist/chrome/` in Chrome (chrome://extensions -> Developer mode -> Load unpacked)
4. Load `dist/firefox/` in Firefox (about:debugging -> This Firefox -> Load Temporary Add-on)

## Distribution

For distribution:
- Upload `dist/chrome.zip` to Chrome Web Store
- Upload `dist/firefox.zip` to Firefox Add-ons (AMO)