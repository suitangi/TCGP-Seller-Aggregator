var btnBox, id, path, timerId;
var div = document.createElement("div");
var operationInProgress = false;
loadCheck();
browser.runtime.onMessage.addListener(loadCheck);


function loadCheck() {
  path = window.location.pathname.split('/');
  if(path[1] !== 'product')
    return;
  btnBox = document.getElementsByClassName('spotlight')[0];
  if(!btnBox) {
    clearTimeout(timerId);
    timerId = setTimeout(loadCheck, 30);
  }
  else {
    id = path[2];
    queryCard();
  }
}


function addCard(isFoil) {
  var cardName = document.getElementsByClassName('product-details__name')[0].innerText.split('-')[0].trim();
  var manaCost = document.getElementsByClassName('casting-cost__mana')[0];
  var manaStr = '';
  if(manaCost) {
    var mana = manaCost.getElementsByTagName('svg');
    if(mana)
      for(m of mana)
        manaStr += m.outerHTML;
  }
  
  // Show loading state - single loading indicator for both buttons
  div.innerHTML = '<div class="loading-indicator">Loading...</div>';
  
  // Send to background script first, then query actual state
  browser.runtime.sendMessage({ msgType: 'addCard', name: cardName, id: id, isFoil: isFoil, mana: manaStr })
  .then(message => {
    // Wait a bit for async operation to complete, then query state
    // Use retry mechanism to ensure we get the updated state
    setTimeout(() => queryCardWithRetry(isFoil, true), 100);
  }, handleError);
}


function removeCard(isFoil) {
  // Show loading state - single loading indicator for both buttons
  div.innerHTML = '<div class="loading-indicator">Loading...</div>';
  
  // Send to background script first, then query actual state
  browser.runtime.sendMessage({ msgType: 'removeCard', id: id, isFoil: isFoil })
  .then(message => {
    // Wait a bit for async operation to complete, then query state
    // Use retry mechanism to ensure we get the updated state
    setTimeout(() => queryCardWithRetry(isFoil, false), 100);
  }, handleError);
}


function queryCard() {
  browser.runtime.sendMessage({ msgType: 'queryCard', id: id })
  .then(result => {
    var nonFoilInCart = result.nonFoil;
    var foilInCart = result.foil;
    
    // Build buttons based on current state of each type independently
    var html = '';
    
    if(nonFoilInCart) {
      html += '<button id="TCGPSellerAgg-remove" class="TCGPSellerAggBtnRemove" type=button>Remove Non-foil</button> ';
    } else {
      html += '<button id="TCGPSellerAgg-add" class="TCGPSellerAggBtn" type=button>Add Non-foil</button> ';
    }
    
    if(foilInCart) {
      html += '<button id="TCGPSellerAgg-removeFoil" class="TCGPSellerAggBtnRemove" type=button>Remove Foil</button>';
    } else {
      html += '<button id="TCGPSellerAgg-foil" class="TCGPSellerAggBtn" type=button>Add Foil</button>';
    }
    
    div.innerHTML = html;
    btnBox.insertAdjacentElement('afterend', div);
    attachEventListeners();
  }, handleError);
}

function attachEventListeners() {
  const addBtnElem = document.getElementById('TCGPSellerAgg-add');
  const foilBtnElem = document.getElementById('TCGPSellerAgg-foil');
  const removeBtnElem = document.getElementById('TCGPSellerAgg-remove');
  const removeFoilBtnElem = document.getElementById('TCGPSellerAgg-removeFoil');
  
  if(addBtnElem) addBtnElem.addEventListener('click', () => addCard(false));
  if(foilBtnElem) foilBtnElem.addEventListener('click', () => addCard(true));
  if(removeBtnElem) removeBtnElem.addEventListener('click', () => removeCard(false));
  if(removeFoilBtnElem) removeFoilBtnElem.addEventListener('click', () => removeCard(true));
}


function queryCardWithRetry(expectedIsFoil, expectedInCart, retryCount = 0) {
  browser.runtime.sendMessage({ msgType: 'queryCard', id: id })
  .then(result => {
    var nonFoilInCart = result.nonFoil;
    var foilInCart = result.foil;
    
    // Check if the state matches what we expect
    var actualState = expectedIsFoil ? foilInCart : nonFoilInCart;
    
    // If state doesn't match and we haven't exceeded retries, try again
    if(actualState !== expectedInCart && retryCount < 10) {
      setTimeout(() => queryCardWithRetry(expectedIsFoil, expectedInCart, retryCount + 1), 100);
      return;
    }
    
    // State matches or we've exhausted retries - update UI
    queryCard();
  }, handleError);
}


function handleError(error) {
  console.log(`Error: ${error}`);
  // Reset to show buttons on error
  queryCard();
}


// Browser-specific message handling
window.addEventListener("message", (event) => {
  if(event.source !== window) return; // ignore other sources
  if(event.data === "Normal") addCard(false);
  if(event.data === "Foil") addCard(true);
  if(event.data === "Remove") removeCard();
});