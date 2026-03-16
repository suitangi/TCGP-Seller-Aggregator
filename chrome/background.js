var cards = [], sellers = [];
var sellerFilters = {"filters":{"term":{"sellerStatus":"Live","channelId":0,"language":["English"],"printing":["Foil"]},"range":{"quantity":{"gte":1}},"exclude":{"channelExclusion":0}},"sort":{"field":"price+shipping","order":"asc"},"context":{"shippingCountry":"US","cart":{}},"aggregations":["listingType"],"size":50,"from":0};

// Rate limiting and cache management
const REQUEST_QUEUE = [];
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes
const MAX_PAGES = 5; // Limit to first 5 pages (250 listings)
const MIN_JITTER = 800;
const MAX_JITTER = 1500;

// Throttled fetch with exponential backoff
async function throttledFetch(url, options, retryCount = 0) {
  const jitter = Math.floor(Math.random() * (MAX_JITTER - MIN_JITTER + 1)) + MIN_JITTER;
  
  if (retryCount > 0) {
    // Exponential backoff: 5s, 10s, 30s
    const backoffTimes = [5000, 10000, 30000];
    const delay = backoffTimes[Math.min(retryCount - 1, backoffTimes.length - 1)];
    await new Promise(resolve => setTimeout(resolve, delay));
  } else if (REQUEST_QUEUE.length > 0) {
    // Normal jitter delay
    await new Promise(resolve => setTimeout(resolve, jitter));
  }
  
  REQUEST_QUEUE.push(Date.now());
  
  try {
    const response = await fetch(url, options);
    
    if (response.status === 429) {
      if (retryCount < 3) {
        console.warn(`Rate limited, retrying in ${retryCount === 0 ? 5 : retryCount === 1 ? 10 : 30}s...`);
        return throttledFetch(url, options, retryCount + 1);
      } else {
        throw new Error('Max retries exceeded for rate limiting');
      }
    }
    
    return response;
  } finally {
    REQUEST_QUEUE.pop();
  }
}

// Cache management
async function clearCache() {
  const storage = await chrome.storage.local.get(null);
  const cacheKeys = Object.keys(storage).filter(key => key.startsWith('listings_'));
  
  if (cacheKeys.length > 0) {
    await chrome.storage.local.remove(cacheKeys);
    console.log(`Cache cleared: removed ${cacheKeys.length} cached entries`);
  }
}

async function getCachedListings(cacheKey) {
  try {
    const result = await chrome.storage.local.get([cacheKey]);
    const cached = result[cacheKey];
    
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      return cached.data;
    }
  } catch (error) {
    console.warn('Cache read error:', error);
  }
  return null;
}

async function setCachedListings(cacheKey, data) {
  try {
    await chrome.storage.local.set({
      [cacheKey]: {
        data: data,
        timestamp: Date.now()
      }
    });
  } catch (error) {
    console.warn('Cache write error:', error);
  }
}

// Clean up expired cache entries periodically
async function cleanupCache() {
  try {
    const storage = await chrome.storage.local.get(null);
    const keysToRemove = [];
    
    for (const [key, value] of Object.entries(storage)) {
      if (key.startsWith('listings_') && value.timestamp && (Date.now() - value.timestamp) > CACHE_TTL) {
        keysToRemove.push(key);
      }
    }
    
    if (keysToRemove.length > 0) {
      await chrome.storage.local.remove(keysToRemove);
      console.log(`Cleaned up ${keysToRemove.length} expired cache entries`);
    }
  } catch (error) {
    console.warn('Cache cleanup error:', error);
  }
}

// Run cleanup on startup and periodically
cleanupCache();
setInterval(cleanupCache, 60 * 2 * 1000); // Every 2 minutes

async function addCard(id, name, isFoil, mana) {
  let sellersAll = [];

  const { cards = [] } = await chrome.storage.local.get('cards');
  const { sellers = [] } = await chrome.storage.local.get('sellers');
  
  // Check if this specific variant (foil or non-foil) already exists
  if(cards.some(c => c.id === id && c.isFoil === isFoil)) return 2;

  // Check cache first
  const cacheKey = `listings_${id}_${isFoil ? 'foil' : 'normal'}`;
  const cachedData = await getCachedListings(cacheKey);
  
  if (cachedData) {
    sellersAll = cachedData;
  } else {
    sellerFilters.from = 0;
    sellerFilters.filters.term.printing[0] = isFoil ? "Foil" : "Normal";
    let pageCount = 0;
    
    while(pageCount < MAX_PAGES) { // Limit to first 5 pages for stealth
      const productUrl = `https://www.tcgplayer.com/product/${id}?Language=English`;
      
      const response = await throttledFetch(`https://mp-search-api.tcgplayer.com/v1/product/${id}/listings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Referer': productUrl // Spoof referer to look like natural page navigation
          // Remove User-Agent to inherit browser's ambient headers
        },
        body: JSON.stringify(sellerFilters)
      });

      if(!response.ok) {
        console.error(`Fetch failed: ${response.status}`);
        return 0;
      }

      const sellersPage = await response.json();
      const pageResults = sellersPage.results[0].results;
      sellersAll.push(...pageResults);
      
      const pageTotal = sellersPage.results[0].totalResults;
      sellerFilters.from += 50;
      pageCount++;
      
      // Break if we've fetched all available results or hit our page limit
      if(sellerFilters.from >= pageTotal || pageResults.length < 50) {
        break;
      }
    }
    
    // Cache the results
    await setCachedListings(cacheKey, sellersAll);
  }

  // Filter out damaged cards and non-English items, include all sellers
  sellersAll = sellersAll.filter(e => !e.directListing && e.languageAbbreviation === 'EN' && e.condition !== "Damaged");

  // Sort by total cost (price + shipping)
  sellersAll.sort((a, b) => {
    const totalA = (a.price || 0) + (a.shippingPrice || 0);
    const totalB = (b.price || 0) + (b.shippingPrice || 0);
    return totalA - totalB;
  });
  sellersAll = sellersAll.filter((value, index, self) => self.findIndex(t => t.sellerId === value.sellerId) === index);
  sellers.push(sellersAll);

  // Store with isFoil boolean and quantity (default 1)
  cards.push({ id: id, name: name, isFoil: isFoil, mana: mana, sellerIdx: sellers.length - 1, quantity: 1 });

  await chrome.storage.local.set({cards: cards});
  await chrome.storage.local.set({sellers: sellers});
  return 1;
}


async function queryCard(id) {
  var { cards = [] } = await chrome.storage.local.get('cards');
  // Return separate statuses for foil and non-foil variants
  return {
    nonFoil: cards.some(c => c.id === id && !c.isFoil),
    foil: cards.some(c => c.id === id && c.isFoil)
  };
}


async function removeCard(id, isFoil) {
  var { cards = [] } = await chrome.storage.local.get('cards');
  var card = cards.find(c => c.id === id && c.isFoil === isFoil);
  if(!card) return 0;
  var { sellers = [] } = await chrome.storage.local.get('sellers');
  // Only delete seller data if no other cards use it
  var otherCardsUseSeller = cards.some(c => c.sellerIdx === card.sellerIdx && c.id !== id);
  if(!otherCardsUseSeller) {
    delete sellers[card.sellerIdx];
  }
  cards = cards.filter(c => !(c.id === id && c.isFoil === isFoil));
  await chrome.storage.local.set({cards: cards});
  await chrome.storage.local.set({sellers: sellers});
  return 1;
}


async function contentMsg(request) {
  var res = 0, _id = +request.id;
  if(request.msgType === 'addCard') res = await addCard(_id, request.name, request.isFoil, request.mana);
  if(request.msgType === 'queryCard') res = await queryCard(_id);
  if(request.msgType === 'removeCard') res = await removeCard(_id, request.isFoil);
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
    const card = cards.find(c => c.id === _id && c.isFoil === request.isFoil);
    if(card && sellers[+request.sellerIdx]) {
      // Removed inCart tracking
      // card.inCart = true;
      // sellers[+request.sellerIdx][+request.sellerIdxIdx].inCart = true;
      await chrome.storage.local.set({cards: cards});
      await chrome.storage.local.set({sellers: sellers});
    }
    return 1;
  }
  /*
  if(request.msgType === 'toggleInCart') {
    const { cards = [] } = await chrome.storage.local.get('cards');
    const card = cards.find(c => c.id === _id && c.isFoil === request.isFoil);
    if(card) {
      card.inCart = !card.inCart;
      await chrome.storage.local.set({cards: cards});
      return 1;
    }
    return 0;
  }
  */
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
  if(request.msgType === 'updateQuantity') {
    const { cards = [] } = await chrome.storage.local.get('cards');
    const card = cards.find(c => c.id === _id && c.isFoil === request.isFoil);
    if(card) {
      card.quantity = request.quantity;
      await chrome.storage.local.set({cards: cards});
      return 1;
    }
    return 0;
  }
  if(request.msgType === 'clearCache') {
    await clearCache();
    return { success: true };
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
}, { properties: ["url"] });