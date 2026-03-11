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
      let row = cartTable.insertRow();
      let cell = row.insertCell();
      cell.innerHTML = c.mana;
      cell = row.insertCell();
      // Check if card is foil and replace *F* with foil tag
      let displayName = c.name;
      let isFoil = displayName.includes(' *F*');
      if (isFoil) {
        displayName = displayName.replace(' *F*', '');
        cell.innerHTML = `<a target=_blank href="https://www.tcgplayer.com/product/${c.id}?Language=English">${displayName}</a><span class="foilTag">Foil</span>`;
      } else {
        cell.innerHTML = `<a target=_blank href="https://www.tcgplayer.com/product/${c.id}?Language=English">${displayName}</a>`;
      }
      cell = row.insertCell();
      if(c.inCart)
        cell.innerHTML = '<svg class="inCartIcon" cardid="' + c.id + '" xmlns="http://www.w3.org/2000/svg" height="18px" width="18px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>';
      cell = row.insertCell();
      // Create action buttons cell
      cell.innerHTML = `
        <div class="cardActions">
          <button class="cardMenuBtn" cardid="${c.id}" title="Options">⋮</button>
          <button class="cardRemove" cardid="${c.id}" title="Remove">×</button>
        </div>
        <div class="cardMenuDropdown" id="menu-${c.id}" style="display: none;">
          <button class="menuToggleInCart" cardid="${c.id}">${c.inCart ? 'Remove TCGPlayer Cart Indicator' : 'Indicate as in TCGPlayer Cart'}</button>
          <button class="menuToggleFoil" cardid="${c.id}">${isFoil ? 'Change to Normal Print' : 'Change to Foil'}</button>
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
    
    var w = document.getElementsByClassName('menuToggleFoil'); //toggle foil listeners
    for(wc of w)
      wc.addEventListener('click', toggleFoil);
  });
}


function toggleMenu(e) {
  e.stopPropagation();
  var cardid = this.getAttribute('cardid');
  var menu = document.getElementById('menu-' + cardid);
  
  // Close all other menus
  document.querySelectorAll('.cardMenuDropdown').forEach(function(dropdown) {
    if (dropdown.id !== 'menu-' + cardid) {
      dropdown.style.display = 'none';
    }
  });
  
  // Toggle current menu
  menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}


function toggleInCart(e) {
  e.stopPropagation();
  var cardid = +this.getAttribute('cardid');
  var card = cards.find(c => c.id === cardid);
  if(card) {
    card.inCart = !card.inCart;
    browser.runtime.sendMessage({ 
      msgType: 'toggleInCart', 
      id: cardid 
    });
    // Re-render cart
    cartTable.innerHTML = '';
    getCards();
  }
}


function toggleFoil(e) {
  e.stopPropagation();
  var cardid = +this.getAttribute('cardid');
  var card = cards.find(c => c.id === cardid);
  if(card) {
    // Toggle foil status by adding or removing *F*
    var isFoil = card.name.includes(' *F*');
    card.name = isFoil ? card.name.replace(' *F*', '') : card.name + ' *F*';
    browser.runtime.sendMessage({ 
      msgType: 'updateCardName', 
      id: cardid,
      name: card.name
    });
    // Re-render cart
    cartTable.innerHTML = '';
    getCards();
  }
}


// Close dropdowns when clicking outside
document.addEventListener('click', function() {
  document.querySelectorAll('.cardMenuDropdown').forEach(function(dropdown) {
    dropdown.style.display = 'none';
  });
});


async function removeCard() {
  var id = +this.getAttribute('cardid');
  this.parentElement.parentElement.remove();
  await browser.runtime.sendMessage({ msgType: 'removeCard', id: id });
  cards = cards.filter(c => c.id !== id);
}


function showCart() {
  // Clear current display
  aggregation.innerHTML = '';
  cart.style.display = 'block';
  cartTable.innerHTML = ''; // Clear cart table
  refreshBtn.style.display = 'none';
  aggBtn.style.display = 'block';
  aggBtn.textContent = 'Aggregate Sellers';
  aggBtn.onclick = aggregate;
  
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
  aggBtn.style.display = 'none';
  aggregation.innerHTML = '';
  var count = 0, maxAggregation = 0, sellerTotals = [];

  // Check if we have enough cards for aggregation (minimum 3 available cards)
  var availableCards = cards.filter(c => !c.inCart);
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
    aggBtn.style.display = 'block';
    aggBtn.textContent = '← Back to Cart';
    aggBtn.onclick = showCart;
    return;
  }
  
  // Reset button text and function
  aggBtn.textContent = 'Aggregate Sellers';
  aggBtn.onclick = aggregate;

  for(card of cards) { //max aggregation & min cost
   if(card.inCart) continue;
    count += 1;
    let minCost = Number.MAX_VALUE;
    let maxCardsPerSeller = 1;
    for(s of sellers[card.sellerIdx]) {
      minCost = (s.price < minCost) ? s.price : minCost;
      let slr = sellerTotals.find((e) => e[0] === s.sellerId);
      if(slr) {
        slr[1] += 1;
        maxCardsPerSeller = (maxCardsPerSeller < slr[1]) ? slr[1] : maxCardsPerSeller;
      }
      else
        sellerTotals.push([s.sellerId, 1, s.sellerName, 0.0, s.sellerKey]); //magic numbers: maxAggregation, seller total package Price
    }
    maxAggregation = (maxAggregation < maxCardsPerSeller) ? maxCardsPerSeller : maxAggregation;
    card.minCost = (minCost === Number.MAX_VALUE) ? '-' : '$' + minCost;
  }

  maxAggregation = (maxAggregation < 3) ? 3 : maxAggregation; //omit sellers with 1 card

  sellerTotals = sellerTotals.filter(s => s[1] > maxAggregation - 2); //filter sellers

  for(card of cards) { //min cost shown & package total price
    if(card.inCart) continue;
    let minCost = Number.MAX_VALUE;
    for(s of sellerTotals) {
      let slr = sellers[card.sellerIdx].find((sel) => sel.sellerId === s[0]);
      if(!slr) continue;
      minCost = (slr.price < minCost) ? slr.price : minCost; //min cost shown
      s[3] += slr.price; //package total price
    }
    card.minCostShown = (minCost === Number.MAX_VALUE) ? '-' : '$' + minCost;
  }

  sellerTotals.sort((a, b) => {return ((b[1] - a[1]) || (a[3] - b[3]));}); //sort by num of cards, total package price

  for(s of sellerTotals) { //render loop. sellers
    let price, slrIdx, numInCart = 0, htmlStr = '';

    for(card of cards) { //loop cards per seller
      slrIdx = sellers[card.sellerIdx].findIndex((sel) => sel.sellerId === s[0]);
      if(slrIdx >= 0) numInCart += !!sellers[card.sellerIdx][slrIdx].inCart;
      if(card.inCart) continue;
      price = (slrIdx < 0) ? '-' : '$' + sellers[card.sellerIdx][slrIdx].price;
      // Remove *F* from card name for display
      let displayName = card.name.replace(' *F*', '');
      let foilTag = card.name.includes(' *F*') ? '<span class="foilTag">Foil</span>' : '';
      // Get quantity from seller data
      let quantity = slrIdx >= 0 ? sellers[card.sellerIdx][slrIdx].quantity : '-';
      if(price !== '-')
        htmlStr += `<tr><td>${displayName}${foilTag}</td><td>${card.minCost}</td><td>${card.minCostShown}</td><td>${price}</td><td>${quantity}</td><td><button class=addToCartX sellerIdx=${card.sellerIdx} sellerIdxIdx=${slrIdx} title="Add to Cart">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
        </button></td></tr>`;
      else
        htmlStr += '<tr><td>' + displayName + foilTag + '</td><td>-</td><td>-</td><td>-</td><td>-</td><td style="color:#999;">Unavailable</td></tr>';
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
            <th title="Available stock quantity">Qty</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>` + htmlStr + '</tbody></table>';
    
    aggregation.innerHTML += `<div class="sellerHeader accordian" id=${s[0]}><div class=sellerName>${s[2]} <a target=_blank href="https://shop.tcgplayer.com/sellerfeedback/${s[4]}"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg></a></div><div>${s[1]} / ${count}</div><div><svg xmlns="http://www.w3.org/2000/svg" height="12px" width="12px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg> ${numInCart}</div><div>$${s[3].toFixed(2)}</div><div><button class=addToCartA sellerIdx=${card.sellerIdx} sellerIdxIdx=${slrIdx}>Add All</button></div></div>` + tableHtml;
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
  var seller = sellers[sellerIdx][+elem.getAttribute('sellerIdxIdx')];
  var req = {sku: seller.productConditionId, sellerKey: seller.sellerKey, channelId: 0, requestedQuantity: 1, price: seller.price, isDirect: false, countryCode: "US"};

  var xhttp = new XMLHttpRequest();
  xhttp.onloadend = function() {
    semaphore -= 1;
    if(this.status === 200) {
      elem.parentElement.style.color = '#1d1';
      elem.parentElement.innerHTML = 'In Cart';
      refreshBtn.style.display = 'block';
      if(card) {
        card.inCart = true;
        seller.inCart = true;
        browser.runtime.sendMessage({ 
          msgType: 'addCardToCart', 
          id: card.id, 
          sellerIdx: sellerIdx, 
          sellerIdxIdx: +elem.getAttribute('sellerIdxIdx') 
        });
      }
    }
    else elem.style.color = '#F00';
  }

  xhttp.open('POST', 'https://mpgateway.tcgplayer.com/v1/cart/' + cartCookie + '/item/add', true);
  xhttp.setRequestHeader('Content-Type', 'application/json');
  xhttp.send(JSON.stringify(req));
  semaphore += 1;
  var card = cards.find(e => e.sellerIdx === sellerIdx);
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

// Initialize aggregate button event listener
aggBtn.onclick = aggregate;
