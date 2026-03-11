# Changelog

## Version 1.3.0 - Stock Quantity & UI Improvements (2026-03-10)

### New Features
- **Stock Quantity Display**: Added "Qty" column to aggregation tables showing available stock quantity from each seller
  - Displays the exact number of cards each seller has in stock
  - Helps users plan their purchases better
  - Shows "-" when a seller doesn't have a particular card
- **Icon Buttons**: Replaced "Add to Cart" text buttons with shopping cart icons
  - Saves space in the table layout
  - Cleaner, more modern visual appearance
  - Hover effects with subtle scale animation
- **Back Button**: Added back button (←) to navigate from aggregation page back to virtual cart
  - Appears only on aggregation page
  - Consistent styling with theme toggle button
  - Easy navigation between cart and aggregation views

### UI Improvements
- Icon buttons are 32x32px squares with shopping cart SVG icon
- Quantity column positioned between "Seller Price" and "Action" columns
- Icon buttons have hover scale effect (1.05x) and active press effect (0.95x)
- Updated column headers include tooltip for quantity column ("Available stock quantity")

---

## Version 1.2.0 - Card Action Dropdown Menu (2026-03-09)

### New Features
- **Card Action Dropdown Menu**: Added dropdown menu (⋮) for each card in virtual cart with options:
  - Toggle TCGPlayer cart indicator (without actually adding/removing from TCGplayer cart)
  - Toggle between Foil and Normal print versions
- **Improved Action Buttons**: Made remove (×) and menu (⋮) buttons square (32x32px) with proper spacing
- **Dynamic Menu Text**: Menu options change based on current state (e.g., "Indicate as in TCGPlayer Cart" vs "Remove TCGPlayer Cart Indicator")
- **Click-Outside to Close**: Dropdown menus close automatically when clicking outside

### UI Improvements
- Square action buttons for cleaner, modern look
- Hover effects on dropdown buttons with subtle color changes
- Dropdown menus positioned to the right of action buttons
- Consistent styling between light and dark modes

### Technical Changes
- Added `toggleInCart` message handler to backend (Chrome & Firefox)
- Added `updateCardName` message handler to backend (Chrome & Firefox)
- Added `toggleMenu()`, `toggleInCart()`, and `toggleFoil()` functions to popup scripts
- Added CSS for `.cardActions`, `.cardMenuBtn`, and `.cardMenuDropdown` classes
- Dropdown menus use absolute positioning with proper z-index for visibility

---

## Version 1.1.0 - UI Improvements & Bug Fixes (2026-03-09)

### New Features
- **Modern UI Design**: Complete visual overhaul with better spacing, modern colors, and improved contrast
- **Dark Mode Theme**: Added toggle button for light/dark mode themes with smooth transitions
- **Price Column Labels**: Added clear labels to price columns in aggregation view ("Min Price", "Min in List", "Seller Price")
- **Gradient Foil Tags**: Eye-catching gradient design for foil card indicators

### Bug Fixes
- Fixed "Add to Virtual Cart" button not visible on TCGplayer pages (button size increased from 8px to 14px)
- Fixed Chrome popup error when adding cards (added null check in aggregate3)
- Fixed Firefox content script event listeners not being reattached after page updates
- Fixed Firefox "Aggregate Sellers" button (added missing event listener initialization)
- Fixed cart table cell width (increased from 60px to 100px for better button display)

---

## Version 1.0.0 - Initial Release

### Features
- **Virtual Cart System**: Add cards from TCGplayer product pages to a virtual cart
- **Seller Aggregation**: Aggregates sellers across multiple cards to minimize shipping costs
- **Add to Real Cart**: Add cards directly to TCGplayer cart from aggregated seller results
- **Foil Support**: Track and aggregate foil versions of cards separately
- **Cross-Browser Support**: Available for both Chrome and Firefox browsers