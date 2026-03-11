var btnBox, id, path, timerId;
var div = document.createElement("div");
loadCheck();
chrome.runtime.onMessage.addListener(loadCheck);


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
  
  // Optimistic UI update
  queryCard();
  
  chrome.runtime.sendMessage({ msgType: 'addCard', name: cardName, id: id, isFoil: isFoil, mana: manaStr })
  .then(message => {
    if(message === 2) {
      // Card already exists - refresh to show current state
      queryCard();
    } else if(message !== 1) {
      // Error - show error message
      var errorHtml = 'Error adding card<br>' + message + '<br>';
      errorHtml += '<button id="TCGPSellerAgg-add" class="TCGPSellerAggBtn" type=button>Add Non-foil</button> ';
      errorHtml += '<button id="TCGPSellerAgg-foil" class="TCGPSellerAggBtn" type=button>Add Foil</button>';
      div.innerHTML = errorHtml;
      attachEventListeners();
    }
  }, handleError);
}


function removeCard(isFoil) {
  // Optimistic UI update
  queryCard();
  
  chrome.runtime.sendMessage({ msgType: 'removeCard', id: id, isFoil: isFoil })
  .then(message => {
    if(message === 0) {
      var errorHtml = 'Card not found in vCart<br>';
      errorHtml += '<button id="TCGPSellerAgg-add" class="TCGPSellerAggBtn" type=button>Add Non-foil</button> ';
      errorHtml += '<button id="TCGPSellerAgg-foil" class="TCGPSellerAggBtn" type=button>Add Foil</button>';
      div.innerHTML = errorHtml;
      attachEventListeners();
    } else if(message !== 1) {
      div.innerHTML = 'Error removing card<br>';
      attachEventListeners();
    }
  }, handleError);
}


function queryCard() {
  chrome.runtime.sendMessage({ msgType: 'queryCard', id: id })
  .then(result => {
    var nonFoilInCart = result.nonFoil;
    var foilInCart = result.foil;
    
    // Build buttons based on current state of each type independently
    var html = '';
    
    if(nonFoilInCart) {
      html += '<button id="TCGPSellerAgg-remove" class="TCGPSellerAggBtn" type=button>Remove Non-foil</button> ';
    } else {
      html += '<button id="TCGPSellerAgg-add" class="TCGPSellerAggBtn" type=button>Add Non-foil</button> ';
    }
    
    if(foilInCart) {
      html += '<button id="TCGPSellerAgg-removeFoil" class="TCGPSellerAggBtn" type=button>Remove Foil</button>';
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


function handleError(error) {
  console.log(`Error: ${error}`);
}


// Browser-specific message handling
window.addEventListener("message", (event) => {
  if(event.source !== window) return; // ignore other sources
  if(event.data === "Normal") addCard(false);
  if(event.data === "Foil") addCard(true);
  if(event.data === "Remove") removeCard();
});