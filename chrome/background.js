var sellerFilters = {"filters":{"term":{"sellerStatus":"Live","channelId":0,"language":["English"],"printing":["Foil"]},"range":{"quantity":{"gte":1}},"exclude":{"channelExclusion":0}},"sort":{"field":"price+shipping","order":"asc"},"context":{"shippingCountry":"US","cart":{}},"aggregations":["listingType"],"size":50,"from":0};


async function addCard(id, name, foil, mana) {
  let pageTotal = 0, sellersAll = [];

  const { cards = [] } = await chrome.storage.local.get('cards');
  const { sellers = [] } = await chrome.storage.local.get('sellers');
  if(cards.some(c => c.id === id)) return 2;

  sellerFilters.from = 0;
  sellerFilters.filters.term.printing[0] = foil ? "Foil" : "Normal";

  while(true) { //paginate sellers for card
    const response = await fetch(`https://mp-search-api.tcgplayer.com/v1/product/${id}/listings`, {method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(sellerFilters)
    });

    if(!response.ok) {
      console.error(`Fetch failed: ${response.status}`);
      return 0;
    }

    const sellersPage = await response.json();
    sellersAll.push(...sellersPage.results[0].results);

    pageTotal = sellersPage.results[0].totalResults;
    sellerFilters.from += 50;
    if(sellerFilters.from >= pageTotal)
      break;
  }

  // Filter and deduplicate
  sellersAll = sellersAll.filter(e => !e.directSeller && e.languageAbbreviation === 'EN' && e.condition !== "Damaged");
  sellersAll = sellersAll.filter((value, index, self) => self.findIndex(t => t.sellerId === value.sellerId) === index);
  sellers.push(sellersAll);

  if(foil) name += ' *F*';
  cards.push({ id: id, name: name, mana: mana, sellerIdx: sellers.length - 1, inCart: false });

  await chrome.storage.local.set({cards: cards});
  await chrome.storage.local.set({sellers: sellers});
  return 1;
}


async function queryCard(id) {
  var { cards = [] } = await chrome.storage.local.get('cards');
  return +cards.some(c => c.id === id);
}


async function removeCard(id) {
  var { cards = [] } = await chrome.storage.local.get('cards');
  var card = cards.find(c => c.id === id);
  if(!card) return 0;
  var { sellers = [] } = await chrome.storage.local.get('sellers');
  delete sellers[card.sellerIdx];
  cards = cards.filter(c => c.id !== id);
  await chrome.storage.local.set({cards: cards});
  await chrome.storage.local.set({sellers: sellers});
  return 1;
}


async function contentMsg(request) {
  var res = 0, _id = +request.id;
  if(request.msgType === 'addCard') res = await addCard(_id, request.name, request.foil, request.mana);
  if(request.msgType === 'queryCard') res = await queryCard(_id);
  if(request.msgType === 'removeCard') res = await removeCard(_id);
  if(request.msgType === 'getCards') {
    const { cards = [] } = await chrome.storage.local.get('cards');
    return cards;
  }
  if(request.msgType === 'aggregate') {
    const { sellers = [] } = await chrome.storage.local.get('sellers');
    return sellers;
  }
  if(request.msgType === 'addCardToCart') {
    const { cards = [] } = await chrome.storage.local.get('cards');
    const { sellers = [] } = await chrome.storage.local.get('sellers');
    const card = cards.find(c => c.id === _id);
    if(card && sellers[+request.sellerIdx]) {
      card.inCart = true;
      sellers[+request.sellerIdx][+request.sellerIdxIdx].inCart = true;
      await chrome.storage.local.set({cards: cards});
      await chrome.storage.local.set({sellers: sellers});
    }
    return 1;
  }
  if(request.msgType === 'toggleInCart') {
    const { cards = [] } = await chrome.storage.local.get('cards');
    const card = cards.find(c => c.id === _id);
    if(card) {
      card.inCart = !card.inCart;
      await chrome.storage.local.set({cards: cards});
      return 1;
    }
    return 0;
  }
  if(request.msgType === 'updateCardName') {
    const { cards = [] } = await chrome.storage.local.get('cards');
    const card = cards.find(c => c.id === _id);
    if(card) {
      card.name = request.name;
      await chrome.storage.local.set({cards: cards});
      return 1;
    }
    return 0;
  }

  return res;
}


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  contentMsg(message).then((result) => {sendResponse(result)});
  return true;
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if(changeInfo.url && tab.url.startsWith('https://www.tcgplayer.com/product/'))
    chrome.tabs.sendMessage(tab.id, 1);
});