var cards, cartCookie, sellers, semaphore = 0;
getCards();

// Dark mode toggle
const themeToggle = document.getElementById('themeToggle');
const backBtn = document.getElementById('backBtn');
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark') {
  document.body.classList.add('dark-mode');
}

themeToggle.addEventListener('click', () => {
  document.body.classList.toggle('dark-mode');
  const isDark = document.body.classList.contains('dark-mode');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
});

backBtn.addEventListener('click', showCart);

// Hide back button initially (shown only on aggregation page)
backBtn.style.display = 'none';

browser.cookies.get({ url: 'https://www.tcgplayer.com', name: 'StoreCart_PRODUCTION' }).then((c) => {
  if(c) {
    cartCookie = c.value.substring(c.value.indexOf('CK=') + 3);
    cartCookie = cartCookie.split('&')[0];
  }
  else
    createAnonymousCart();
}, createAnonymousCart);

// Debug function to check storage directly
function debugStorage() {
  browser.storage.local.get(['cards', 'sellers']).then((result) => {
    console.log('Direct storage check - cards:', (result.cards || []).length);
    console.log('Direct storage check - sellers:', (result.sellers || []).length);
    console.log('Storage contents:', result);
  }).catch((error) => {
    console.error('Storage check error:', error);
  });
}

// Call debug function on popup load
debugStorage();

function getCards() {
  console.log('popup getCards() called');
  browser.runtime.sendMessage({ msgType: 'getCards' }).then((result) => {
    console.log('popup getCards() - received:', result, 'length:', (result || []).length);
    cards = result || [];
    for(c of cards) {
      // Initialize quantity if not set
      if (typeof c.quantity === 'undefined') {
        c.quantity = 1;
      }
      
      let row = cartTable.insertRow();
      let cell = row.insertCell();
      cell.innerHTML = c.mana;
      cell = row.insertCell();
      // Use isFoil boolean to display foil tag
      let displayName = c.name;
      if (c.isFoil) {
        cell.innerHTML = `<a target=_blank href="https://www.tcgplayer.com/product/${c.id}?Language=English">${displayName}</a><span class="foilTag">Foil</span>`;
      } else {
        cell.innerHTML = `<a target=_blank href="https://www.tcgplayer.com/product/${c.id}?Language=English">${displayName}</a>`;
      }
      cell = row.insertCell();
      // Add quantity controls between name and cart indicator
      cell.innerHTML = `
        <div class="quantityControls" data-card-id="${c.id}" data-is-foil="${c.isFoil ? 'true' : 'false'}">
          <button class="quantityBtn quantityDecrease" title="Decrease quantity">−</button>
          <input type="number" class="quantityInput quantityNumber" value="${c.quantity}" min="0" max="999">
          <button class="quantityBtn quantityIncrease" title="Increase quantity">+</button>
        </div>
      `;
      cell = row.insertCell();
      // Removed inCart indicator as requested
      cell = row.insertCell();
      // Create action buttons cell (dropdown menu commented out as requested)
      var menuId = 'menu-' + c.id + '-' + (c.isFoil ? 'foil' : 'normal');
      cell.innerHTML = `
        <div class="cardActions">
          <button class="cardRemove" cardid="${c.id}" data-is-foil="${c.isFoil ? 'true' : 'false'}" title="Remove">×</button>
        </div>
        <!--
        <div class="cardMenuDropdown" id="${menuId}" style="display: none;">
          <button class="menuToggleInCart" cardid="${c.id}" data-is-foil="${c.isFoil ? 'true' : 'false'}">${c.inCart ? 'Remove TCGPlayer Cart Indicator' : 'Indicate as in TCGPlayer Cart'}</button>
        </div>
        -->
      `;
    }

    var x = document.getElementsByClassName('cardRemove'); //onClick listeners
    for(xc of x)
      xc.addEventListener('click', removeCard);
    
    // Dropdown menu functionality commented out as requested
    /*
    var y = document.getElementsByClassName('cardMenuBtn'); //dropdown toggle listeners
    for(yc of y)
      yc.addEventListener('click', toggleMenu);
    
    var z = document.getElementsByClassName('menuToggleInCart'); //toggle in cart listeners
    for(zc of z)
      zc.addEventListener('click', toggleInCart);
    */
    
    // Add quantity control event listeners
    var decreaseBtns = document.getElementsByClassName('quantityDecrease');
    for(btn of decreaseBtns)
      btn.addEventListener('click', decreaseQuantity);
    
    var increaseBtns = document.getElementsByClassName('quantityIncrease');
    for(btn of increaseBtns)
      btn.addEventListener('click', increaseQuantity);
    
    var quantityInputs = document.getElementsByClassName('quantityNumber');
    for(input of quantityInputs)
      input.addEventListener('change', updateQuantityFromInput);
  });
}


// Dropdown menu functions commented out as requested
/*
function toggleMenu(e) {
  e.stopPropagation();
  var menuId = this.getAttribute('data-menu-id');
  var menu = document.getElementById(menuId);
  
  // Close all other menus
  document.querySelectorAll('.cardMenuDropdown').forEach(function(dropdown) {
    if (dropdown.id !== menuId) {
      dropdown.style.display = 'none';
    }
  });
  
  // Toggle current menu
  menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}
*/


/*
function toggleInCart(e) {
  e.stopPropagation();
  var cardid = +this.getAttribute('cardid');
  var isFoil = this.getAttribute('data-is-foil') === 'true';
  var card = cards.find(c => c.id === cardid && c.isFoil === isFoil);
  if(card) {
    card.inCart = !card.inCart;
    browser.runtime.sendMessage({ 
      msgType: 'toggleInCart', 
      id: cardid,
      isFoil: isFoil
    }).then(() => {
      // Re-render cart after storage is updated
      cartTable.innerHTML = '';
      getCards();
    });
  }
}
*/


/*
// Close dropdowns when clicking outside
document.addEventListener('click', function() {
  document.querySelectorAll('.cardMenuDropdown').forEach(function(dropdown) {
    dropdown.style.display = 'none';
  });
});
*/


function decreaseQuantity() {
  var controls = this.closest('.quantityControls');
  var cardId = +controls.getAttribute('data-card-id');
  var isFoil = controls.getAttribute('data-is-foil') === 'true';
  var input = controls.querySelector('.quantityNumber');
  var currentQuantity = parseInt(input.value);
  
  if (currentQuantity > 0) {
    var newQuantity = currentQuantity - 1;
    input.value = newQuantity;
    updateCardQuantity(cardId, isFoil, newQuantity);
  }
}


function increaseQuantity() {
  var controls = this.closest('.quantityControls');
  var cardId = +controls.getAttribute('data-card-id');
  var isFoil = controls.getAttribute('data-is-foil') === 'true';
  var input = controls.querySelector('.quantityNumber');
  var currentQuantity = parseInt(input.value);
  
  if (currentQuantity < 999) {
    var newQuantity = currentQuantity + 1;
    input.value = newQuantity;
    updateCardQuantity(cardId, isFoil, newQuantity);
  }
}


function updateQuantityFromInput() {
  var controls = this.closest('.quantityControls');
  var cardId = +controls.getAttribute('data-card-id');
  var isFoil = controls.getAttribute('data-is-foil') === 'true';
  var newQuantity = parseInt(this.value);
  
  // Validate input
  if (isNaN(newQuantity) || newQuantity < 0) {
    newQuantity = 0;
  } else if (newQuantity > 999) {
    newQuantity = 999;
  }
  
  this.value = newQuantity;
  updateCardQuantity(cardId, isFoil, newQuantity);
}


function updateCardQuantity(cardId, isFoil, quantity) {
  var card = cards.find(c => c.id === cardId && c.isFoil === isFoil);
  if (card) {
    card.quantity = quantity;
    // Remove card if quantity is 0
    if (quantity === 0) {
      browser.runtime.sendMessage({ msgType: 'removeCard', id: cardId, isFoil: isFoil }).then(() => {
        cards = cards.filter(c => !(c.id === cardId && c.isFoil === isFoil));
        cartTable.innerHTML = '';
        getCards();
      });
    } else {
      // Update quantity in storage
      browser.runtime.sendMessage({ 
        msgType: 'updateQuantity', 
        id: cardId, 
        isFoil: isFoil, 
        quantity: quantity 
      }).then(() => {
        // If we're on the aggregation page, re-run aggregation to reflect quantity changes
        if(cart.style.display === 'none' && aggBtn.style.display === 'none') {
          // Re-run aggregation with fresh data
          aggregate();
        }
      });
    }
  }
}


async function removeCard() {
  var id = +this.getAttribute('cardid');
  var isFoil = this.getAttribute('data-is-foil') === 'true';
  var card = cards.find(c => c.id === id && c.isFoil === isFoil);
  if(!card) return;
  
  await browser.runtime.sendMessage({ msgType: 'removeCard', id: id, isFoil: isFoil });
  cards = cards.filter(c => !(c.id === id && c.isFoil === isFoil));
  // Re-render cart to ensure consistent state
  cartTable.innerHTML = '';
  getCards();
}


function showCart() {
  // Clear current display
  aggregation.innerHTML = '';
  cart.style.display = 'block';
  cartTable.innerHTML = ''; // Clear cart table
  refreshBtn.style.display = 'none';
  const buttonContainer = document.getElementById('buttonContainer');
  buttonContainer.style.display = 'flex';
  aggBtn.textContent = 'Aggregate Sellers';
  aggBtn.onclick = aggregate;
  
  // Hide back button on cart page
  backBtn.style.display = 'none';
  
  // Re-render cart
  getCards();
}


function aggregate() {
  browser.runtime.sendMessage({ msgType: 'aggregate' }).then((result) => {
    sellers = result || [];
    aggregate3(sellers);
  });
}


function aggregate3(_sellers) {
  if(!(_sellers instanceof Event)) sellers = _sellers;

  // Show back button on aggregation page
  backBtn.style.display = 'block';
  
  cart.style.display = 'none';
  refreshBtn.style.display = 'none';
  const buttonContainer = document.getElementById('buttonContainer');
  buttonContainer.style.display = 'none';
  aggregation.innerHTML = '';
  var count = 0, maxAggregation = 0, sellerTotals = [];

  // Remove inCart filtering - show all cards
  var availableCards = cards;
  var totalQuantity = availableCards.reduce((sum, c) => sum + (c.quantity || 1), 0);
  
  if(availableCards.length < 3) {
    aggregation.innerHTML = `
      <div class="infoMessage">
        <span class="icon">📦</span>
        <strong>Need More Cards</strong>
        You have ${cards.length} card(s) in your virtual cart, but ${availableCards.length < 3 ? 'only ' + availableCards.length + ' card(s) are available for aggregation' : ''}.<br><br>
        Please add at least 3 cards to your virtual cart to see seller aggregation results.<br><br>
        The aggregation algorithm needs multiple cards to identify best combination of sellers that minimizes shipping costs. With fewer cards, each card is typically best purchased from different sellers, making aggregation unnecessary.
      </div>
    `;
    buttonContainer.style.display = 'flex';
    return;
  }
  
  // Reset button text and function
  aggBtn.textContent = 'Aggregate Sellers';
  aggBtn.onclick = aggregate;

  for(card of cards) { //max aggregation & min cost
    // Removed inCart check - show all cards
    count += (card.quantity || 1);
    let minCost = Number.MAX_VALUE;
    let maxCardsPerSeller = 1;
    for(s of sellers[card.sellerIdx]) {
      minCost = (s.price < minCost) ? s.price : minCost;
      // Only count up to available quantity, not needed quantity
      let availableCount = Math.min(card.quantity || 1, s.quantity);
      let slr = sellerTotals.find((e) => e[0] === s.sellerId);
      if(slr) {
        slr[1] += availableCount;
        maxCardsPerSeller = (maxCardsPerSeller < slr[1]) ? slr[1] : maxCardsPerSeller;
      }
      else
        sellerTotals.push([s.sellerId, availableCount, s.sellerName, 0.0, s.sellerKey]); //magic numbers: totalQuantity, seller total package Price
    }
    maxAggregation = (maxAggregation < maxCardsPerSeller) ? maxCardsPerSeller : maxAggregation;
    card.minCost = (minCost === Number.MAX_VALUE) ? '-' : '$' + minCost;
  }

  maxAggregation = (maxAggregation < 3) ? 3 : maxAggregation; //omit sellers with less than 3 cards

  sellerTotals = sellerTotals.filter(s => s[1] > maxAggregation - 2); //filter sellers

  for(card of cards) { //min cost shown & package total price
    // Removed inCart check - show all cards
    let minCost = Number.MAX_VALUE;
    for(s of sellerTotals) {
      let slr = sellers[card.sellerIdx].find((sel) => sel.sellerId === s[0]);
      if(!slr) continue;
      minCost = (slr.price < minCost) ? slr.price : minCost; //min cost shown
      // Only charge for available quantity, not needed quantity
      let availableCount = Math.min(card.quantity || 1, slr.quantity);
      s[3] += slr.price * availableCount; //package total price (multiply by available quantity)
    }
    card.minCostShown = (minCost === Number.MAX_VALUE) ? '-' : '$' + minCost;
  }

  // Calculate shipping cost for each seller (needed for sorting)
  for(s of sellerTotals) {
    let shippingCost = 0;
    let sellerShippingPrice = 0;
    for(card of cards) {
      if(card.inCart) continue;
      let slrIdx = sellers[card.sellerIdx].findIndex((sel) => sel.sellerId === s[0]);
      if(slrIdx >= 0) {
        shippingCost = sellers[card.sellerIdx][slrIdx].shippingPrice || 0;
        sellerShippingPrice = sellers[card.sellerIdx][slrIdx].sellerShippingPrice || 0;
        break;
      }
    }
    // Store shipping cost in s[5] for later use
    s[5] = shippingCost;
    s[6] = sellerShippingPrice; // Store sellerShippingPolicy for free shipping check
    
    // Check for free shipping policy: if sellerShippingPrice is 0 and subtotal >= $5, shipping is free
    if (sellerShippingPrice === 0 && s[3] >= 5) {
      s[5] = 0;
    }
  }

  // Sort by cards available/wanted ratio (descending), then by total with shipping (ascending)
  sellerTotals.sort((a, b) => {
    const ratioA = a[1] / count; // cards available / cards wanted
    const ratioB = b[1] / count;
    const ratioDiff = ratioB - ratioA;
    if (ratioDiff !== 0) return ratioDiff;
    // Sort by total with shipping (subtotal + potentially free shipping)
    const totalA = a[3] + a[5];
    const totalB = b[3] + b[5];
    return totalA - totalB;
  });

  for(s of sellerTotals) { //render loop. sellers
    let price, slrIdx, numInCart = 0, htmlStr = '';

    for(card of cards) { //loop cards per seller
      slrIdx = sellers[card.sellerIdx].findIndex((sel) => sel.sellerId === s[0]);
      // Removed inCart counting logic
      // Removed card inCart check - show all cards
      price = (slrIdx < 0) ? '-' : '$' + sellers[card.sellerIdx][slrIdx].price;
      // Use isFoil boolean for display
      let displayName = card.name;
      let foilTag = card.isFoil ? '<span class="foilTag">Foil</span>' : '';
      // Get quantity from seller data and check stock status
      let availableQuantity = slrIdx >= 0 ? sellers[card.sellerIdx][slrIdx].quantity : '-';
      let neededQuantity = card.quantity || 1;
      let stockStatus = '';
      
      if(price !== '-' && availableQuantity !== '-') {
        if(availableQuantity < neededQuantity) {
          stockStatus = `<span style="color: #dc3545; font-size: 11px; font-weight: 600;">(${availableQuantity}/${neededQuantity} in stock)</span>`;
        } else {
          stockStatus = `<span style="color: #28a745; font-size: 11px;">✓ ${availableQuantity} in stock</span>`;
        }
      }
      
      if(price !== '-')
        htmlStr += `<tr><td>${displayName}${foilTag}</td><td>${card.minCost}</td><td>${card.minCostShown}</td><td>${price}</td><td>${availableQuantity}</td><td>${stockStatus}</td><td><button class=addToCartX sellerIdx=${card.sellerIdx} sellerIdxIdx=${slrIdx} title="Add to Cart">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
        </button></td></tr>`;
      else
        htmlStr += '<tr><td>' + displayName + foilTag + '</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td style="color:#999;">Unavail.</td></tr>';
    }
    
    // Add column headers for price columns
    const tableHtml = `
      <table>
        <thead>
          <tr>
            <th>Card Name</th>
            <th title="Minimum price across all sellers">Min Price</th>
            <th title="Minimum price from sellers in this aggregation">Min in List</th>
            <th title="Price from this specific seller">Seller Price</th>
            <th title="Available stock quantity">Stock</th>
            <th title="Stock status">Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>` + htmlStr + '</tbody></table>';
    
    // Calculate shipping cost from first available listing for this seller
    let shippingCost = 0;
    let sellerShippingPrice = 0;
    for(card of cards) {
      if(card.inCart) continue;
      let slrIdx = sellers[card.sellerIdx].findIndex((sel) => sel.sellerId === s[0]);
      if(slrIdx >= 0) {
        shippingCost = sellers[card.sellerIdx][slrIdx].shippingPrice || 0;
        sellerShippingPrice = sellers[card.sellerIdx][slrIdx].sellerShippingPrice || 0;
        break;
      }
    }
    
    // Calculate subtotal and total
    const subtotal = s[3];
    
    // Check for free shipping policy: if sellerShippingPrice is 0 and subtotal >= $5, shipping is free
    if (sellerShippingPrice === 0 && subtotal >= 5) {
      shippingCost = 0;
    }
    
    const totalWithShipping = (subtotal + shippingCost).toFixed(2);
    
    // Build seller summary div with shipping breakdown
    const summaryHtml = `<div class="sellerSummary">
      <div class="summaryItemLeft">
        <span class="summaryLabel">Subtotal:</span> <span class="summaryValue">$${subtotal.toFixed(2)}</span>
      </div>
      <div class="summaryItemRight">
        <span class="summaryLabel">Shipping:</span> <span class="summaryValue">$${shippingCost.toFixed(2)}</span>
      </div>
    </div>`;
    
    aggregation.innerHTML += `<div class="sellerHeader accordian" id=${s[0]}><div class=sellerName>${s[2]} <a target=_blank href="https://shop.tcgplayer.com/sellerfeedback/${s[4]}"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg></a></div><div>${s[1]} / ${count}</div><div><svg xmlns="http://www.w3.org/2000/svg" height="12px" width="12px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg> ${numInCart}</div><div>$${totalWithShipping}</div><div><button class=addToCartA sellerIdx=${card.sellerIdx} sellerIdxIdx=${slrIdx}>Add All</button></div></div>` + summaryHtml + tableHtml;
  }


  var x = aggregation.getElementsByClassName('sellerHeader');  //onClick listeners
  if(x.length) x[0].classList.remove('accordian');
  for(xc of x)
    xc.addEventListener('click', e=>{e.target.classList.toggle('accordian'); e.target.parentElement.classList.toggle('accordian');});
  x = aggregation.getElementsByClassName('addToCartX'); //onClick listeners
  for(xc of x)
    xc.addEventListener('click', addToCart);
  x = aggregation.getElementsByClassName('addToCartA'); //onClick listeners
  for(xc of x)
    xc.addEventListener('click', addAllToCart);
}


function addAllToCart() {
  var tbl = this.parentElement.parentElement.nextElementSibling;
  this.parentElement.parentElement.classList.remove('accordian');
  var cardBtns = tbl.getElementsByClassName('addToCartX');
  for(cb of cardBtns)
    addToCart(cb, true);
}


function addToCart(btn, addAll=false) {
  var elem = btn.target || btn;
  var sellerIdx = +elem.getAttribute('sellerIdx');
  var sellerIdxIdx = +elem.getAttribute('sellerIdxIdx');
  
  console.log(`📦 AddToCart attempt: sellerIdx=${sellerIdx}, sellerIdxIdx=${sellerIdxIdx}`);
  console.log(`Sellers array length: ${sellers?.length}`);
  console.log(`Sellers[${sellerIdx}]:`, sellers?.[sellerIdx]);
  
  // DEBUG: Show complete sellers array structure to understand the gap pattern
  console.log('🔍 FULL SELLERS ARRAY ANALYSIS:');
  if (sellers) {
    sellers.forEach((sellerArray, idx) => {
      if (sellerArray !== undefined) {
        console.log(`  sellers[${idx}]: DEFINED (${sellerArray?.length || 0} entries)`);
      } else {
        console.log(`  sellers[${idx}]: UNDEFINED`);
      }
    });
  }
  
  // Enhanced error handling for seller validation
  if (isNaN(sellerIdx) || isNaN(sellerIdxIdx) || !sellers || !sellers[sellerIdx] || !sellers[sellerIdx][sellerIdxIdx]) {
    console.error('❌ Invalid seller data for addToCart:', {
      sellerIdx: sellerIdx,
      sellerIdxIdx: sellerIdxIdx,
      sellersLength: sellers?.length,
      sellerAtIndex: sellers?.[sellerIdx]
    });
    
    // Detailed debugging for sellers array structure
    if (sellers && sellers.length > 0) {
      console.log('🔍 Current sellers array structure:');
      sellers.forEach((sellerArray, idx) => {
        if (sellerArray && sellerArray.length > 0) {
          const firstSeller = sellerArray[0];
          console.log(`  sellers[${idx}]: ${sellerArray.length} sellers (first: ${firstSeller?.sellerName || 'unknown'})`);
        } else {
          console.log(`  sellers[${idx}]: EMPTY/UNDEFINED`);
        }
      });
      
      console.log(`🎯 Attempted to access: sellers[${sellerIdx}][${sellerIdxIdx}]`);
      if (sellers[sellerIdx]) {
        console.log(`  sellers[${sellerIdx}] exists with ${sellers[sellerIdx].length} sellers`);
        if (sellerIdxIdx >= sellers[sellerIdx].length) {
          console.log(`  ❌ sellerIdxIdx ${sellerIdxIdx} is out of bounds (max: ${sellers[sellerIdx].length - 1})`);
        }
      } else {
        console.log(`  ❌ sellers[${sellerIdx}] is undefined`);
      }
    }
    
    elem.style.color = '#F00';
    elem.innerHTML = 'Error';
    return;
  }
  
  var seller = sellers[sellerIdx][sellerIdxIdx];
  console.log(`✅ Found seller:`, seller.sellerName, seller.price);
  var req = {sku: seller.productConditionId, sellerKey: seller.sellerKey, channelId: 0, requestedQuantity: 1, price: seller.price, isDirect: false, countryCode: "US"};

  var xhttp = new XMLHttpRequest();
  xhttp.onloadend = function() {
    semaphore -= 1;
    if(this.status === 200) {
      elem.parentElement.style.color = '#1d1';
      elem.parentElement.innerHTML = 'In Cart';
      refreshBtn.style.display = 'block';
      // Find the card that has this seller
      var card = cards.find(e => e.sellerIdx === sellerIdx && sellers[sellerIdx][sellerIdxIdx].productConditionId === seller.productConditionId);
      if(card) {
        // Remove inCart functionality as requested
        // card.inCart = true;
        // seller.inCart = true;
        browser.runtime.sendMessage({ 
          msgType: 'addCardToCart', 
          id: card.id, 
          isFoil: card.isFoil,
          sellerIdx: sellerIdx, 
          sellerIdxIdx: sellerIdxIdx 
        });
      }
    }
    else {
      console.error('Failed to add to cart:', this.status, this.responseText);
      elem.style.color = '#F00';
    }
  }

  xhttp.open('POST', 'https://mpgateway.tcgplayer.com/v1/cart/' + cartCookie + '/item/add', true);
  xhttp.setRequestHeader('Content-Type', 'application/json');
  xhttp.send(JSON.stringify(req));
  semaphore += 1;
}


function createAnonymousCart() {
  var xhttp = new XMLHttpRequest();
  xhttp.onloadend = function() {
    if(this.status === 200) {
      var key = JSON.parse(this.responseText);
      cartCookie = key.results[0].cartKey;
      browser.cookies.set({
        url: 'https://www.tcgplayer.com/product/',
        domain: '.tcgplayer.com',
        name: 'StoreCart_PRODUCTION',
        value: 'CK=' + cartCookie + '&Ignore=false',
        path: '/'
      });
    }
    else console.log('Create Anonymous Cart Fail', this);
  }
  xhttp.open('POST', 'https://mpgateway.tcgplayer.com/v1/cart/create/anonymouscart', true);
  xhttp.send();
}


function handleError(message) {
  console.log('popup error', message);
}


// Set Cover Optimization Algorithm
function optimizeCart() {
  browser.runtime.sendMessage({ msgType: 'aggregate' }).then((result) => {
    sellers = result || [];
    optimizeCartWithSolvers(sellers);
  });
}


function optimizeCartWithSolvers(_sellers) {
  // console.log(`🔧 optimizeCartWithSolvers called with:`, {type: typeof _sellers, isArray: Array.isArray(_sellers), length: _sellers?.length});
  
  if(!(_sellers instanceof Event)) {
    sellers = _sellers;
    console.log(`✅ Assigned sellers from parameter:`, {type: typeof sellers, isArray: Array.isArray(sellers), length: sellers?.length});
  } else {
    console.log(`📝 Using existing sellers variable:`, {type: typeof sellers, isArray: Array.isArray(sellers), length: sellers?.length});
  }
  
  // Debug: Check initial sellers array state
  console.log(`🚀 Starting optimization with sellers array:`);
  console.log(`Total sellers array length: ${sellers?.length}`);
  sellers?.forEach((sellerArray, idx) => {
    if (sellerArray && sellerArray.length > 0) {
      console.log(`  sellers[${idx}]: ${sellerArray.length} sellers`);
    } else {
      console.log(`  sellers[${idx}]: EMPTY/UNDEFINED`);
    }
  });
  
  // Show back button on optimization page
  backBtn.style.display = 'block';
  
  cart.style.display = 'none';
  refreshBtn.style.display = 'none';
  const buttonContainer = document.getElementById('buttonContainer');
  buttonContainer.style.display = 'none';
  aggregation.innerHTML = '<div class="infoMessage"><span class="icon">🔄</span><strong>Optimizing...</strong><br>Finding the best seller combination for minimum cost.</div>';

  // Get all cards for optimization (removed inCart filtering)
  const availableCards = cards;
  
  console.log(`🃏 Cards for optimization: ${availableCards.length}`);
  console.log(`🔍 DEBUGGING: Current sellers array state:`);
  console.log(`sellers variable type: ${typeof sellers}, value:`, sellers);
  
  if (sellers && Array.isArray(sellers)) {
    sellers.forEach((sellerArray, idx) => {
      if (sellerArray && sellerArray.length > 0) {
        console.log(`  sellers[${idx}]: ${sellerArray.length} sellers (VALID)`);
      } else {
        console.log(`  sellers[${idx}]: NULL/EMPTY (INVALID)`);
      }
    });
  } else {
    console.error(`❌ SELLERS IS NOT A VALID ARRAY:`, {type: typeof sellers, value: sellers});
  }
  
  // CREATE INDEX MAPPING: Map card sellerIdx to actual valid seller indices
  const validSellerIndices = [];
  const indexMapping = new Map();
  
  if (sellers && Array.isArray(sellers)) {
    sellers.forEach((sellerArray, idx) => {
      if (sellerArray && sellerArray.length > 0) {
        validSellerIndices.push(idx);
      }
    });
    
    console.log(`🗺️ Valid seller indices found: [${validSellerIndices.join(', ')}]`);
    
    // Map card indices (0,1,2,3...) to valid seller indices (10,11,12,13...)
    validSellerIndices.forEach((validIdx, mappedIdx) => {
      indexMapping.set(mappedIdx, validIdx);
      console.log(`  Card sellerIdx ${mappedIdx} → sellers[${validIdx}]`);
    });
  }
  
  availableCards.forEach((card, idx) => {
    const mappedSellerIdx = indexMapping.get(card.sellerIdx);
    const hasValidSellers = sellers && Array.isArray(sellers) && mappedSellerIdx !== undefined && sellers[mappedSellerIdx] && sellers[mappedSellerIdx].length > 0;
    
    console.log(`  Card ${idx}: "${card.name}" (sellerIdx: ${card.sellerIdx} → ${mappedSellerIdx}) - ${hasValidSellers ? 'VALID' : 'INVALID SELLER'}`);
    
    if (!hasValidSellers) {
      console.warn(`    ⚠️ Card "${card.name}" has no mapping for sellerIdx ${card.sellerIdx}!`);
      if (sellers && Array.isArray(sellers) && card.sellerIdx < sellers.length) {
        console.log(`    sellers[${card.sellerIdx}] =`, sellers[card.sellerIdx]);
      }
    } else {
      // UPDATE the card's sellerIdx to use the mapped value
      console.log(`    🔄 Remapping card "${card.name}" from sellerIdx ${card.sellerIdx} to ${mappedSellerIdx}`);
      card.sellerIdx = mappedSellerIdx;
    }
  });
  
  if (availableCards.length < 1) {
    aggregation.innerHTML = `
      <div class="infoMessage">
        <span class="icon">✅</span>
        <strong>All Cards Already in Cart</strong>
        All your cards are already marked as in your TCGPlayer cart.<br><br>
        Add more cards to your virtual cart to see optimization results.
      </div>
    `;
    buttonContainer.style.display = 'flex';
    return;
  }
  
  // Run the set cover optimization
  const optimizationResult = solveSetCover(availableCards, sellers);
  
  if (!optimizationResult.success) {
    aggregation.innerHTML = `
      <div class="infoMessage">
        <span class="icon">❌</span>
        <strong>No Optimal Solution Found</strong>
        ${optimizationResult.message}<br><br>
        This could be due to insufficient stock or no available sellers for some cards.
      </div>
    `;
    buttonContainer.style.display = 'flex';
    return;
  }
  
  // Display the optimized results
  displayOptimizedResults(optimizationResult);
}


function solveSetCover(availableCards, sellers) {
  // Prepare the problem data
  const cardRequests = [];
  
  // CRITICAL FIX: Filter out cards that don't have valid seller data
  const validCards = availableCards.filter(card => {
    const hasValidSellerData = sellers[card.sellerIdx] && sellers[card.sellerIdx].length > 0;
    if (!hasValidSellerData) {
      console.warn(`⚠️ Skipping card "${card.name}" - no valid seller data at sellerIdx ${card.sellerIdx}`);
      console.log(`sellers[${card.sellerIdx}] =`, sellers[card.sellerIdx]);
    }
    return hasValidSellerData;
  });
  
  if (validCards.length === 0) {
    return { success: false, message: "No cards have valid seller data for optimization." };
  }
  
  if (validCards.length < availableCards.length) {
    console.log(`🔍 Optimization filtered: ${availableCards.length} → ${validCards.length} cards with valid seller data`);
  }
  
  // Create a list of card requests with quantities
  for (const card of validCards) {
    for (let i = 0; i < (card.quantity || 1); i++) {
      cardRequests.push({
        cardId: card.id,
        isFoil: card.isFoil,
        name: card.name,
        mana: card.mana,
        sellerIdx: card.sellerIdx,
        requestIndex: i
      });
    }
  }
  
  if (cardRequests.length === 0) {
    return { success: false, message: "No cards to optimize." };
  }
  
  // Get all available seller options for each card
  const sellerOptions = [];
  
  for (const request of cardRequests) {
    const cardSellers = sellers[request.sellerIdx] || [];
    
    console.log(`🔍 Processing card "${request.name}" with sellerIdx=${request.sellerIdx}:`);
    console.log(`  sellers[${request.sellerIdx}] = `, sellers[request.sellerIdx]);
    console.log(`  cardSellers length = ${cardSellers.length}`);
    
    if (cardSellers.length === 0) {
      console.warn(`⚠️ No sellers available for card "${request.name}" at sellerIdx ${request.sellerIdx}`);
      continue;  // Skip this card request entirely
    }
    
    for (let sellerIdx = 0; sellerIdx < cardSellers.length; sellerIdx++) {
      const seller = cardSellers[sellerIdx];
      if (seller.quantity > 0) {
        // Removed inCart check for seller options
        const optionToAdd = {
          sellerId: seller.sellerId,
          sellerName: seller.sellerName,
          sellerKey: seller.sellerKey,
          price: seller.price,
          shippingPrice: seller.shippingPrice || 0,
          sellerShippingPrice: seller.sellerShippingPrice || 0,
          cardRequest: request,
          originalSellerIdx: request.sellerIdx,
          originalSellerIdxIdx: sellerIdx,
          productConditionId: seller.productConditionId
        };
        
        console.log(`  ✅ Added seller option: ${seller.sellerName} for ${request.name} (originalSellerIdx=${request.sellerIdx}, originalSellerIdxIdx=${sellerIdx})`);
        
        // CRITICAL VALIDATION: Double-check that the assignment is valid
        if (!sellers[request.sellerIdx] || !sellers[request.sellerIdx][sellerIdx]) {
          console.error(`❌ CRITICAL ERROR: Adding option with invalid seller reference!`);
          console.error(`  sellers[${request.sellerIdx}] = `, sellers[request.sellerIdx]);
          console.error(`  sellers[${request.sellerIdx}][${sellerIdx}] = `, sellers[request.sellerIdx]?.[sellerIdx]);
        }
        
        sellerOptions.push(optionToAdd);
        
        // DEBUG: Track all options for Aberrant card specifically
        if (request.name.toLowerCase().includes('aberrant')) {
          console.log(`🔍 ABERRANT OPTION: ${seller.sellerName} - $${seller.price} + $${seller.shippingPrice || 0} shipping = $${(seller.price + (seller.shippingPrice || 0)).toFixed(2)} total`);
        }
      }
    }
  }
  
  if (sellerOptions.length === 0) {
    return { success: false, message: "No sellers available for these cards." };
  }
  
  // Use a greedy approach with cost-effectiveness heuristic
  const result = greedySetCoverSolver(cardRequests, sellerOptions);
  
  if (!result.success) {
    return result;
  }
  
  // Calculate final costs and shipping
  return calculateFinalCosts(result.solution);
}


function greedySetCoverSolver(cardRequests, sellerOptions) {
  const uncoveredRequests = new Set(cardRequests.map((_, idx) => idx));
  const selectedSellers = new Map(); // sellerId -> seller info
  const assignments = []; // Track which seller covers which card request
  const sellerStockUsed = new Map(); // Track how much stock each seller has used
  
  let iterations = 0;
  const maxIterations = cardRequests.length * 2; // Prevent infinite loops
  
  while (uncoveredRequests.size > 0 && iterations < maxIterations) {
    iterations++;
    let bestOption = null;
    let bestCostEffectiveness = Infinity;
    let bestCoveredRequests = [];
    
    // Group seller options by seller
    const sellerGroups = new Map();
    for (const option of sellerOptions) {
      if (!sellerGroups.has(option.sellerId)) {
        sellerGroups.set(option.sellerId, []);
      }
      sellerGroups.get(option.sellerId).push(option);
    }
    
    // Evaluate each seller with different card combinations
    for (const [sellerId, options] of sellerGroups.entries()) {
      // Group requests by card type to track stock properly
      const cardTypeGroups = new Map();
      for (const requestIdx of uncoveredRequests) {
        const request = cardRequests[requestIdx];
        const cardKey = `${request.cardId}_${request.isFoil ? 'foil' : 'normal'}`;
        
        if (!cardTypeGroups.has(cardKey)) {
          cardTypeGroups.set(cardKey, {
            requests: [],
            option: null
          });
        }
        cardTypeGroups.get(cardKey).requests.push({
          requestIdx: requestIdx,
          request: request
        });
      }

      // Find available card types for this seller
      const availableCardTypes = [];
      for (const [cardKey, cardGroup] of cardTypeGroups.entries()) {
        const option = options.find(opt => {
          const optKey = `${opt.cardRequest.cardId}_${opt.cardRequest.isFoil ? 'foil' : 'normal'}`;
          return optKey === cardKey;
        });
        
        if (!option) continue; // This seller doesn't have this card
        
        // Get available stock from the actual seller data
        const sellerData = sellers[option.originalSellerIdx][option.originalSellerIdxIdx];
        const totalStock = sellerData.quantity;
        
        // Calculate how much stock this seller has already used
        const stockKey = `${option.sellerId}_${cardKey}`;
        const stockAlreadyUsed = sellerStockUsed.get(stockKey) || 0;
        const availableStock = totalStock - stockAlreadyUsed;
        
        // console.log(`🔍 Stock check for ${cardKey} from Seller ${option.sellerId}:`);
        // console.log(`  Total stock: ${totalStock}, Used: ${stockAlreadyUsed}, Available: ${availableStock}`);
        // console.log(`  Requests needed: ${cardGroup.requests.length}`);
        
        const requestsToAssign = Math.min(cardGroup.requests.length, availableStock);
        // console.log(`  Assigning: ${requestsToAssign}`);
        
        // CRITICAL FIX: Don't allow assignment if no stock available
        if (availableStock <= 0) {
          // console.log(`  ❌ Seller ${option.sellerId} has no available stock for ${cardKey}`);
          continue; // Skip this seller for this card type
        }
        
        if (requestsToAssign > 0) {
          availableCardTypes.push({
            cardKey,
            cardGroup,
            option,
            stockKey,
            requestsToAssign,
            sellerData
          });
        }
      }

      if (availableCardTypes.length === 0) continue;

      // Consider each card type individually AND all combinations
      const combinationsToTry = [];
      
// For single card types
        for (const cardType of availableCardTypes) {
          combinationsToTry.push([cardType]);
          
          // DEBUG: Log single card evaluation for Aberrant
          if (cardType.option.cardRequest.name.toLowerCase().includes('aberrant')) {
            const seller = cardType.sellerData;
            const subtotal = cardType.option.price;
            let shippingCost = 0;
            if (!selectedSellers.has(cardType.option.sellerId)) {
              shippingCost = seller.shippingPrice || 0;
              if (seller.sellerShippingPrice === 0 && subtotal >= 5) {
                shippingCost = 0;
              }
            }
            const totalCost = subtotal + shippingCost;
            console.log(`🎯 ABERRANT SINGLE OPTION: ${cardType.option.sellerName} - $${subtotal} + $${shippingCost} shipping = $${totalCost.toFixed(2)} total`);
          }
      }
      
      // All available cards together (current behavior)
      if (availableCardTypes.length > 1) {
        combinationsToTry.push(availableCardTypes);
      }

      // Evaluate each combination
      for (const combination of combinationsToTry) {
        const coveredRequestIndices = [];
        const sellerAssignments = [];
        
        for (const cardType of combination) {
          for (let i = 0; i < cardType.requestsToAssign; i++) {
            const { requestIdx, request } = cardType.cardGroup.requests[i];
            coveredRequestIndices.push(requestIdx);
            sellerAssignments.push({
              requestIndex: requestIdx,
              option: cardType.option,
              stockKey: cardType.stockKey
            });
          }
        }
        
        // Calculate cost for this combination
        const subtotal = sellerAssignments.reduce((sum, assignment) => sum + assignment.option.price, 0);
        
        // Get shipping cost - but don't charge shipping if we're already buying from this seller
        const firstCardType = combination[0];
        let shippingCost = 0;
        
        // Only charge shipping if this seller is not already selected
        if (!selectedSellers.has(sellerId)) {
          shippingCost = firstCardType.sellerData.shippingPrice || 0;
          const sellerShippingPrice = firstCardType.sellerData.sellerShippingPrice || 0;
          
          // Apply free shipping policy: if sellerShippingPrice is 0 and subtotal >= $5, shipping is free
          if (sellerShippingPrice === 0 && subtotal >= 5) {
            shippingCost = 0;
          }
        }
        
        const totalCost = subtotal + shippingCost;
        const costEffectiveness = totalCost / coveredRequestIndices.length;
        
        // DEBUG: Log cost effectiveness calculation for Aberrant-containing combinations
        const hasAberrant = combination.some(c => c.option.cardRequest.name.toLowerCase().includes('aberrant'));
        if (hasAberrant) {
          console.log(`💰 ABERRANT COST EVAL: ${combination[0].option.sellerName} - CE: ${costEffectiveness.toFixed(2)} (total: $${totalCost.toFixed(2)}, cards: ${coveredRequestIndices.length})`);
          if (costEffectiveness < bestCostEffectiveness) {
            console.log(`  🏆 NEW BEST AVAILABLE for Aberrant: ${combination[0].option.sellerName} (CE: ${costEffectiveness.toFixed(2)}, previous best: ${bestCostEffectiveness === Infinity ? 'none' : bestCostEffectiveness.toFixed(2)})`);
          } else {
            console.log(`  ⚖️ Not better than current best (CE: ${costEffectiveness.toFixed(2)} vs ${bestCostEffectiveness.toFixed(2)})`);
          }
        }
        
        // CONSOLIDATION FIX: Prefer multi-card combinations that save total money
        // For multi-card combinations, check if they beat splitting the cards
        let adjustedCostEffectiveness = costEffectiveness;
        
        if (combination.length > 1) {
          // Multi-card combination: compare total cost vs splitting cards individually
          let bestIndividualTotal = 0;
          let allCardsAvailableIndividually = true;
          
          console.log(`\n🔍 Evaluating multi-card combination for Seller ${sellerId}:`);
          console.log(`  Multi-card total: $${totalCost.toFixed(2)} (${combination.map(c => c.cardKey).join('+')})`);
          
          for (const cardType of combination) {
            let bestIndividualCE = Infinity;
            
            console.log(`  Finding best individual option for ${cardType.cardKey}:`);
            
            // Find best individual option for this card type across ALL sellers
            for (const [otherSellerId, otherOptions] of sellerGroups.entries()) {
              const matchingOptions = otherOptions.filter(opt => {
                const optKey = `${opt.cardRequest.cardId}_${opt.cardRequest.isFoil ? 'foil' : 'normal'}`;
                return optKey === cardType.cardKey;
              });
              
              for (const option of matchingOptions) {
                const indivSubtotal = option.price;
                let indivShipping = 0;
                if (!selectedSellers.has(otherSellerId)) {
                  indivShipping = option.shippingPrice || 0;
                  if (option.sellerShippingPrice === 0 && indivSubtotal >= 5) {
                    indivShipping = 0;
                  }
                }
                const indivTotal = indivSubtotal + indivShipping;
                const indivCE = indivTotal;
                
                console.log(`    Seller ${otherSellerId}: $${indivTotal.toFixed(2)} (${option.price} + ${indivShipping} shipping)`);
                
                if (indivCE < bestIndividualCE) {
                  bestIndividualCE = indivCE;
                }
              }
            }
            
            if (bestIndividualCE === Infinity) {
              allCardsAvailableIndividually = false;
              break;
            }
            
            console.log(`    Best individual for ${cardType.cardKey}: $${bestIndividualCE.toFixed(2)}`);
            bestIndividualTotal += bestIndividualCE;
          }
          
          console.log(`  Split total: $${bestIndividualTotal.toFixed(2)}`);
          console.log(`  Consolidation saves: $${(bestIndividualTotal - totalCost).toFixed(2)}`);
          
          if (allCardsAvailableIndividually) {
            // If total cost of multi-card is better than splitting, give it priority
            if (totalCost < bestIndividualTotal) {
              // Multi-card saves money - FORCE it to be the best option by making CE extremely low
              const savings = bestIndividualTotal - totalCost;
              const cardList = combination.map(c => c.cardKey).join('+');
              console.log(`🎯 CONSOLIDATION SAVES $${savings.toFixed(2)}! Forcing selection (${cardList})`);
              adjustedCostEffectiveness = 0.001; // Force this to be the absolute best option
            } else {
              const cardList = combination.map(c => c.cardKey).join('+');
              console.log(`Multi-card ${cardList}: $${totalCost.toFixed(2)} vs split $${bestIndividualTotal.toFixed(2)} - no savings`);
            }
          }
        }
        
        const comboType = combination.length === 1 ? 'SINGLE' : 'MULTI';
        const cardList = combination.map(c => c.cardKey).join('+');
        
        if (adjustedCostEffectiveness < bestCostEffectiveness) {
          bestCostEffectiveness = adjustedCostEffectiveness;
          bestOption = {
            sellerId: sellerId,
            sellerName: combination[0].option.sellerName,
            sellerKey: combination[0].option.sellerKey,
            subtotal: subtotal,
            shippingCost: shippingCost,
            totalCost: totalCost,
            assignments: sellerAssignments,
            comboType: comboType,
            cardList: cardList
          };
          bestCoveredRequests = coveredRequestIndices;
        }
      }
    }
    
    if (!bestOption) {
      return {
        success: false,
        message: "Cannot find sellers for some cards. Some cards may be out of stock."
      };
    }
    
    // Select this seller and update stock usage tracking
        // CRITICAL FIX: Don't overwrite existing seller data, merge assignments properly
        if (selectedSellers.has(bestOption.sellerId)) {
          // Seller already exists, just keep the original seller data (especially shipping cost)
          // The calculateFinalCosts function will recalculate subtotals from all assignments
          // Don't try to manually merge subtotals here
        } else {
          // New seller, store normally
          selectedSellers.set(bestOption.sellerId, bestOption);
        }
        assignments.push(...bestOption.assignments);
    
    // Update stock tracking for this seller
    console.log(`📦 Updating stock usage for Seller ${bestOption.sellerId}:`);
    for (const assignment of bestOption.assignments) {
      if (assignment.stockKey) {
        const currentUsage = sellerStockUsed.get(assignment.stockKey) || 0;
        const newUsage = currentUsage + 1;
        sellerStockUsed.set(assignment.stockKey, newUsage);
        console.log(`  ${assignment.stockKey}: ${currentUsage} → ${newUsage}`);
        
        // VALIDATION: Ensure we never exceed actual stock
        const cardKey = assignment.stockKey.split(`${assignment.option.sellerId}_`)[1];
        const sellerData = sellers[assignment.option.originalSellerIdx][assignment.option.originalSellerIdxIdx];
        if (newUsage > sellerData.quantity) {
          console.error(`❌ STOCK OVERFLOW! Seller ${assignment.option.sellerId} assigned ${newUsage} of ${cardKey} but only has ${sellerData.quantity}`);
        }
      }
    }
    
    // Remove covered requests
    for (const requestIdx of bestCoveredRequests) {
      uncoveredRequests.delete(requestIdx);
    }
    
    // Additional safeguard: ensure we're making progress
    if (bestCoveredRequests.length === 0) {
      console.warn('No progress made in set cover iteration, breaking to prevent infinite loop');
      break;
    }
  }
  
  // Check if we successfully covered all requests
  if (uncoveredRequests.size > 0) {
    if (iterations >= maxIterations) {
      console.warn('Set cover algorithm reached maximum iterations, may not have optimal solution');
    }
    return {
      success: false,
      message: `Could not cover ${uncoveredRequests.size} card requests. Some cards may be out of stock or have no available sellers.`
    };
  }
  
  return {
    success: true,
    solution: {
      sellers: selectedSellers,
      assignments: assignments,
      cardRequests: cardRequests
    }
  };
}


function calculateFinalCosts(solution) {
  const { sellers, assignments, cardRequests } = solution;
  
  const sellerDetails = [];
  let grandTotal = 0;
  let totalShipping = 0;
  let totalSubtotal = 0;
  
  for (const [sellerId, sellerInfo] of sellers.entries()) {
    const sellerAssignments = assignments.filter(a => a.option.sellerId === sellerId);
    
    // CRITICAL FIX: Don't group by card - preserve each assignment individually to maintain correct seller indices
    const cardQuantities = new Map();
    
    for (const assignment of sellerAssignments) {
      const key = `${assignment.option.cardRequest.cardId}_${assignment.option.cardRequest.isFoil}_${assignment.option.originalSellerIdx}_${assignment.option.originalSellerIdxIdx}`;
      const cardInfo = assignment.option.cardRequest;
      
      console.log(`🔧 Processing assignment: ${cardInfo.name}, sellerId=${assignment.option.sellerId}, originalSellerIdx=${assignment.option.originalSellerIdx}, originalSellerIdxIdx=${assignment.option.originalSellerIdxIdx}`);
      
      if (!cardQuantities.has(key)) {
        cardQuantities.set(key, {
          card: cardInfo,
          quantity: 0,
          price: assignment.option.price,
          option: assignment.option  // This now preserves the correct seller indices
        });
      }
      cardQuantities.get(key).quantity++;
    }
    
    const cards = Array.from(cardQuantities.values());
    const subtotal = cards.reduce((sum, card) => sum + (card.price * card.quantity), 0);
    
    // Recalculate total cost from the actual subtotal + shipping
    const totalCost = subtotal + sellerInfo.shippingCost;
    
    const sellerDetails_entry = {
      sellerId: sellerId,
      sellerName: sellerInfo.sellerName,
      sellerKey: sellerInfo.sellerKey,
      cards: cards,
      subtotal: subtotal,
      shippingCost: sellerInfo.shippingCost,
      totalCost: totalCost
    };
    
    sellerDetails.push(sellerDetails_entry);
    grandTotal += totalCost;
    totalShipping += sellerInfo.shippingCost;
    totalSubtotal += subtotal;
  }
  
  return {
    success: true,
    sellers: sellerDetails,
    totals: {
      subtotal: totalSubtotal,
      shipping: totalShipping,
      total: grandTotal
    },
    assignments: assignments
  };
}


function displayOptimizedResults(optimizationResult) {
  const { sellers, totals } = optimizationResult;
  
  // Debug: Print current sellers array state at display time
  console.log(`🎯 Displaying optimization results. Current sellers array state:`);
  console.log(`Total sellers array length: ${window.sellers?.length}`);
  if (window.sellers) {
    window.sellers.forEach((sellerArray, idx) => {
      if (sellerArray && sellerArray.length > 0) {
        console.log(`  sellers[${idx}]: ${sellerArray.length} sellers`);
      } else {
        console.log(`  sellers[${idx}]: EMPTY/UNDEFINED`);
      }
    });
  }
  
  aggregation.innerHTML = `
    <div class="optimizedHeader">
      <h3>Optimized Cart - Minimum Cost Solution</h3>
      <div class="optimizedSummary">
        <div class="summaryRow">
          <span>Subtotal: $${totals.subtotal.toFixed(2)}</span>
          <span>Shipping: $${totals.shipping.toFixed(2)}</span>
          <span><strong>Total: $${totals.total.toFixed(2)}</strong></span>
        </div>
        <div class="summaryNote">This is the most cost-effective combination of sellers for all your cards</div>
      </div>
    </div>
  `;
  
  // Add styles for the new optimized header
  if (!document.getElementById('optimizedStyles')) {
    const style = document.createElement('style');
    style.id = 'optimizedStyles';
    style.textContent = `
      .optimizedHeader {
        margin: 16px;
        padding: 20px;
        background: linear-gradient(135deg, #48d0b0 0%, #2d8e5d 100%);
        color: white;
        border-radius: 12px;
        box-shadow: 0 4px 8px rgba(0,0,0,0.15);
      }
      
      .optimizedHeader h3 {
        margin: 0 0 16px 0;
        font-size: 18px;
        font-weight: 600;
      }
      
      .optimizedSummary .summaryRow {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
        font-size: 16px;
      }
      
      .optimizedSummary .summaryNote {
        font-size: 13px;
        opacity: 0.9;
        font-style: italic;
      }
      
      body.dark-mode .optimizedHeader {
        background: linear-gradient(135deg, #2d8e5d 0%, #1a5d3e 100%);
      }
    `;
    document.head.appendChild(style);
  }
  
  // Display each optimal seller
  for (const seller of sellers) {
    let htmlStr = '';
    
    console.log(`🏦 Displaying seller ${seller.sellerId} (${seller.sellerName}) with ${seller.cards.length} cards`);
    
    for (const cardInfo of seller.cards) {
      const card = cardInfo.card;
      const option = cardInfo.option;
      
      // Debug the option object structure
      console.log(`  Card: ${card.name}, originalSellerIdx=${option.originalSellerIdx}, originalSellerIdxIdx=${option.originalSellerIdxIdx}`);
      console.log(`  Full option object:`, option);
      
      // Validate the seller indices before using them
      if (option.originalSellerIdx === undefined || option.originalSellerIdxIdx === undefined) {
        console.error(`❌ Missing seller indices for card ${card.name}:`, {
          originalSellerIdx: option.originalSellerIdx,
          originalSellerIdxIdx: option.originalSellerIdxIdx,
          option: option
        });
      }
      
      // Use isFoil boolean for display
      let displayName = card.name;
      let foilTag = card.isFoil ? '<span class="foilTag">Foil</span>' : '';
      
      // CRITICAL FAILSAFE: Do not create buttons for invalid seller indices
      const isValidSellerRef = window.sellers && window.sellers[option.originalSellerIdx] && window.sellers[option.originalSellerIdx][option.originalSellerIdxIdx];
      
      if (!isValidSellerRef) {
        console.error(`❌ BLOCKING BUTTON CREATION: Invalid seller reference for "${card.name}"`);
        console.error(`  originalSellerIdx: ${option.originalSellerIdx}, originalSellerIdxIdx: ${option.originalSellerIdxIdx}`);
        console.error(`  sellers[${option.originalSellerIdx}]:`, window.sellers?.[option.originalSellerIdx]);
        console.error(`  sellers[${option.originalSellerIdx}][${option.originalSellerIdxIdx}]:`, window.sellers?.[option.originalSellerIdx]?.[option.originalSellerIdxIdx]);
        
        htmlStr += `<tr>
          <td>${displayName}${foilTag}</td>
          <td>$${option.price.toFixed(2)}</td>
          <td>${cardInfo.quantity}</td>
          <td>$${(option.price * cardInfo.quantity).toFixed(2)}</td>
          <td><span style="color: red; font-size: 12px;">Invalid Seller</span></td>
        </tr>`;
      } else {
        htmlStr += `<tr>
          <td>${displayName}${foilTag}</td>
          <td>$${option.price.toFixed(2)}</td>
          <td>${cardInfo.quantity}</td>
          <td>$${(option.price * cardInfo.quantity).toFixed(2)}</td>
          <td><button class=addToCartX sellerIdx=${option.originalSellerIdx} sellerIdxIdx=${option.originalSellerIdxIdx} title="Add to Cart">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
          </button></td>
        </tr>`;
      }
    }
    
    const tableHtml = `
      <table>
        <thead>
          <tr>
            <th>Card Name</th>
            <th>Price Each</th>
            <th>QTY.</th>
            <th>Total</th>
            <th></th>
          </tr>
        </thead>
        <tbody>${htmlStr}</tbody>
      </table>`;
    
    const summaryHtml = `<div class="sellerSummary">
      <div class="summaryItemLeft">
        <span class="summaryLabel">Subtotal:</span> <span class="summaryValue">$${seller.subtotal.toFixed(2)}</span>
      </div>
      <div class="summaryItemRight">
        <span class="summaryLabel">Shipping:</span> <span class="summaryValue">$${seller.shippingCost.toFixed(2)}</span>
      </div>
    </div>`;
    
    // Calculate card count
    const cardCount = seller.cards.reduce((sum, cardInfo) => sum + cardInfo.quantity, 0);
    const inCartCount = 0; // For optimized results, nothing is in cart yet
    
    aggregation.innerHTML += `<div class="sellerHeader accordian" id=${seller.sellerId}>
      <div class=sellerName>${seller.sellerName} 
        <a target=_blank href="https://shop.tcgplayer.com/sellerfeedback/${seller.sellerKey}">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
        </a>
      </div>
      <div>${cardCount} cards</div>
      <div>
        <svg xmlns="http://www.w3.org/2000/svg" height="12px" width="12px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg> 
        ${inCartCount}
      </div>
      <div>$${seller.totalCost.toFixed(2)}</div>
      <div><button class=addToCartA data-seller-cards='${JSON.stringify(seller.cards.map(c => ({sellerIdx: c.option.originalSellerIdx, sellerIdxIdx: c.option.originalSellerIdxIdx})))}'>Add All</button></div>
    </div>` + summaryHtml + tableHtml;
  }
  
  // Add event listeners for the add to cart buttons
  const sellerHeaders = aggregation.getElementsByClassName('sellerHeader');
  if(sellerHeaders.length) sellerHeaders[0].classList.remove('accordian');
  for(const header of sellerHeaders) {
    header.addEventListener('click', e => {
      e.target.classList.toggle('accordian'); 
      e.target.parentElement.classList.toggle('accordian');
    });
  }
  
  const addToCartButtons = aggregation.getElementsByClassName('addToCartX');
  for(const button of addToCartButtons) {
    button.addEventListener('click', addToCart);
  }
  
  const addAllButtons = aggregation.getElementsByClassName('addToCartA');
  for(const button of addAllButtons) {
    button.addEventListener('click', addAllOptimizedToCart);
  }
}


function addAllOptimizedToCart() {
  const sellerCards = JSON.parse(this.getAttribute('data-seller-cards'));
  this.parentElement.parentElement.classList.remove('accordian');
  
  for (const cardData of sellerCards) {
    const fakeButton = {
      target: {
        getAttribute: (attr) => {
          if (attr === 'sellerIdx') return cardData.sellerIdx;
          if (attr === 'sellerIdxIdx') return cardData.sellerIdxIdx;
          return null;
        },
        parentElement: this.parentElement
      }
    };
    addToCart(fakeButton, true);
  }
}


function showCartFromOptimized() {
  // Reset to cart view
  const buttonContainer = document.getElementById('buttonContainer');
  buttonContainer.style.display = 'flex';
  showCart();
}


// Initialize aggregate button event listener
aggBtn.onclick = aggregate;

// Add event listener for the new optimized cart button
const optimizedBtn = document.getElementById('optimizedBtn');
if (optimizedBtn) {
  optimizedBtn.onclick = optimizeCart;
}
