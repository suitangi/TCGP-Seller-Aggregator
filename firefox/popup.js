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



function getCards() {
  browser.runtime.sendMessage({ msgType: 'getCards' }).then((result) => {
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
      if(c.inCart)
        cell.innerHTML = '<svg class="inCartIcon" cardid="' + c.id + '" data-is-foil="' + (c.isFoil ? 'true' : 'false') + '" xmlns="http://www.w3.org/2000/svg" height="18px" width="18px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>';
      cell = row.insertCell();
      // Create action buttons cell
      var menuId = 'menu-' + c.id + '-' + (c.isFoil ? 'foil' : 'normal');
      cell.innerHTML = `
        <div class="cardActions">
          <button class="cardMenuBtn" cardid="${c.id}" data-is-foil="${c.isFoil ? 'true' : 'false'}" data-menu-id="${menuId}" title="Options">⋮</button>
          <button class="cardRemove" cardid="${c.id}" data-is-foil="${c.isFoil ? 'true' : 'false'}" title="Remove">×</button>
        </div>
        <div class="cardMenuDropdown" id="${menuId}" style="display: none;">
          <button class="menuToggleInCart" cardid="${c.id}" data-is-foil="${c.isFoil ? 'true' : 'false'}">${c.inCart ? 'Remove TCGPlayer Cart Indicator' : 'Indicate as in TCGPlayer Cart'}</button>
        </div>
      `;
    }

    var x = document.getElementsByClassName('cardRemove'); //onClick listeners
    for(xc of x)
      xc.addEventListener('click', removeCard);
    
    var y = document.getElementsByClassName('cardMenuBtn'); //dropdown toggle listeners
    for(yc of y)
      yc.addEventListener('click', toggleMenu);
    
    var z = document.getElementsByClassName('menuToggleInCart'); //toggle in cart listeners
    for(zc of z)
      zc.addEventListener('click', toggleInCart);
    
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


// Close dropdowns when clicking outside
document.addEventListener('click', function() {
  document.querySelectorAll('.cardMenuDropdown').forEach(function(dropdown) {
    dropdown.style.display = 'none';
  });
});


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

  // Check if we have enough cards for aggregation (minimum 3 available cards)
  // Count based on quantity, not just card count
  var availableCards = cards.filter(c => !c.inCart);
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
    if(card.inCart) continue;
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
    if(card.inCart) continue;
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
      if(slrIdx >= 0) numInCart += !!sellers[card.sellerIdx][slrIdx].inCart;
      if(card.inCart) continue;
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
  var seller = sellers[sellerIdx][sellerIdxIdx];
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
        card.inCart = true;
        seller.inCart = true;
        browser.runtime.sendMessage({ 
          msgType: 'addCardToCart', 
          id: card.id, 
          isFoil: card.isFoil,
          sellerIdx: sellerIdx, 
          sellerIdxIdx: sellerIdxIdx 
        });
      }
    }
    else elem.style.color = '#F00';
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
  if(!(_sellers instanceof Event)) sellers = _sellers;
  
  // Show back button on optimization page
  backBtn.style.display = 'block';
  
  cart.style.display = 'none';
  refreshBtn.style.display = 'none';
  const buttonContainer = document.getElementById('buttonContainer');
  buttonContainer.style.display = 'none';
  aggregation.innerHTML = '';

  // Get cards that are not already in cart
  const availableCards = cards.filter(c => !c.inCart);
  
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
  
  // Create a list of card requests with quantities
  for (const card of availableCards) {
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
    
    for (let sellerIdx = 0; sellerIdx < cardSellers.length; sellerIdx++) {
      const seller = cardSellers[sellerIdx];
      if (seller.quantity > 0 && !seller.inCart) {
        sellerOptions.push({
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
        });
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
  
  while (uncoveredRequests.size > 0) {
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
    
    // Evaluate each seller
    for (const [sellerId, options] of sellerGroups.entries()) {
      // Find which uncovered requests this seller can fulfill
      const coveredRequestIndices = [];
      const sellerAssignments = [];
      
      for (const option of options) {
        for (const requestIdx of uncoveredRequests) {
          const request = cardRequests[requestIdx];
          if (request.cardId === option.cardRequest.cardId && 
              request.isFoil === option.cardRequest.isFoil &&
              request.requestIndex === option.cardRequest.requestIndex) {
            coveredRequestIndices.push(requestIdx);
            sellerAssignments.push({
              requestIndex: requestIdx,
              option: option
            });
            break; // Each option can only cover one request
          }
        }
      }
      
      if (coveredRequestIndices.length === 0) continue;
      
      // Calculate cost for this seller
      const subtotal = sellerAssignments.reduce((sum, assignment) => sum + assignment.option.price, 0);
      
      // Get shipping cost (use the first option's shipping info since it's per seller)
      let shippingCost = options[0].shippingPrice;
      const sellerShippingPrice = options[0].sellerShippingPrice;
      
      // Apply free shipping policy: if sellerShippingPrice is 0 and subtotal >= $5, shipping is free
      if (sellerShippingPrice === 0 && subtotal >= 5) {
        shippingCost = 0;
      }
      
      const totalCost = subtotal + shippingCost;
      const costEffectiveness = totalCost / coveredRequestIndices.length;
      
      if (costEffectiveness < bestCostEffectiveness) {
        bestCostEffectiveness = costEffectiveness;
        bestOption = {
          sellerId: sellerId,
          sellerName: options[0].sellerName,
          sellerKey: options[0].sellerKey,
          subtotal: subtotal,
          shippingCost: shippingCost,
          totalCost: totalCost,
          assignments: sellerAssignments
        };
        bestCoveredRequests = coveredRequestIndices;
      }
    }
    
    if (!bestOption) {
      return {
        success: false,
        message: "Cannot find sellers for some cards. Some cards may be out of stock."
      };
    }
    
    // Select this seller
    selectedSellers.set(bestOption.sellerId, bestOption);
    assignments.push(...bestOption.assignments);
    
    // Remove covered requests
    for (const requestIdx of bestCoveredRequests) {
      uncoveredRequests.delete(requestIdx);
    }
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
    
    // Group assignments by card to get quantities
    const cardQuantities = new Map();
    for (const assignment of sellerAssignments) {
      const key = `${assignment.option.cardRequest.cardId}_${assignment.option.cardRequest.isFoil}`;
      const cardInfo = assignment.option.cardRequest;
      
      if (!cardQuantities.has(key)) {
        cardQuantities.set(key, {
          card: cardInfo,
          quantity: 0,
          price: assignment.option.price,
          option: assignment.option
        });
      }
      cardQuantities.get(key).quantity++;
    }
    
    const cards = Array.from(cardQuantities.values());
    const subtotal = cards.reduce((sum, card) => sum + (card.price * card.quantity), 0);
    
    const sellerDetails_entry = {
      sellerId: sellerId,
      sellerName: sellerInfo.sellerName,
      sellerKey: sellerInfo.sellerKey,
      cards: cards,
      subtotal: subtotal,
      shippingCost: sellerInfo.shippingCost,
      totalCost: sellerInfo.totalCost
    };
    
    sellerDetails.push(sellerDetails_entry);
    grandTotal += sellerInfo.totalCost;
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
    
    for (const cardInfo of seller.cards) {
      const card = cardInfo.card;
      const option = cardInfo.option;
      
      // Use isFoil boolean for display
      let displayName = card.name;
      let foilTag = card.isFoil ? '<span class="foilTag">Foil</span>' : '';
      
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
    
    const tableHtml = `
      <table>
        <thead>
          <tr>
            <th>Card Name</th>
            <th>Price Each</th>
            <th>Quantity</th>
            <th>Total</th>
            <th>Action</th>
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
