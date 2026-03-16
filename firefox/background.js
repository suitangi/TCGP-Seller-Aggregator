var cards = [], sellers = [];
var sellerFilters = {"filters":{"term":{"sellerStatus":"Live","channelId":0,"language":["English"],"printing":["Foil"]},"range":{"quantity":{"gte":1}},"exclude":{"channelExclusion":0}},"sort":{"field":"price+shipping","order":"asc"},"context":{"shippingCountry":"US","cart":{}},"aggregations":["listingType"],"size":50,"from":0};

// Rate limiting and cache management
const REQUEST_QUEUE = [];
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes
const MAX_PAGES = 5; // Limit to first 5 pages (250 listings)
const MIN_JITTER = 800;
const MAX_JITTER = 1500;

// Cache management for Firefox
function clearCache() {
  browser.storage.local.get(null).then(storage => {
    const cacheKeys = Object.keys(storage).filter(key => key.startsWith('listings_'));
    
    if (cacheKeys.length > 0) {
      browser.storage.local.remove(cacheKeys).then(() => {
        console.log(`Cache cleared: removed ${cacheKeys.length} cached entries`);
      });
    }
  });
}

function getCachedListings(cacheKey, callback) {
  browser.storage.local.get([cacheKey]).then((result) => {
    const cached = result[cacheKey];
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      callback(cached.data);
    } else {
      callback(null);
    }
  }).catch(() => callback(null));
}

function setCachedListings(cacheKey, data) {
  browser.storage.local.set({
    [cacheKey]: {
      data: data,
      timestamp: Date.now()
    }
  }).catch(() => {
    console.warn('Cache write error');
  });
}

// Clean up expired cache entries periodically
function cleanupCache() {
  browser.storage.local.get(null).then((storage) => {
    const keysToRemove = [];
    
    for (const [key, value] of Object.entries(storage)) {
      if (key.startsWith('listings_') && value.timestamp && (Date.now() - value.timestamp) > CACHE_TTL) {
        keysToRemove.push(key);
      }
    }
    
    if (keysToRemove.length > 0) {
      browser.storage.local.remove(keysToRemove).then(() => {
        console.log(`Cleaned up ${keysToRemove.length} expired cache entries`);
      });
    }
  }).catch(() => {
    console.warn('Cache cleanup error');
  });
}

// Run cleanup on startup and periodically
cleanupCache();
setInterval(cleanupCache, 60 * 2 * 1000); // Every 2 minutes

// Initialize global arrays from storage on startup
browser.storage.local.get(['cards', 'sellers']).then((result) => {
  cards = result.cards || [];
  sellers = result.sellers || [];
  console.log(`Initialized from storage: ${cards.length} cards, ${sellers.length} seller arrays`);
}).catch(() => {
  console.warn('Storage initialization failed, using empty arrays');
  cards = [];
  sellers = [];
});

function addCard(id, name, isFoil, mana) {
  // Check if this specific variant (foil or non-foil) already exists
  if(cards.some(c => c.id === id && c.isFoil === isFoil))
    return 2;

  const cacheKey = `listings_${id}_${isFoil ? 'foil' : 'normal'}`;
  
  getCachedListings(cacheKey, (cachedData) => {
    if (cachedData) {
      // Use cached data and immediately add to cards array
      // Filter out damaged cards, non-English items, and direct listings
      const filteredSellers = cachedData.filter(e => !e.directListing && e.languageAbbreviation === 'EN' && e.condition !== "Damaged");
      
      // Sort by total cost (price + shipping) 
      filteredSellers.sort((a, b) => {
        const totalA = (a.price || 0) + (a.shippingPrice || 0);
        const totalB = (b.price || 0) + (b.shippingPrice || 0);
        return totalA - totalB;
      });
      
      // Deduplicate by sellerId
      const uniqueSellers = filteredSellers.filter((value, index, self) => 
        self.findIndex(t => t.sellerId === value.sellerId) === index
      );
      sellers.push(uniqueSellers);
      cards.push({ id: id, name: name, isFoil: isFoil, mana: mana, sellerIdx: sellers.length - 1, quantity: 1 });
      
      // Persist to storage
      browser.storage.local.set({cards: cards, sellers: sellers}).catch(() => {
        console.warn('Storage save error in cached path');
      });
    } else {
      // For new data, add card immediately with empty sellers, then fetch async
      sellers.push([]);
      const cardIndex = sellers.length - 1;
      cards.push({ id: id, name: name, isFoil: isFoil, mana: mana, sellerIdx: cardIndex, quantity: 1 });
      
      // Persist to storage immediately
      browser.storage.local.set({cards: cards, sellers: sellers}).catch(() => {
        console.warn('Storage save error in new card path');
      });
      
      // Fetch new data asynchronously and update
      fetchCardListings(id, name, isFoil, mana, cacheKey, cardIndex);
    }
  });

  return 1;
}

function fetchCardListings(id, name, isFoil, mana, cacheKey, cardIndex) {
  var sellersAll = [];
  var pageCount = 0;
  
  sellerFilters.from = 0;
  sellerFilters.filters.term.printing[0] = isFoil ? "Foil" : "Normal";

  function makeRequest() {
    // Add jitter delay between requests
    const jitter = Math.floor(Math.random() * (MAX_JITTER - MIN_JITTER + 1)) + MIN_JITTER;
    
    setTimeout(() => {
      var xhttp = new XMLHttpRequest();
      xhttp.onloadend = function() {
        if(this.status === 429) {
          // Handle rate limiting with exponential backoff
          const backoffTimes = [5000, 10000, 30000];
          const delay = backoffTimes[Math.min(pageCount, backoffTimes.length - 1)];
          console.warn(`Rate limited, retrying in ${delay/1000}s...`);
          
          setTimeout(() => {
            makeRequest(); // Retry the same request
          }, delay);
          return;
        }
        
        if(this.status === 200) {
          var sellersPage = JSON.parse(this.responseText);
          const pageResults = sellersPage.results[0].results;
          sellersAll.push(...pageResults);
          
          const pageTotal = sellersPage.results[0].totalResults;
          sellerFilters.from += 50;
          pageCount++;
          
          // Continue if we haven't hit limits and there are more results
          if(pageCount < MAX_PAGES && sellerFilters.from < pageTotal && pageResults.length >= 50) {
            makeRequest(); // Fetch next page
          } else {
            // Finished fetching, process results
            // Filter out damaged cards, non-English items, and direct listings
            const filteredSellers = sellersAll.filter(e => !e.directListing && e.languageAbbreviation === 'EN' && e.condition !== "Damaged");
            
            // Sort by total cost (price + shipping)
            filteredSellers.sort((a, b) => {
              const totalA = (a.price || 0) + (a.shippingPrice || 0);
              const totalB = (b.price || 0) + (b.shippingPrice || 0);
              return totalA - totalB;
            });
            
            // Deduplicate by sellerId
            const dedupedSellers = filteredSellers.filter((value, index, self) => 
              self.findIndex(t => t.sellerId === value.sellerId) === index
            );
            
            // Cache the results
            setCachedListings(cacheKey, sellersAll);
            
            // Update the sellers array for this card
            sellers[cardIndex] = dedupedSellers;
            
            // Persist updated sellers to storage
            browser.storage.local.set({sellers: sellers}).catch(() => {
              console.warn('Storage save error in fetch complete');
            });
          }
        } else {
          console.error(`Fetch failed: ${this.status}`);
        }
      }

      // Set up request with stealth headers
      const productUrl = `https://www.tcgplayer.com/product/${id}?Language=English`;
      xhttp.open('POST', 'https://mp-search-api.tcgplayer.com/v1/product/' + id + '/listings', true);
      xhttp.setRequestHeader('Content-Type', 'application/json');
      xhttp.setRequestHeader('Referer', productUrl); // Spoof referer for stealth
      // Don't set User-Agent to inherit browser's ambient headers
      xhttp.send(JSON.stringify(sellerFilters));
    }, pageCount === 0 ? 0 : jitter); // No delay for first request
  }

  makeRequest();
}


function removeCard(id, isFoil) {
  return new Promise((resolve) => {
    browser.storage.local.get(['cards', 'sellers']).then((result) => {
      let cards = result.cards || [];
      let sellers = result.sellers || [];
      
      const card = cards.find(c => c.id === id && c.isFoil === isFoil);
      if(card) {
        // Only delete seller data if no other cards use it
        const otherCardsUseSeller = cards.some(c => c.sellerIdx === card.sellerIdx && c.id !== id);
        if(!otherCardsUseSeller) {
          delete sellers[card.sellerIdx];
        }
        cards = cards.filter(c => !(c.id === id && c.isFoil === isFoil));
        
        // Update global arrays
        window.cards = cards;
        window.sellers = sellers;
        
        browser.storage.local.set({cards: cards, sellers: sellers}).then(() => {
          resolve(1);
        }).catch(() => {
          resolve(0);
        });
      } else {
        resolve(0);
      }
    }).catch(() => {
      resolve(0);
    });
  });
}


function cardCart(id, isFoil, inOrOut) {
  var card = cards.find(c => c.id === id && c.isFoil === isFoil);
  if(card)
    // Removed inCart tracking
    // card.inCart = inOrOut;
  return +!!card;
}


function queryCard(id, sendResponse) {
  browser.storage.local.get(['cards']).then((result) => {
    const cards = result.cards || [];
    // Return separate statuses for foil and non-foil variants
    const result_obj = {
      nonFoil: cards.some(c => c.id === id && !c.isFoil),
      foil: cards.some(c => c.id === id && c.isFoil)
    };
    sendResponse(result_obj);
  }).catch(() => {
    sendResponse({
      nonFoil: false,
      foil: false
    });
  });
  return true; // Keep message channel open for async response
}


function getCart(sendResponse) {
  console.log('getCart() called');
  browser.storage.local.get(['cards']).then((result) => {
    const cards = result.cards || [];
    console.log('getCart() - cards from storage:', cards.length, 'cards');
    sendResponse(cards);
  }).catch((error) => {
    console.error('getCart() - storage error:', error);
    sendResponse([]);
  });
  return true; // Keep message channel open for async response
}


function getSellers(sendResponse) {
  browser.storage.local.get(['sellers']).then((result) => {
    const sellers = result.sellers || [];
    sendResponse(sellers);
  }).catch(() => {
    sendResponse([]);
  });
  return true; // Keep message channel open for async response
}


function contentMsg(request, sender, sendResponse) {
  var res = 0;
  var _id = +request.id;
  if(request.msgType === 'addCard') res = addCard(_id, request.name, request.isFoil, request.mana);
  if(request.msgType === 'removeCard') {
    removeCard(_id, request.isFoil).then((result) => {
      sendResponse(result);
    });
    return true; // Keep message channel open for async response
  }
  if(request.msgType === 'queryCard') {
    queryCard(_id, sendResponse);
    return true; // Keep message channel open for async response
  }
  if(request.msgType === 'addCardToCart') { res = cardCart(_id, request.isFoil, true); /* sellers[+request.sellerIdx][+request.sellerIdxIdx].inCart = true; */ }
  if(request.msgType === 'removeCardFromCart') { res = cardCart(_id, false); /* const si = +request.sellerIdx; for(let i = 0; i < sellers[si].length; i++) sellers[si][i].inCart = false; */ }
  /*
  if(request.msgType === 'toggleInCart') {
    var card = cards.find(c => c.id === _id && c.isFoil === request.isFoil);
    if(card) {
      card.inCart = !card.inCart;
      res = 1;
    }
  }
  */
  if(request.msgType === 'updateCardName') {
    var card = cards.find(c => c.id === _id);
    if(card) {
      card.name = request.name;
      res = 1;
    }
  }
  if(request.msgType === 'updateQuantity') {
    browser.storage.local.get(['cards']).then((result) => {
      const cards = result.cards || [];
      const card = cards.find(c => c.id === _id && c.isFoil === request.isFoil);
      if(card) {
        card.quantity = request.quantity;
        // Update global array too for consistency
        const globalCard = window.cards.find(c => c.id === _id && c.isFoil === request.isFoil);
        if(globalCard) {
          globalCard.quantity = request.quantity;
        }
        browser.storage.local.set({cards: cards}).catch(() => {
          console.warn('Storage save error in updateQuantity');
        });
        sendResponse(1);
      } else {
        sendResponse(0);
      }
    }).catch(() => {
      sendResponse(0);
    });
    return true; // Keep message channel open for async response
  }
  if(request.msgType === 'getCards') return getCart(sendResponse);
  if(request.msgType === 'aggregate') return getSellers(sendResponse);
  if(request.msgType === 'clearCache') {
    clearCache();
    sendResponse({ success: true });
    return;
  }

  sendResponse(res);
}


browser.runtime.onMessage.addListener(contentMsg);
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if(changeInfo.url && tab.url.startsWith('https://www.tcgplayer.com/product/'))
    browser.tabs.sendMessage(tab.id, 1);
}, { properties: ["url"] });