let shipments = JSON.parse(localStorage.getItem('shipments') || '[]');
let salesReports = JSON.parse(localStorage.getItem('salesReports') || '[]');

function saveData() {
  localStorage.setItem('shipments', JSON.stringify(shipments));
  localStorage.setItem('salesReports', JSON.stringify(salesReports));
  render();
}

function addShipment() {
  const type = document.getElementById('shipmentType').value;
  const pieces = parseInt(document.getElementById('shipmentPieces').value);
  const id = 'SHP' + String(shipments.length + 1).padStart(3, '0');
  shipments.push({id, type, pieces});
  saveData();
}

function addSales() {
  const staffName = document.getElementById('salesStaff').value;
  const shipmentId = document.getElementById('salesShipmentId').value;
  const quantitySold = parseInt(document.getElementById('salesQty').value);
  let report = salesReports.find(r => r.staffName === staffName && r.date === new Date().toDateString());
  if (!report) {
    report = {date: new Date().toDateString(), staffName, entries: []};
    salesReports.push(report);
  }
  report.entries.push({shipmentId, quantitySold});
  saveData();
}

function render() {
  document.getElementById('shipmentsList').innerText = JSON.stringify(shipments, null, 2);
  document.getElementById('salesList').innerText = JSON.stringify(salesReports, null, 2);
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js');
}

render();
