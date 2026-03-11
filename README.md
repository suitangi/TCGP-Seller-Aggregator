# TCGP Seller Aggregator

A browser extension for Chrome and Firefox that identifies the fewest (non-direct) sellers needed to purchase all cards from TCGplayer.

## Features

- **Seller Aggregation**: Identifies the best combination of sellers to minimize shipping costs
- **Virtual Cart**: Add cards to a virtual cart while browsing TCGplayer
- **Price Comparison**: Compare prices across different sellers
- **Dark Mode**: Toggle between light and dark themes for comfortable viewing
- **Modern UI**: Clean, comfortable interface with improved spacing and contrast
- **Column Labels**: Clear labels for price columns (Min Price, Min in List, Seller Price)
- **Foil Tags**: Beautiful rainbow gradient tags for foil cards
- **Improved UX**: Larger, more prominent remove buttons positioned at the end of each row

## Project Structure

This project maintains browser-specific source code with a unified build process:

```
TCGP-Seller-Aggregator/
├── chrome/               # Chrome-specific source (Manifest V3)
│   ├── manifest.json
│   ├── background.js
│   ├── content.js
│   ├── popup.html
│   ├── popup.js
│   ├── style.css
│   └── icons/
├── firefox/              # Firefox-specific source (Manifest V2)
│   ├── manifest.json
│   ├── background.js
│   ├── content.js
│   ├── popup.html
│   ├── popup.js
│   ├── style.css
│   └── icons/
├── dist/                 # Build output (generated)
│   ├── chrome/           # Unpacked Chrome extension
│   ├── firefox/          # Unpacked Firefox extension
│   ├── chrome.zip        # Zipped Chrome extension
│   └── firefox.zip       # Zipped Firefox extension
├── build.js              # Build script
├── BUILD_PROCESS.md      # Build process documentation
├── CHANGES.md            # Summary of changes
├── package.json
└── README.md
```

Most files are identical between Chrome and Firefox (popup.html, popup.js, content.js, style.css, icons/), with only the API namespace differences (`chrome.` vs `browser.`). The manifest.json and background.js files are browser-specific due to fundamental differences between Manifest V2 (Firefox) and V3 (Chrome).

## Building

### Prerequisites

- Node.js (v12 or higher)

### Build Commands

```bash
# Build for both browsers
node build.js

# Build for Chrome only
node build.js chrome

# Build for Firefox only
node build.js firefox

# Clean build directory
node build.js clean
```

### Build Output

The build process creates browser-specific packages in the `dist/` directory:

- `dist/chrome/` - Unpacked Chrome extension
- `dist/firefox/` - Unpacked Firefox extension
- `dist/chrome.zip` - Zipped Chrome extension for distribution
- `dist/firefox.zip` - Zipped Firefox extension for distribution

Each build directory contains all necessary files for loading into the respective browser.

## Installation

### Chrome

1. Run `node build.js chrome` to build the extension
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked"
5. Select the `dist/chrome/` directory

### Firefox

1. Run `node build.js firefox` to build the extension
2. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on"
4. Select `dist/firefox/manifest.json`

## Usage

### Adding Cards to Virtual Cart

1. Browse to any TCGplayer product page
2. Click "Add to Virtual Cart" or "Foil" button to add the card to your virtual cart
3. The card will appear in the extension popup with a remove button (×)

### Viewing Seller Aggregation

1. Click the extension icon to open the popup
2. Click "Aggregate Sellers" to see seller recommendations
3. The extension will show sellers sorted by how many cards they have (more cards = better for shipping)
4. Each seller shows:
   - Seller name (clickable to view feedback)
   - Number of cards available from that seller
   - Number of cards already in your TCGplayer cart from that seller
   - Total price for all cards from that seller
5. Click "Add All" to add all cards from a seller to your cart, or add individual cards

### Managing Cards

- **Virtual Cart**: Click the × button to remove a card from your virtual cart
- **TCGplayer Cart**: If a card is already in your TCGplayer cart, you'll see a shopping cart icon 🛒. This is a visual indicator only - to remove items from your TCGplayer cart, visit the TCGplayer website directly
- **Refresh**: After adding cards to your cart, a "Refresh" button appears. Click it to reload the aggregation with updated cart status
- **Need More Cards**: If you have fewer than 3 cards, you'll see an informative message. Click "← Back to Cart" to return to your virtual cart view

### Understanding Price Columns

The aggregation page displays three price columns:

- **Min Price**: The absolute lowest price available for this card across all sellers
- **Min in List**: The lowest price among sellers in this aggregation (helps you compare within recommended sellers)
- **Seller Price**: The price from this specific seller

Hover over column headers for more details.

## Price Column Labels

The aggregation page now includes clear labels for the three price columns:

- **Min Price**: Minimum price across all sellers
- **Min in List**: Minimum price from sellers in this aggregation
- **Seller Price**: Price from this specific seller

Hover over each column header to see a tooltip with more information.

## UI Improvements

The extension has been redesigned with:

- **Modern Design**: Clean, contemporary aesthetic with gradient accents
- **Better Spacing**: Increased padding and margins for a more comfortable feel
- **Improved Contrast**: Better color contrast for improved readability
- **Responsive Layout**: Elements adapt smoothly to different content
- **Visual Hierarchy**: Clear visual separation between sections
- **Hover Effects**: Subtle animations for better user feedback

## Development

### Making Changes

1. Edit files in the `chrome/` or `firefox/` directories as needed
2. Run `npm run build` or `node build.js` to rebuild
3. Load the updated extension from `dist/chrome/` or `dist/firefox/`

### Browser-Specific Code

- **Chrome**: Uses `chrome.*` APIs, Manifest V3, async/await with fetch
- **Firefox**: Uses `browser.*` APIs, Manifest V2, XMLHttpRequest

For more details on the build process and browser differences, see [BUILD_PROCESS.md](BUILD_PROCESS.md).

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

See LICENSE file for details.

## Credits

Originally created by Ben Goriesky (Voldrix)