// Set Cover Algorithm Test Suite - Node.js Version
// Wallet Defense System against eBay corporate greed!

console.log('🛡️ Set Cover Algorithm Test Suite - Wallet Defense System 🛡️');
console.log('Testing against the evil eBay corporate overlords...\n');

// Copy the actual algorithm functions from popup.js
function greedySetCoverSolver(cardRequests, sellerOptions) {
    const uncoveredRequests = new Set(cardRequests.map((_, idx) => idx));
    const selectedSellers = new Map(); // sellerId -> seller info
    const assignments = []; // Track which seller covers which card request
    const sellerStockUsed = new Map(); // Track how much stock each seller has used
    
    let iterations = 0;
    const maxIterations = cardRequests.length * 2; // Prevent infinite loops
    
    // Debug logging for tests
    const debugLogs = [];
    
    while (uncoveredRequests.size > 0 && iterations < maxIterations) {
        iterations++;
        let bestOption = null;
        let bestCostEffectiveness = Infinity;
        let bestCoveredRequests = [];
        
        debugLogs.push(`Iteration ${iterations}: ${uncoveredRequests.size} uncovered requests remaining`);
        
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
                
                // Get available stock from the seller data
                const totalStock = option.quantity || 1;
                
                // Calculate how much stock this seller has already used
                const stockKey = `${option.sellerId}_${cardKey}`;
                const stockAlreadyUsed = sellerStockUsed.get(stockKey) || 0;
                const availableStock = totalStock - stockAlreadyUsed;
                
                const requestsToAssign = Math.min(cardGroup.requests.length, availableStock);
                
                if (requestsToAssign > 0) {
                    availableCardTypes.push({
                        cardKey,
                        cardGroup,
                        option,
                        stockKey,
                        requestsToAssign,
                        totalStock,
                        stockAlreadyUsed
                    });
                }
            }

            if (availableCardTypes.length === 0) continue;

            // Consider each card type individually AND all combinations
            const combinationsToTry = [];
            
            // Single card types
            for (const cardType of availableCardTypes) {
                combinationsToTry.push([cardType]);
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
                    shippingCost = firstCardType.option.shippingPrice || 0;
                    const sellerShippingPrice = firstCardType.option.sellerShippingPrice || 0;
                    
                    // Apply free shipping policy: if sellerShippingPrice is 0 and subtotal >= $5, shipping is free
                    if (sellerShippingPrice === 0 && subtotal >= 5) {
                        shippingCost = 0;
                    }
                }
                
                const totalCost = subtotal + shippingCost;
                const costEffectiveness = totalCost / coveredRequestIndices.length;
                
                // CONSOLIDATION FIX: Prefer multi-card combinations that save total money
                // For multi-card combinations, check if they beat splitting the cards
                let adjustedCostEffectiveness = costEffectiveness;
                
                if (combination.length > 1) {
                  // Multi-card combination: compare total cost vs splitting cards individually  
                  let bestIndividualTotal = 0;
                  let allCardsAvailableIndividually = true;
                  
                  for (const cardType of combination) {
                    let bestIndividualCE = Infinity;
                    
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
                        
                        if (indivCE < bestIndividualCE) {
                          bestIndividualCE = indivCE;
                        }
                      }
                    }
                    
                    if (bestIndividualCE === Infinity) {
                      allCardsAvailableIndividually = false;
                      break;
                    }
                    
                    bestIndividualTotal += bestIndividualCE;
                  }
                  
                  if (allCardsAvailableIndividually) {
                    // If total cost of multi-card is better than splitting, give it priority
                    if (totalCost < bestIndividualTotal) {
                      // Multi-card saves money - FORCE it to be the best option by making CE extremely low
                      const savings = bestIndividualTotal - totalCost;
                      adjustedCostEffectiveness = 0.001; // Force this to be the absolute best option
                    }
                  }
                }
                
                const comboType = combination.length === 1 ? 'SINGLE' : 'MULTI';
                const cardList = combination.map(c => c.cardKey).join('+');
                
                debugLogs.push(`  Seller ${sellerId} (${comboType}): ${cardList} - $${totalCost.toFixed(2)} for ${coveredRequestIndices.length} cards (raw CE: ${costEffectiveness.toFixed(2)}, adj CE: ${adjustedCostEffectiveness.toFixed(2)}) [Already selected: ${selectedSellers.has(sellerId)}]`);
                
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
            debugLogs.push(`No valid options found. Terminating.`);
            return {
                success: false,
                message: "Cannot find sellers for some cards. Some cards may be out of stock.",
                debugLogs: debugLogs
            };
        }
        
        debugLogs.push(`  SELECTED: Seller ${bestOption.sellerId} - ${bestOption.cardList} - $${bestOption.totalCost.toFixed(2)} (CE: ${bestCostEffectiveness.toFixed(2)})`);
        
        // Select this seller and update stock usage tracking
                // CRITICAL FIX: Don't overwrite existing seller data, merge it!
                if (selectedSellers.has(bestOption.sellerId)) {
                  // Seller already exists, merge the data
                  const existingSeller = selectedSellers.get(bestOption.sellerId);
                  existingSeller.subtotal += bestOption.subtotal;
                  // Keep original shipping cost (don't add more shipping)
                  existingSeller.totalCost += bestOption.subtotal; // Only add the new subtotal, shipping already counted
                  existingSeller.assignments.push(...bestOption.assignments);
                } else {
                  // New seller, store normally
                  selectedSellers.set(bestOption.sellerId, bestOption);
                }
        
        // Update stock tracking for this seller
        for (const assignment of bestOption.assignments) {
            if (assignment.stockKey) {
                const currentUsage = sellerStockUsed.get(assignment.stockKey) || 0;
                sellerStockUsed.set(assignment.stockKey, currentUsage + 1);
            }
        }
        
        // Remove covered requests
        for (const requestIdx of bestCoveredRequests) {
            uncoveredRequests.delete(requestIdx);
        }
        
        // Additional safeguard: ensure we're making progress
        if (bestCoveredRequests.length === 0) {
            debugLogs.push('No progress made in set cover iteration, breaking to prevent infinite loop');
            break;
        }
    }
    
    // Check if we successfully covered all requests
    if (uncoveredRequests.size > 0) {
        if (iterations >= maxIterations) {
            debugLogs.push('Set cover algorithm reached maximum iterations, may not have optimal solution');
        }
        return {
            success: false,
            message: `Could not cover ${uncoveredRequests.size} card requests. Some cards may be out of stock or have no available sellers.`,
            debugLogs: debugLogs
        };
    }
    
    return {
        success: true,
        solution: {
            sellers: selectedSellers,
            assignments: assignments,
            cardRequests: cardRequests
        },
        debugLogs: debugLogs
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

// Test framework
class TestRunner {
    constructor() {
        this.tests = [];
        this.passedTests = 0;
        this.failedTests = 0;
    }

    addTest(name, testFn) {
        this.tests.push({ name, testFn });
    }

    createTestData(cards, sellers) {
        // Convert cards to cardRequests format (expand by quantity)
        const cardRequests = [];
        for (const card of cards) {
            for (let i = 0; i < (card.quantity || 1); i++) {
                cardRequests.push({
                    cardId: card.id,
                    isFoil: card.isFoil || false,
                    name: card.name,
                    mana: card.mana || '',
                    sellerIdx: card.id, // Use card ID as seller index for simplicity
                    requestIndex: i
                });
            }
        }

        // Convert sellers to sellerOptions format
        const sellerOptions = [];
        for (const card of cards) {
            const cardSellers = sellers[card.id] || [];
            for (let sellerIdx = 0; sellerIdx < cardSellers.length; sellerIdx++) {
                const seller = cardSellers[sellerIdx];
                if (seller.quantity > 0) {
                    sellerOptions.push({
                        sellerId: seller.sellerId,
                        sellerName: seller.sellerName || `Seller ${seller.sellerId}`,
                        sellerKey: seller.sellerKey || seller.sellerId,
                        price: seller.price,
                        shippingPrice: seller.shippingPrice || 0,
                        sellerShippingPrice: seller.sellerShippingPrice || 0,
                        quantity: seller.quantity,
                        cardRequest: cardRequests.find(req => req.cardId === card.id && req.isFoil === (card.isFoil || false)),
                        originalSellerIdx: card.id,
                        originalSellerIdxIdx: sellerIdx,
                        productConditionId: `${card.id}_${seller.sellerId}_${sellerIdx}`
                    });
                }
            }
        }

        return { cardRequests, sellerOptions };
    }

    runTest(testCase) {
        try {
            const result = testCase.testFn();
            if (result.success) {
                this.passedTests++;
                return { success: true, message: result.message || 'Test passed', debugInfo: result.debugInfo };
            } else {
                this.failedTests++;
                return { success: false, message: result.message || 'Test failed', debugInfo: result.debugInfo };
            }
        } catch (error) {
            this.failedTests++;
            return { success: false, message: `Test threw error: ${error.message}` };
        }
    }

    runAllTests() {
        console.log('Running tests...\n');

        for (const testCase of this.tests) {
            const result = this.runTest(testCase);
            const status = result.success ? '✅ PASS' : '❌ FAIL';
            console.log(`${status}: ${testCase.name}`);
            console.log(`   ${result.message}`);
            if (result.debugInfo) {
                console.log(`   Debug: ${result.debugInfo}`);
            }
            console.log('');
        }

        const totalTests = this.passedTests + this.failedTests;
        const successRate = ((this.passedTests / totalTests) * 100).toFixed(1);
        
        console.log('='.repeat(60));
        console.log('🛡️ WALLET DEFENSE SYSTEM TEST RESULTS 🛡️');
        console.log(`Passed: ${this.passedTests}/${totalTests} (${successRate}%)`);
        
        if (this.failedTests === 0) {
            console.log('🎉 ALL TESTS PASSED! Ready to defend against corporate greed!');
        } else {
            console.log(`⚠️ ${this.failedTests} tests failed. The algorithm needs more work!`);
        }
        console.log('='.repeat(60));
    }
}

// Create test runner and add all test cases
const runner = new TestRunner();

// Test Group 1: Basic Functionality
runner.addTest("Single card, single seller", () => {
    const cards = [
        { id: 1, name: "Lightning Bolt", quantity: 1, isFoil: false }
    ];
    const sellers = {
        1: [
            { sellerId: 101, price: 5.00, quantity: 10, shippingPrice: 1.99, sellerShippingPrice: 1.99 }
        ]
    };

    const { cardRequests, sellerOptions } = runner.createTestData(cards, sellers);
    const result = greedySetCoverSolver(cardRequests, sellerOptions);

    if (!result.success) {
        return { 
            success: false, 
            message: "Algorithm failed: " + result.message,
            debugInfo: result.debugLogs ? result.debugLogs.join('\n') : ''
        };
    }

    const finalResult = calculateFinalCosts(result.solution);
    
    // Should select seller 101, total cost should be 5.00 + 1.99 = 6.99
    if (Math.abs(finalResult.totals.total - 6.99) > 0.01) {
        return { success: false, message: `Expected total $6.99, got $${finalResult.totals.total}` };
    }

    return { success: true, message: `Correct total: $${finalResult.totals.total}` };
});

runner.addTest("Multiple cards, single seller consolidation", () => {
    const cards = [
        { id: 1, name: "Lightning Bolt", quantity: 1, isFoil: false },
        { id: 2, name: "Counterspell", quantity: 1, isFoil: false }
    ];
    const sellers = {
        1: [
            { sellerId: 101, price: 5.00, quantity: 10, shippingPrice: 1.99, sellerShippingPrice: 1.99 }
        ],
        2: [
            { sellerId: 101, price: 3.00, quantity: 10, shippingPrice: 1.99, sellerShippingPrice: 1.99 }
        ]
    };

    const { cardRequests, sellerOptions } = runner.createTestData(cards, sellers);
    const result = greedySetCoverSolver(cardRequests, sellerOptions);

    if (!result.success) {
        return { 
            success: false, 
            message: "Algorithm failed: " + result.message,
            debugInfo: result.debugLogs ? result.debugLogs.join('\n') : ''
        };
    }

    const finalResult = calculateFinalCosts(result.solution);
    
    // Should consolidate to seller 101: (5.00 + 3.00) + 1.99 shipping = 9.99
    // NOT two separate orders with shipping each
    if (finalResult.sellers.length !== 1) {
        return { 
            success: false, 
            message: `Expected 1 seller, got ${finalResult.sellers.length}`,
            debugInfo: result.debugLogs ? result.debugLogs.join('\n') : ''
        };
    }

    if (Math.abs(finalResult.totals.total - 9.99) > 0.01) {
        return { 
            success: false, 
            message: `Expected total ~$9.99, got $${finalResult.totals.total}`,
            debugInfo: result.debugLogs ? result.debugLogs.join('\n') : ''
        };
    }

    if (Math.abs(finalResult.totals.shipping - 1.99) > 0.01) {
        return { 
            success: false, 
            message: `Expected shipping $1.99 (consolidated), got $${finalResult.totals.shipping}`,
            debugInfo: result.debugLogs ? result.debugLogs.join('\n') : ''
        };
    }

    return { 
        success: true, 
        message: `✅ SHIPPING CONSOLIDATED! 1 seller, total: $${finalResult.totals.total}, shipping: $${finalResult.totals.shipping}` 
    };
});

runner.addTest("Cost optimization: expensive vs cheap with shipping", () => {
    const cards = [
        { id: 1, name: "Lightning Bolt", quantity: 1, isFoil: false }
    ];
    const sellers = {
        1: [
            { sellerId: 101, price: 3.00, quantity: 10, shippingPrice: 4.99, sellerShippingPrice: 4.99 }, // $7.99 total
            { sellerId: 102, price: 7.50, quantity: 10, shippingPrice: 0.99, sellerShippingPrice: 0.99 }  // $8.49 total
        ]
    };

    const { cardRequests, sellerOptions } = runner.createTestData(cards, sellers);
    const result = greedySetCoverSolver(cardRequests, sellerOptions);

    if (!result.success) {
        return { 
            success: false, 
            message: "Algorithm failed: " + result.message,
            debugInfo: result.debugLogs ? result.debugLogs.join('\n') : ''
        };
    }

    const finalResult = calculateFinalCosts(result.solution);
    
    // Should choose seller 101 (cheaper total despite high shipping)
    if (finalResult.sellers[0].sellerId !== 101) {
        return { 
            success: false, 
            message: `Expected seller 101 (cheaper total), got seller ${finalResult.sellers[0].sellerId}`,
            debugInfo: result.debugLogs ? result.debugLogs.join('\n') : ''
        };
    }

    if (Math.abs(finalResult.totals.total - 7.99) > 0.01) {
        return { 
            success: false, 
            message: `Expected total $7.99, got $${finalResult.totals.total}`,
            debugInfo: result.debugLogs ? result.debugLogs.join('\n') : ''
        };
    }

    return { success: true, message: `✅ Cost optimized! Chose seller 101: $${finalResult.totals.total}` };
});

runner.addTest("Free shipping threshold test", () => {
    const cards = [
        { id: 1, name: "Expensive Card", quantity: 1, isFoil: false }
    ];
    const sellers = {
        1: [
            { sellerId: 101, price: 10.00, quantity: 10, shippingPrice: 1.99, sellerShippingPrice: 0 } // Free shipping if >=$5
        ]
    };

    const { cardRequests, sellerOptions } = runner.createTestData(cards, sellers);
    const result = greedySetCoverSolver(cardRequests, sellerOptions);

    if (!result.success) {
        return { 
            success: false, 
            message: "Algorithm failed: " + result.message,
            debugInfo: result.debugLogs ? result.debugLogs.join('\n') : ''
        };
    }

    const finalResult = calculateFinalCosts(result.solution);
    
    // Should be $10.00 + $0.00 shipping = $10.00 (free shipping applies)
    if (Math.abs(finalResult.totals.shipping - 0) > 0.01) {
        return { 
            success: false, 
            message: `Expected free shipping ($0), got $${finalResult.totals.shipping}`,
            debugInfo: result.debugLogs ? result.debugLogs.join('\n') : ''
        };
    }

    if (Math.abs(finalResult.totals.total - 10.00) > 0.01) {
        return { 
            success: false, 
            message: `Expected total $10.00, got $${finalResult.totals.total}`,
            debugInfo: result.debugLogs ? result.debugLogs.join('\n') : ''
        };
    }

    return { success: true, message: `✅ Free shipping applied correctly! Total: $${finalResult.totals.total}` };
});

runner.addTest("CRITICAL: Shipping consolidation stress test", () => {
    const cards = [
        { id: 1, name: "Card A", quantity: 1, isFoil: false },
        { id: 2, name: "Card B", quantity: 1, isFoil: false },
        { id: 3, name: "Card C", quantity: 1, isFoil: false }
    ];
    const sellers = {
        1: [
            { sellerId: 101, price: 2.00, quantity: 10, shippingPrice: 5.99, sellerShippingPrice: 5.99 }
        ],
        2: [
            { sellerId: 101, price: 2.00, quantity: 10, shippingPrice: 5.99, sellerShippingPrice: 5.99 }, // Same seller
            { sellerId: 102, price: 1.90, quantity: 10, shippingPrice: 5.99, sellerShippingPrice: 5.99 }  // Different seller
        ],
        3: [
            { sellerId: 101, price: 2.00, quantity: 10, shippingPrice: 5.99, sellerShippingPrice: 5.99 }, // Same seller
            { sellerId: 103, price: 1.95, quantity: 10, shippingPrice: 5.99, sellerShippingPrice: 5.99 }  // Different seller
        ]
    };

    const { cardRequests, sellerOptions } = runner.createTestData(cards, sellers);
    const result = greedySetCoverSolver(cardRequests, sellerOptions);

    if (!result.success) {
        return { 
            success: false, 
            message: "Algorithm failed: " + result.message,
            debugInfo: result.debugLogs ? result.debugLogs.join('\n') : ''
        };
    }

    const finalResult = calculateFinalCosts(result.solution);
    
    // All cards from seller 101: 3 * $2.00 + $5.99 = $11.99
    // vs 3 separate sellers: 1.90 + 1.95 + 2.00 + 3*5.99 = $23.82
    // Should definitely consolidate to seller 101
    
    if (finalResult.sellers.length !== 1 || finalResult.sellers[0].sellerId !== 101) {
        return { 
            success: false, 
            message: `Should consolidate to seller 101, got ${finalResult.sellers.length} sellers (first: ${finalResult.sellers[0]?.sellerId})`,
            debugInfo: result.debugLogs ? result.debugLogs.join('\n') : ''
        };
    }

    if (Math.abs(finalResult.totals.shipping - 5.99) > 0.01) {
        return { 
            success: false, 
            message: `Shipping not consolidated! Expected $5.99, got $${finalResult.totals.shipping}`,
            debugInfo: result.debugLogs ? result.debugLogs.join('\n') : ''
        };
    }

    const expectedTotal = 6.00 + 5.99; // $11.99
    if (Math.abs(finalResult.totals.total - expectedTotal) > 0.01) {
        return { 
            success: false, 
            message: `Expected total $${expectedTotal}, got $${finalResult.totals.total}`,
            debugInfo: result.debugLogs ? result.debugLogs.join('\n') : ''
        };
    }

    return { 
        success: true, 
        message: `✅ CRITICAL PASS! Perfect shipping consolidation: $${finalResult.totals.total} total, $${finalResult.totals.shipping} shipping` 
    };
});

runner.addTest("CRITICAL: Real-world consolidation bug", () => {
    // This reproduces the exact bug reported by the user
    const cards = [
        { id: 1, name: "Card A", quantity: 1, isFoil: false },
        { id: 2, name: "Card B", quantity: 1, isFoil: false }
    ];
    const sellers = {
        1: [
            // Card A: Only available from Seller C (forces C to be selected)
            { sellerId: 'C', price: 10.00, quantity: 10, shippingPrice: 1.31, sellerShippingPrice: 1.31 }
        ],
        2: [
            // Card B: Available from both C and D
            { sellerId: 'C', price: 2.13, quantity: 10, shippingPrice: 1.31, sellerShippingPrice: 1.31 },
            { sellerId: 'D', price: 1.86, quantity: 10, shippingPrice: 1.31, sellerShippingPrice: 1.31 }
        ]
    };

    const { cardRequests, sellerOptions } = runner.createTestData(cards, sellers);
    const result = greedySetCoverSolver(cardRequests, sellerOptions);

    if (!result.success) {
        return { 
            success: false, 
            message: "Algorithm failed: " + result.message,
            debugInfo: result.debugLogs ? result.debugLogs.join('\n') : ''
        };
    }

    const finalResult = calculateFinalCosts(result.solution);
    
    // Key insight: If algorithm picks BOTH C and D, it's wrong!
    // Correct: Only C should be used (consolidation saves money)
    // C for both: $10.00 + $2.13 + $1.31 shipping = $13.44
    // Wrong split: D for B ($1.86 + $1.31) + C for A ($10.00 + $1.31) = $14.48
    
    const sellerIds = finalResult.sellers.map(s => s.sellerId).sort();
    
    if (sellerIds.length === 1 && sellerIds[0] === 'C') {
        return { success: true, message: `✅ PERFECT! Only seller C used, total: $${finalResult.totals.total}` };
    } else if (sellerIds.includes('C') && sellerIds.includes('D')) {
        const wrongTotal = finalResult.totals.total;
        const correctTotal = 10.00 + 2.13 + 1.31;
        return { 
            success: false, 
            message: `❌ CONSOLIDATION FAILURE! Used both C and D (total: $${wrongTotal}) instead of just C ($${correctTotal})`,
            debugInfo: result.debugLogs ? result.debugLogs.join('\n') : ''
        };
    } else {
        return { 
            success: false, 
            message: `Unexpected seller combination: ${sellerIds.join(', ')}` 
        };
    }
});

// Run all tests
runner.runAllTests();