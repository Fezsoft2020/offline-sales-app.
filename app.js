// Inventory & Sales Management System for iPhone Safari
// Enhanced with mobile optimizations

let db;
const exchangeRate = 2500; // 1 USD = 2500 TSH
let stockChart = null;

// Detect iOS Safari
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
const isMobileSafari = isIOS && isSafari;

// App state
let stockData = [];
let salesData = [];
let fallbackMode = false;
const fallbackKey = 'inventory_sales_data_v2';

// Toast notification system
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icons = {
        success: 'check-circle',
        error: 'exclamation-circle',
        warning: 'exclamation-triangle',
        info: 'info-circle'
    };
    
    toast.innerHTML = `
        <i class="fas fa-${icons[type]}"></i>
        <span>${message}</span>
    `;
    
    toast.style.cssText = `
        position: fixed;
        top: ${isMobileSafari ? '80px' : '20px'};
        right: 20px;
        background: ${type === 'success' ? '#4CAF50' : 
                     type === 'error' ? '#f44336' : 
                     type === 'warning' ? '#ff9800' : '#2196F3'};
        color: white;
        padding: 15px 20px;
        border-radius: 10px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 9999;
        display: flex;
        align-items: center;
        gap: 10px;
        animation: slideIn 0.3s ease;
        max-width: 300px;
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Loading states
function showLoading(message = "Loading...") {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.style.display = 'flex';
        const messageDiv = loading.querySelector('.loading-content div');
        if (messageDiv) {
            messageDiv.textContent = message;
        }
    }
}

function hideLoading() {
    setTimeout(() => {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = 'none';
        }
    }, 300);
}

// Initialize IndexedDB
function initDatabase() {
    try {
        const request = indexedDB.open('InventorySalesDB', 3);
        
        request.onupgradeneeded = function(event) {
            const db = event.target.result;
            
            // Create stock store
            if (!db.objectStoreNames.contains('stock')) {
                const stockStore = db.createObjectStore('stock', { keyPath: 'name' });
                stockStore.createIndex('name', 'name', { unique: true });
            }
            
            // Create sales store
            if (!db.objectStoreNames.contains('sales')) {
                const salesStore = db.createObjectStore('sales', { autoIncrement: true });
                salesStore.createIndex('staff', 'staff', { unique: false });
                salesStore.createIndex('date', 'date', { unique: false });
                salesStore.createIndex('item', 'name', { unique: false });
            }
        };
        
        request.onsuccess = function(event) {
            db = event.target.result;
            console.log('Database opened successfully');
            
            // Check storage limits on iOS
            if (isIOS) {
                checkStorageLimit();
            }
            
            showLoading();
            loadStock();
            loadSales();
            setTimeout(hideLoading, 500);
        };
        
        request.onerror = function(event) {
            console.error('IndexedDB error:', event.target.error);
            
            // Fallback to localStorage for iOS
            if (isIOS) {
                showToast('Using local storage fallback', 'warning');
                initFallbackStorage();
            } else {
                showToast('Failed to initialize database. Please refresh.', 'error');
            }
        };
    } catch (error) {
        console.error('Error initializing database:', error);
        if (isIOS) {
            initFallbackStorage();
        }
    }
}

// Fallback storage for iOS
function initFallbackStorage() {
    try {
        fallbackMode = true;
        const saved = localStorage.getItem(fallbackKey);
        
        if (saved) {
            const data = JSON.parse(saved);
            stockData = data.stock || [];
            salesData = data.sales || [];
            updateStockTable();
            updateSalesTable();
            updateDashboard();
            showToast('Data loaded from local storage', 'success');
        } else {
            stockData = [];
            salesData = [];
        }
        
        updateStockDropdown();
    } catch (error) {
        console.error('Error in fallback storage:', error);
        stockData = [];
        salesData = [];
        showToast('Error loading data', 'error');
    }
}

function saveFallbackData() {
    if (fallbackMode) {
        try {
            const data = {
                stock: stockData,
                sales: salesData,
                lastSaved: new Date().toISOString()
            };
            localStorage.setItem(fallbackKey, JSON.stringify(data));
        } catch (error) {
            console.error('Error saving fallback data:', error);
        }
    }
}

// Check storage limit on iOS
function checkStorageLimit() {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
        navigator.storage.estimate().then(({ usage, quota }) => {
            const percentUsed = (usage / quota) * 100;
            if (percentUsed > 80) {
                showToast('Storage is getting full. Consider exporting data.', 'warning');
            }
        }).catch(error => {
            console.error('Storage estimate error:', error);
        });
    }
}

// Load stock data
function loadStock() {
    if (fallbackMode) {
        updateStockDropdown();
        updateStockTable();
        checkLowStock();
        return;
    }
    
    if (!db) {
        console.error('Database not initialized');
        return;
    }
    
    try {
        const tx = db.transaction('stock', 'readonly');
        const store = tx.objectStore('stock');
        const req = store.getAll();
        
        req.onsuccess = function() {
            stockData = req.result || [];
            updateStockDropdown();
            updateStockTable();
            checkLowStock();
        };
        
        req.onerror = function() {
            console.error('Failed to load stock');
            stockData = [];
            updateStockTable();
        };
    } catch (error) {
        console.error('Error loading stock:', error);
        stockData = [];
        updateStockTable();
    }
}

// Check for low stock items
function checkLowStock() {
    const lowStockItems = stockData.filter(item => item.qty < 10 && item.qty > 0);
    const criticalStockItems = stockData.filter(item => item.qty === 0);
    
    const alertDiv = document.getElementById('lowStockAlert');
    if (!alertDiv) return;
    
    if (lowStockItems.length === 0 && criticalStockItems.length === 0) {
        alertDiv.style.display = 'none';
        return;
    }
    
    let alertText = '<i class="fas fa-exclamation-triangle"></i> ';
    
    if (criticalStockItems.length > 0) {
        alertText += `<strong>Out of stock:</strong> ${criticalStockItems.map(i => i.name).join(', ')}`;
        // Vibrate on critical stock (if supported)
        if (navigator.vibrate && isMobileSafari) {
            navigator.vibrate([200, 100, 200]);
        }
    }
    
    if (lowStockItems.length > 0) {
        if (criticalStockItems.length > 0) alertText += ' | ';
        alertText += `<strong>Low stock:</strong> ${lowStockItems.map(i => i.name).join(', ')}`;
    }
    
    alertDiv.innerHTML = alertText + 
        ' <button class="btn btn-small" onclick="this.parentElement.style.display=\'none\'" style="padding: 8px 12px; font-size: 0.85rem;">' +
        '<i class="fas fa-times"></i> Dismiss</button>';
    alertDiv.style.display = 'flex';
}

// Update stock dropdown
function updateStockDropdown() {
    const saleItem = document.getElementById('saleItem');
    const staffFilter = document.getElementById('staffFilter');
    
    if (saleItem) {
        saleItem.innerHTML = '<option value="">Select an item</option>';
        
        stockData.forEach(item => {
            const option = document.createElement('option');
            option.value = item.name;
            const status = item.qty === 0 ? ' (Out of stock)' : item.qty < 10 ? ' (Low stock)' : '';
            option.text = `${item.name} - ${item.qty}${status}`;
            option.disabled = item.qty === 0;
            saleItem.add(option);
        });
    }
    
    // Update staff filter
    if (staffFilter) {
        staffFilter.innerHTML = '<option value="">All Staff</option>';
        if (salesData && salesData.length > 0) {
            const staffSet = new Set(salesData.map(s => s.staff).filter(Boolean));
            staffSet.forEach(staff => {
                const option = document.createElement('option');
                option.value = staff;
                option.text = staff;
                staffFilter.add(option);
            });
        }
    }
}

// Prefill selling price
function prefillSellPrice() {
    const name = document.getElementById('saleItem')?.value;
    if (!name) return;
    
    const item = stockData.find(i => i.name === name);
    const qtyInput = document.getElementById('saleQty');
    const priceInput = document.getElementById('salePrice');
    
    if (item && priceInput) {
        priceInput.value = item.sell.toFixed(2);
        
        if (qtyInput) {
            qtyInput.max = item.qty;
            qtyInput.placeholder = `Max: ${item.qty}`;
            
            // Color code based on stock level
            if (item.qty === 0) {
                qtyInput.style.borderColor = '#f44336';
                qtyInput.disabled = true;
            } else if (item.qty < 10) {
                qtyInput.style.borderColor = '#ff9800';
                qtyInput.disabled = false;
            } else {
                qtyInput.style.borderColor = '#4CAF50';
                qtyInput.disabled = false;
            }
        }
    } else if (qtyInput) {
        qtyInput.style.borderColor = '#e0e0e0';
        qtyInput.disabled = false;
        qtyInput.placeholder = 'Enter quantity';
    }
}

// Update stock table
function updateStockTable() {
    const tableBody = document.getElementById('stockTableBody');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    let totalValue = 0;
    
    stockData.forEach(item => {
        const row = tableBody.insertRow();
        
        // Add CSS classes for low/critical stock
        if (item.qty === 0) {
            row.classList.add('critical-stock');
        } else if (item.qty < 10) {
            row.classList.add('low-stock');
        }
        
        const itemValue = item.qty * item.cost;
        totalValue += itemValue;
        
        // Escape single quotes in item name
        const escapedName = item.name.replace(/'/g, "\\'");
        
        row.innerHTML = `
            <td><strong>${item.name}</strong></td>
            <td>${item.qty}</td>
            <td>${item.cost.toFixed(2)}</td>
            <td>${item.sell.toFixed(2)}</td>
            <td>${itemValue.toFixed(2)}</td>
            <td>
                <button class="delete-btn" onclick="deleteItem('${escapedName}')" title="Delete item">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
    });
    
    // Add total row
    if (stockData.length > 0) {
        const totalRow = tableBody.insertRow();
        totalRow.classList.add('low-stock');
        totalRow.innerHTML = `
            <td><strong>TOTAL</strong></td>
            <td><strong>${stockData.reduce((sum, item) => sum + item.qty, 0)}</strong></td>
            <td colspan="2"></td>
            <td><strong>${totalValue.toFixed(2)}</strong></td>
            <td></td>
        `;
    }
    
    const totalItemsEl = document.getElementById('totalItems');
    if (totalItemsEl) {
        totalItemsEl.textContent = stockData.length;
    }
}

// Add shipment
function addShipment() {
    const name = document.getElementById('shipmentItem')?.value?.trim();
    const qtyInput = document.getElementById('shipmentQty')?.value;
    const costInput = document.getElementById('shipmentPrice')?.value;
    const sellInput = document.getElementById('shipmentSell')?.value;
    
    // Validation
    if (!name) {
        showToast('Please enter item name', 'error');
        return;
    }
    
    const qty = parseInt(qtyInput);
    const cost = parseFloat(costInput);
    const sell = parseFloat(sellInput);
    
    if (isNaN(qty) || qty <= 0) {
        showToast('Please enter valid quantity', 'error');
        return;
    }
    
    if (isNaN(cost) || cost <= 0) {
        showToast('Please enter valid cost price', 'error');
        return;
    }
    
    if (isNaN(sell) || sell <= 0) {
        showToast('Please enter valid selling price', 'error');
        return;
    }
    
    if (sell < cost) {
        if (!confirm('⚠️ Selling price is lower than cost price. Continue?')) {
            return;
        }
    }

    showLoading('Adding shipment...');
    
    if (fallbackMode) {
        // Fallback mode
        const existingIndex = stockData.findIndex(i => i.name === name);
        if (existingIndex >= 0) {
            stockData[existingIndex].qty += qty;
            stockData[existingIndex].cost = cost;
            stockData[existingIndex].sell = sell;
        } else {
            stockData.push({ name, qty, cost, sell });
        }
        saveFallbackData();
        loadStock();
        hideLoading();
        showToast('Shipment added successfully!', 'success');
    } else {
        // IndexedDB mode
        try {
            const tx = db.transaction('stock', 'readwrite');
            const store = tx.objectStore('stock');
            const getReq = store.get(name);
            
            getReq.onsuccess = function() {
                let data = getReq.result;
                if (data) {
                    data.qty += qty;
                    data.cost = cost;
                    data.sell = sell;
                } else {
                    data = { name, qty, cost, sell };
                }
                store.put(data);
            };
            
            tx.oncomplete = () => {
                loadStock();
                hideLoading();
                showToast('Shipment added successfully!', 'success');
                
                // Haptic feedback on iOS
                if (isMobileSafari && navigator.vibrate) {
                    navigator.vibrate(50);
                }
            };
            
            tx.onerror = (error) => {
                hideLoading();
                console.error('Transaction error:', error);
                showToast('Error adding shipment', 'error');
            };
        } catch (error) {
            hideLoading();
            console.error('Error in addShipment:', error);
            showToast('Error adding shipment', 'error');
        }
    }
    
    // Clear form
    setTimeout(() => {
        const shipmentItem = document.getElementById('shipmentItem');
        const shipmentQty = document.getElementById('shipmentQty');
        const shipmentPrice = document.getElementById('shipmentPrice');
        const shipmentSell = document.getElementById('shipmentSell');
        
        if (shipmentItem) shipmentItem.value = '';
        if (shipmentQty) shipmentQty.value = '';
        if (shipmentPrice) shipmentPrice.value = '';
        if (shipmentSell) shipmentSell.value = '';
    }, 300);
}

// Delete item
function deleteItem(itemName) {
    if (!confirm(`Are you sure you want to delete "${itemName}" from stock?`)) return;
    
    showLoading('Deleting item...');
    
    if (fallbackMode) {
        stockData = stockData.filter(item => item.name !== itemName);
        saveFallbackData();
        loadStock();
        hideLoading();
        showToast('Item deleted', 'success');
    } else {
        try {
            const tx = db.transaction('stock', 'readwrite');
            const store = tx.objectStore('stock');
            store.delete(itemName);
            
            tx.oncomplete = () => {
                loadStock();
                hideLoading();
                showToast('Item deleted', 'success');
            };
            
            tx.onerror = () => {
                hideLoading();
                showToast('Error deleting item', 'error');
            };
        } catch (error) {
            hideLoading();
            console.error('Error deleting item:', error);
            showToast('Error deleting item', 'error');
        }
    }
}

// Load sales data
function loadSales() {
    if (fallbackMode) {
        updateSalesTable();
        updateDashboard();
        return;
    }
    
    if (!db) {
        console.error('Database not initialized');
        return;
    }
    
    try {
        const tx = db.transaction('sales', 'readonly');
        const store = tx.objectStore('sales');
        const req = store.getAll();
        
        req.onsuccess = function() {
            salesData = req.result || [];
            updateSalesTable();
            updateDashboard();
            updateStockDropdown(); // Update staff filter
        };
        
        req.onerror = function() {
            console.error('Failed to load sales');
            salesData = [];
            updateSalesTable();
        };
    } catch (error) {
        console.error('Error loading sales:', error);
        salesData = [];
        updateSalesTable();
    }
}

// Update sales table
function updateSalesTable() {
    const tableBody = document.getElementById('salesTableBody');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    // Show only last 50 sales for performance
    const displaySales = salesData.slice(-50).reverse();
    
    displaySales.forEach((sale, index) => {
        const row = tableBody.insertRow();
        const saleDate = new Date(sale.date);
        const revenue = sale.revenue || (sale.qty * sale.sellPrice);
        
        let saleId;
        if (fallbackMode) {
            saleId = salesData.length - 1 - index; // Reverse index for fallback
        } else {
            saleId = sale.id || sale.key || (salesData.length - index);
        }
        
        row.innerHTML = `
            <td>${saleDate.toLocaleDateString()}<br><small>${saleDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</small></td>
            <td>${sale.staff}</td>
            <td>${sale.name}</td>
            <td>${sale.qty}</td>
            <td>${revenue.toFixed(2)}</td>
            <td>
                <button class="delete-btn" onclick="deleteSale(${saleId})" title="Undo sale">
                    <i class="fas fa-undo"></i>
                </button>
            </td>
        `;
    });
    
    // Show count if more sales exist
    if (salesData.length > 50) {
        const row = tableBody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 6;
        cell.style.textAlign = 'center';
        cell.style.padding = '15px';
        cell.style.color = '#666';
        cell.innerHTML = `Showing 50 most recent sales of ${salesData.length} total`;
    }
    
    const totalSalesEl = document.getElementById('totalSales');
    if (totalSalesEl) {
        totalSalesEl.textContent = salesData.length;
    }
}

// Add sale
function addSale() {
    const staff = document.getElementById('staffName')?.value?.trim() || 'Unknown';
    const name = document.getElementById('saleItem')?.value;
    const qtyInput = document.getElementById('saleQty')?.value;
    const sellPriceInput = document.getElementById('salePrice')?.value;
    
    if (!name) {
        showToast('Please select an item', 'error');
        return;
    }
    
    const qty = parseInt(qtyInput);
    const sellPrice = parseFloat(sellPriceInput);
    
    if (isNaN(qty) || qty <= 0) {
        showToast('Please enter valid quantity', 'error');
        return;
    }
    
    if (isNaN(sellPrice) || sellPrice <= 0) {
        showToast('Please enter valid selling price', 'error');
        return;
    }
    
    const item = stockData.find(i => i.name === name);
    if (!item) {
        showToast('Item not found in stock', 'error');
        return;
    }
    
    if (item.qty < qty) {
        showToast(`Only ${item.qty} available in stock`, 'error');
        return;
    }

    showLoading('Recording sale...');
    
    const saleRecord = {
        staff,
        name,
        qty,
        sellPrice,
        cost: item.cost,
        date: new Date(),
        revenue: qty * sellPrice,
        profit: qty * (sellPrice - item.cost)
    };
    
    if (fallbackMode) {
        // Update stock
        const stockIndex = stockData.findIndex(i => i.name === name);
        if (stockIndex >= 0) {
            stockData[stockIndex].qty -= qty;
        }
        
        // Add sale
        salesData.push(saleRecord);
        saveFallbackData();
        
        loadStock();
        loadSales();
        hideLoading();
        showToast('Sale recorded!', 'success');
    } else {
        try {
            const tx = db.transaction(['stock', 'sales'], 'readwrite');
            const stockStore = tx.objectStore('stock');
            const saleStore = tx.objectStore('sales');
            
            // Update stock
            item.qty -= qty;
            stockStore.put(item);
            
            // Add sale
            saleStore.add(saleRecord);
            
            tx.oncomplete = () => {
                loadStock();
                loadSales();
                hideLoading();
                showToast('Sale recorded!', 'success');
                
                // Haptic feedback
                if (isMobileSafari && navigator.vibrate) {
                    navigator.vibrate(100);
                }
            };
            
            tx.onerror = (error) => {
                hideLoading();
                console.error('Transaction error:', error);
                showToast('Error recording sale', 'error');
            };
        } catch (error) {
            hideLoading();
            console.error('Error in addSale:', error);
            showToast('Error recording sale', 'error');
        }
    }
    
    // Clear form
    const saleQty = document.getElementById('saleQty');
    const staffName = document.getElementById('staffName');
    
    if (saleQty) saleQty.value = '';
    if (staffName) staffName.value = '';
    prefillSellPrice();
}

// Delete/undo sale
function deleteSale(saleId) {
    if (!confirm('Undo this sale and restore stock?')) return;
    
    showLoading('Undoing sale...');
    
    if (fallbackMode) {
        // Find sale by index
        const saleIndex = salesData.findIndex((s, i) => i === saleId);
        if (saleIndex >= 0) {
            const sale = salesData[saleIndex];
            
            // Restore stock
            const stockIndex = stockData.findIndex(i => i.name === sale.name);
            if (stockIndex >= 0) {
                stockData[stockIndex].qty += sale.qty;
            }
            
            // Remove sale
            salesData.splice(saleIndex, 1);
            saveFallbackData();
            
            loadStock();
            loadSales();
            hideLoading();
            showToast('Sale undone!', 'success');
        } else {
            hideLoading();
            showToast('Sale not found', 'error');
        }
    } else {
        try {
            const tx = db.transaction(['sales', 'stock'], 'readwrite');
            const saleStore = tx.objectStore('sales');
            const stockStore = tx.objectStore('stock');
            
            const getSale = saleStore.get(saleId);
            
            getSale.onsuccess = function() {
                const sale = getSale.result;
                if (!sale) {
                    hideLoading();
                    showToast('Sale not found', 'error');
                    return;
                }
                
                const getItem = stockStore.get(sale.name);
                getItem.onsuccess = function() {
                    const item = getItem.result;
                    if (item) {
                        item.qty += sale.qty;
                        stockStore.put(item);
                    }
                    saleStore.delete(saleId);
                };
            };
            
            tx.oncomplete = () => {
                loadStock();
                loadSales();
                hideLoading();
                showToast('Sale undone!', 'success');
            };
            
            tx.onerror = () => {
                hideLoading();
                showToast('Error undoing sale', 'error');
            };
        } catch (error) {
            hideLoading();
            console.error('Error deleting sale:', error);
            showToast('Error undoing sale', 'error');
        }
    }
}

// Update dashboard
function updateDashboard() {
    const filter = document.getElementById('filter')?.value || 'all';
    const staffFilter = document.getElementById('staffFilter')?.value || '';
    const searchTerm = (document.getElementById('searchSales')?.value || '').toLowerCase();
    
    let revenue = 0, profit = 0, salesCount = 0;
    const now = new Date();
    
    const filteredSales = salesData.filter(sale => {
        const saleDate = new Date(sale.date);
        let include = true;
        
        // Time filter
        if (filter === 'today') {
            include = saleDate.toDateString() === now.toDateString();
        } else if (filter === 'month') {
            include = saleDate.getMonth() === now.getMonth() && 
                     saleDate.getFullYear() === now.getFullYear();
        }
        
        // Staff filter
        if (include && staffFilter) {
            include = sale.staff === staffFilter;
        }
        
        // Search filter
        if (include && searchTerm) {
            include = sale.name.toLowerCase().includes(searchTerm) || 
                     sale.staff.toLowerCase().includes(searchTerm);
        }
        
        return include;
    });
    
    filteredSales.forEach(sale => {
        revenue += sale.revenue || (sale.qty * sale.sellPrice);
        profit += sale.profit || (sale.qty * (sale.sellPrice - sale.cost));
        salesCount++;
    });
    
    const totalRevenueEl = document.getElementById('totalRevenue');
    const totalRevenueUSDEl = document.getElementById('totalRevenueUSD');
    const totalProfitEl = document.getElementById('totalProfit');
    const totalSalesEl = document.getElementById('totalSales');
    
    if (totalRevenueEl) totalRevenueEl.textContent = revenue.toFixed(2);
    if (totalRevenueUSDEl) totalRevenueUSDEl.textContent = (revenue / exchangeRate).toFixed(2) + ' USD';
    if (totalProfitEl) totalProfitEl.textContent = profit.toFixed(2);
    if (totalSalesEl) totalSalesEl.textContent = salesCount;
    
    updateChart();
}

// Update chart
function updateChart() {
    const ctx = document.getElementById('stockChart');
    if (!ctx) return;
    
    // Take top 10 items by value
    const items = [...stockData]
        .sort((a, b) => (b.qty * b.cost) - (a.qty * a.cost))
        .slice(0, 10);
    
    if (items.length === 0) {
        // Clear chart if no data
        if (stockChart) {
            stockChart.destroy();
            stockChart = null;
        }
        return;
    }
    
    const labels = items.map(i => i.name.length > 10 ? i.name.substring(0, 10) + '...' : i.name);
    const data = items.map(i => i.qty);
    
    const colors = data.map((qty, index) => {
        const item = items[index];
        if (item.qty === 0) return '#ff5252'; // Red for out of stock
        if (item.qty < 10) return '#ff9800'; // Orange for low stock
        return '#4caf50'; // Green for good stock
    });
    
    if (stockChart) {
        stockChart.destroy();
    }
    
    stockChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Stock Quantity',
                data,
                backgroundColor: colors,
                borderColor: '#2c3e50',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const item = items[context.dataIndex];
                            const value = item.qty * item.cost;
                            return `${item.qty} units (${value.toFixed(2)} TSH)`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Quantity'
                    }
                },
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 0
                    }
                }
            }
        }
    });
}

// Export to Excel
function exportExcel() {
    showLoading('Generating Excel file...');
    
    try {
        const wb = XLSX.utils.book_new();
        
        // Stock sheet
        const stockDataForExport = [
            ["Item", "Quantity", "Cost Price (TSH)", "Selling Price (TSH)", "Total Value (TSH)", "Status"]
        ];
        
        stockData.forEach(item => {
            const status = item.qty === 0 ? 'Out of Stock' : item.qty < 10 ? 'Low Stock' : 'In Stock';
            stockDataForExport.push([
                item.name,
                item.qty,
                item.cost,
                item.sell,
                item.qty * item.cost,
                status
            ]);
        });
        
        const stockWs = XLSX.utils.aoa_to_sheet(stockDataForExport);
        XLSX.utils.book_append_sheet(wb, stockWs, "Stock");
        
        // Sales sheet
        const salesDataForExport = [
            ["Date", "Staff", "Item", "Quantity", "Sell Price (TSH)", "Revenue (TSH)", "Profit (TSH)"]
        ];
        
        salesData.slice(-1000).forEach(sale => {
            salesDataForExport.push([
                new Date(sale.date).toLocaleString(),
                sale.staff,
                sale.name,
                sale.qty,
                sale.sellPrice,
                sale.revenue || (sale.qty * sale.sellPrice),
                sale.profit || (sale.qty * (sale.sellPrice - sale.cost))
            ]);
        });
        
        const salesWs = XLSX.utils.aoa_to_sheet(salesDataForExport);
        XLSX.utils.book_append_sheet(wb, salesWs, "Sales");
        
        // Summary sheet
        const totalStockValue = stockData.reduce((sum, item) => sum + (item.qty * item.cost), 0);
        const totalRevenue = salesData.reduce((sum, sale) => sum + (sale.revenue || (sale.qty * sale.sellPrice)), 0);
        const totalProfit = salesData.reduce((sum, sale) => sum + (sale.profit || (sale.qty * (sale.sellPrice - sale.cost))), 0);
        
        const summaryData = [
            ["Inventory & Sales Summary"],
            ["Generated", new Date().toLocaleString()],
            ["Total Items in Stock", stockData.length],
            ["Total Stock Value", totalStockValue.toFixed(2)],
            ["Total Sales", salesData.length],
            ["Total Revenue", totalRevenue.toFixed(2)],
            ["Total Profit", totalProfit.toFixed(2)],
            ["Exchange Rate", `1 USD = ${exchangeRate} TSH`]
        ];
        
        const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");
        
        const fileName = `Inventory_Report_${new Date().toISOString().slice(0,10)}.xlsx`;
        XLSX.writeFile(wb, fileName);
        
        hideLoading();
        showToast('Excel file exported successfully!', 'success');
    } catch (error) {
        hideLoading();
        console.error('Export error:', error);
        showToast('Error exporting to Excel', 'error');
    }
}

// Export to PDF
function exportPDF() {
    showLoading('Generating PDF...');
    
    setTimeout(() => {
        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            // Header
            doc.setFontSize(18);
            doc.text("Inventory & Sales Report", 14, 20);
            doc.setFontSize(10);
            doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
            doc.text(`Exchange Rate: 1 USD = ${exchangeRate} TSH`, 14, 34);
            
            let y = 45;
            
            // Stock Summary
            doc.setFontSize(12);
            doc.text("Stock Summary", 14, y);
            y += 8;
            
            doc.setFontSize(10);
            stockData.slice(0, 20).forEach(item => {
                const value = item.qty * item.cost;
                const status = item.qty === 0 ? ' (Out of Stock)' : item.qty < 10 ? ' (Low Stock)' : '';
                doc.text(`${item.name}: ${item.qty} units = ${value.toFixed(2)} TSH${status}`, 20, y);
                y += 6;
                if (y > 270) { doc.addPage(); y = 20; }
            });
            
            y += 8;
            doc.setFontSize(12);
            doc.text("Recent Sales", 14, y);
            y += 8;
            
            doc.setFontSize(10);
            salesData.slice(-20).reverse().forEach(sale => {
                const revenue = sale.revenue || (sale.qty * sale.sellPrice);
                doc.text(`${new Date(sale.date).toLocaleDateString()} ${sale.staff}: ${sale.qty}x ${sale.name} = ${revenue.toFixed(2)} TSH`, 20, y);
                y += 6;
                if (y > 270) { doc.addPage(); y = 20; }
            });
            
            // Summary
            y += 8;
            doc.setFontSize(12);
            doc.text("Summary", 14, y);
            y += 8;
            
            doc.setFontSize(10);
            const totalValue = stockData.reduce((sum, item) => sum + (item.qty * item.cost), 0);
            const totalRevenue = salesData.reduce((sum, sale) => sum + (sale.revenue || (sale.qty * sale.sellPrice)), 0);
            
            doc.text(`Total Items: ${stockData.length}`, 20, y); y += 6;
            doc.text(`Total Stock Value: ${totalValue.toFixed(2)} TSH`, 20, y); y += 6;
            doc.text(`Total Sales: ${salesData.length}`, 20, y); y += 6;
            doc.text(`Total Revenue: ${totalRevenue.toFixed(2)} TSH`, 20, y); y += 6;
            doc.text(`Total Revenue (USD): ${(totalRevenue / exchangeRate).toFixed(2)} USD`, 20, y);
            
            const fileName = `Inventory_Report_${new Date().toISOString().slice(0,10)}.pdf`;
            doc.save(fileName);
            
            hideLoading();
            showToast('PDF exported successfully!', 'success');
        } catch (error) {
            hideLoading();
            console.error('PDF export error:', error);
            showToast('Error exporting PDF', 'error');
        }
    }, 500);
}

// Backup data
function backupData() {
    try {
        const backup = {
            stock: stockData,
            sales: salesData,
            exportDate: new Date().toISOString(),
            exchangeRate: exchangeRate,
            version: '2.0'
        };
        
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement("a");
        a.href = url;
        a.download = `Inventory_Backup_${new Date().toISOString().slice(0,10)}.json`;
        
        // iOS Safari requires adding to document
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
        
        showToast('Backup downloaded!', 'success');
    } catch (error) {
        console.error('Backup error:', error);
        showToast('Error creating backup', 'error');
    }
}

// Import CSV data
function importCSVData(csv) {
    const lines = csv.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
        throw new Error('CSV file is empty or invalid');
    }
    
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const importData = [];
    let imported = 0, skipped = 0;
    
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const values = line.split(',').map(v => v.trim());
        if (values.length < 4) {
            skipped++;
            continue;
        }
        
        // Find indices dynamically
        const nameIndex = headers.findIndex(h => h.includes('item') || h.includes('name'));
        const qtyIndex = headers.findIndex(h => h.includes('qty') || h.includes('quantity'));
        const costIndex = headers.findIndex(h => h.includes('cost'));
        const sellIndex = headers.findIndex(h => h.includes('sell') || h.includes('price'));
        
        if (nameIndex === -1 || qtyIndex === -1 || costIndex === -1 || sellIndex === -1) {
            skipped++;
            continue;
        }
        
        const name = values[nameIndex];
        const qty = parseInt(values[qtyIndex]);
        const cost = parseFloat(values[costIndex]);
        const sell = parseFloat(values[sellIndex]);
        
        if (name && !isNaN(qty) && !isNaN(cost) && !isNaN(sell) && qty > 0 && cost > 0) {
            importData.push({ name, qty, cost, sell });
            imported++;
        } else {
            skipped++;
        }
    }
    
    if (importData.length === 0) {
        throw new Error('No valid data found in CSV');
    }
    
    // Process import
    if (fallbackMode) {
        importData.forEach(newItem => {
            const existingIndex = stockData.findIndex(i => i.name === newItem.name);
            if (existingIndex >= 0) {
                stockData[existingIndex].qty += newItem.qty;
                stockData[existingIndex].cost = newItem.cost;
                stockData[existingIndex].sell = newItem.sell;
            } else {
                stockData.push(newItem);
            }
        });
        saveFallbackData();
        loadStock();
        showToast(`Imported ${imported} items (${skipped} skipped)`, 'success');
    } else {
        const tx = db.transaction('stock', 'readwrite');
        const store = tx.objectStore('stock');
        
        importData.forEach(item => {
            const req = store.get(item.name);
            req.onsuccess = function() {
                const existing = req.result;
                if (existing) {
                    existing.qty += item.qty;
                    existing.cost = item.cost;
                    existing.sell = item.sell;
                    store.put(existing);
                } else {
                    store.put(item);
                }
            };
        });
        
        tx.oncomplete = () => {
            loadStock();
            showToast(`Imported ${imported} items (${skipped} skipped)`, 'success');
        };
        
        tx.onerror = () => {
            showToast('Import failed', 'error');
        };
    }
}

// Import JSON data
function importJSONData(data) {
    if (!data.stock || !Array.isArray(data.stock)) {
        throw new Error('Invalid JSON: Missing stock data');
    }
    
    if (fallbackMode) {
        stockData = data.stock;
        salesData = data.sales || [];
        saveFallbackData();
        loadStock();
        loadSales();
        showToast('Data imported successfully!', 'success');
    } else {
        try {
            const tx = db.transaction(['stock', 'sales'], 'readwrite');
            const stockStore = tx.objectStore('stock');
            const salesStore = tx.objectStore('sales');
            
            // Clear existing data
            stockStore.clear();
            salesStore.clear();
            
            // Import new data
            data.stock.forEach(item => {
                stockStore.put(item);
            });
            
            if (data.sales && Array.isArray(data.sales)) {
                data.sales.forEach(sale => {
                    salesStore.add(sale);
                });
            }
            
            tx.oncomplete = () => {
                loadStock();
                loadSales();
                showToast('Data imported successfully!', 'success');
            };
            
            tx.onerror = () => {
                showToast('Import failed', 'error');
            };
        } catch (error) {
            console.error('Import error:', error);
            showToast('Import failed: ' + error.message, 'error');
        }
    }
}

// Setup event listeners
function setupEventListeners() {
    // File import
    const csvImport = document.getElementById('csvImport');
    if (csvImport) {
        csvImport.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;
            
            if (file.size > 10 * 1024 * 1024) { // 10MB limit
                showToast('File too large (max 10MB)', 'error');
                return;
            }
            
            showLoading('Importing data...');
            
            const reader = new FileReader();
            reader.onload = function(event) {
                try {
                    const content = event.target.result;
                    if (file.name.endsWith('.csv')) {
                        importCSVData(content);
                    } else if (file.name.endsWith('.json')) {
                        importJSONData(JSON.parse(content));
                    } else {
                        throw new Error('Unsupported file format');
                    }
                } catch (error) {
                    showToast('Import error: ' + error.message, 'error');
                } finally {
                    hideLoading();
                }
            };
            
            reader.onerror = function() {
                hideLoading();
                showToast('Error reading file', 'error');
            };
            
            reader.readAsText(file);
            e.target.value = ''; // Reset input
        });
    }
    
    // Backup restore
    const restoreBackup = document.getElementById('restoreBackup');
    if (restoreBackup) {
        restoreBackup.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;
            
            if (!file.name.endsWith('.json')) {
                showToast('Please select a JSON backup file', 'error');
                return;
            }
            
            showLoading('Restoring backup...');
            
            const reader = new FileReader();
            reader.onload = function(event) {
                try {
                    const data = JSON.parse(event.target.result);
                    importJSONData(data);
                } catch (error) {
                    showToast('Invalid backup file: ' + error.message, 'error');
                } finally {
                    hideLoading();
                }
            };
            
            reader.readAsText(file);
            e.target.value = '';
        });
    }
    
    // Search with debounce
    const searchSales = document.getElementById('searchSales');
    if (searchSales) {
        let searchTimeout;
        searchSales.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(updateDashboard, 300);
        });
    }
    
    // Staff filter
    const staffFilter = document.getElementById('staffFilter');
    if (staffFilter) {
        staffFilter.addEventListener('change', updateDashboard);
    }
    
    // Time filter
    const filter = document.getElementById('filter');
    if (filter) {
        filter.addEventListener('change', updateDashboard);
    }
    
    // Touch optimizations for iOS
    if (isIOS) {
        // Better touch handling for buttons
        const buttons = document.querySelectorAll('button');
        buttons.forEach(btn => {
            btn.addEventListener('touchstart', function() {
                this.style.opacity = '0.8';
            });
            
            btn.addEventListener('touchend', function() {
                this.style.opacity = '1';
            });
        });
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing Inventory & Sales Management System');
    
    // Set exchange rate display
    const exchangeRateDisplay = document.getElementById('exchangeRateDisplay');
    if (exchangeRateDisplay) {
        exchangeRateDisplay.textContent = exchangeRate.toLocaleString();
    }
    
    // Initialize database
    initDatabase();
    
    // Setup event listeners
    setupEventListeners();
    
    // Setup touch events
    if (isIOS) {
        // Add iOS-specific optimizations
        document.body.classList.add('ios-device');
    }
    
    // Handle orientation changes
    window.addEventListener('orientationchange', function() {
        setTimeout(() => {
            if (stockChart) {
                stockChart.resize();
            }
        }, 300);
    });
    
    // Handle online/offline status
    window.addEventListener('online', function() {
        showToast('Back online', 'success');
    });
    
    window.addEventListener('offline', function() {
        showToast('Working offline - data saved locally', 'warning');
    });
    
    // Check if standalone PWA
    if (window.navigator.standalone) {
        document.body.classList.add('standalone');
        console.log('Running as standalone PWA');
    }
    
    console.log('App initialization complete');
});

// Make functions available globally
window.addShipment = addShipment;
window.addSale = addSale;
window.prefillSellPrice = prefillSellPrice;
window.deleteItem = deleteItem;
window.deleteSale = deleteSale;
window.exportExcel = exportExcel;
window.exportPDF = exportPDF;
window.backupData = backupData;
window.updateDashboard = updateDashboard;
