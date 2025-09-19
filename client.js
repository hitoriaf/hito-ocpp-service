// client.js
// OCPP 1.6j Client simulator untuk testing server

const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

// Konfigurasi
const SERVER_URL = 'ws://localhost:8080/v1/ocpp/TEST_CP_001';
const SUBPROTOCOL = 'ocpp1.6';

// OCPP Message Types
const MessageType = {
  CALL: 2,
  CALLRESULT: 3,
  CALLERROR: 4,
};

// State client
let ws;
let isAuthorized = false;
let currentTransactionId = null;
let heartbeatInterval = null;

// Utility functions
function sendCall(action, payload = {}) {
  const id = uuidv4();
  const frame = [MessageType.CALL, id, action, payload];
  console.log(`[CALL =>] ${action} uid=${id}`);
  ws.send(JSON.stringify(frame));
  return id;
}

function sendCallResult(uniqueId, payload = {}) {
  const frame = [MessageType.CALLRESULT, uniqueId, payload];
  console.log(`[RESULT =>] uid=${uniqueId}`);
  ws.send(JSON.stringify(frame));
}

// OCPP Message handlers
function handleIncomingMessage(data) {
  let msg;
  try {
    msg = JSON.parse(data);
  } catch (e) {
    console.error('Invalid JSON received:', data.toString());
    return;
  }

  if (!Array.isArray(msg) || msg.length < 3) {
    console.error('Invalid OCPP frame:', msg);
    return;
  }

  const [typeId, uniqueId, ...rest] = msg;

  if (typeId === MessageType.CALL) {
    // Server mengirim perintah ke kita
    const [action, payload] = rest;
    console.log(`[CALL <=] ${action} uid=${uniqueId}`);
    
    switch (action) {
      case 'RemoteStartTransaction':
        // Simulasi berhasil start transaction
        const response = { status: 'Accepted' };
        sendCallResult(uniqueId, response);
        
        // Auto start transaction setelah beberapa detik
        setTimeout(() => {
          startTransaction(payload.idTag || 'AUTO-TAG', payload.connectorId || 1);
        }, 2000);
        break;
        
      case 'RemoteStopTransaction':
        const stopResponse = { status: 'Accepted' };
        sendCallResult(uniqueId, stopResponse);
        
        // Auto stop transaction
        setTimeout(() => {
          if (currentTransactionId) {
            stopTransaction();
          }
        }, 2000);
        break;
        
      default:
        console.warn(`Unhandled server action: ${action}`);
        const errorFrame = [MessageType.CALLERROR, uniqueId, 'NotImplemented', `Action ${action} not implemented`, {}];
        ws.send(JSON.stringify(errorFrame));
    }
  } else if (typeId === MessageType.CALLRESULT) {
    // Response dari server untuk CALL yang kita kirim
    const [payload] = rest;
    console.log(`[RESULT <=] uid=${uniqueId} payload=${JSON.stringify(payload)}`);
  } else if (typeId === MessageType.CALLERROR) {
    // Error response dari server
    const [errorCode, desc, details] = rest;
    console.log(`[ERROR <=] uid=${uniqueId} ${errorCode}: ${desc}`);
  }
}

// OCPP Actions
function sendBootNotification() {
  return sendCall('BootNotification', {
    chargePointVendor: 'TestVendor',
    chargePointModel: 'TestModel-v1.0',
    chargePointSerialNumber: 'SN-12345',
    firmwareVersion: '1.0.0',
    meterType: 'TestMeter',
    meterSerialNumber: 'MSN-67890'
  });
}

function sendHeartbeat() {
  return sendCall('Heartbeat');
}

function sendAuthorize(idTag) {
  return sendCall('Authorize', { idTag });
}

function sendStatusNotification(connectorId, status, errorCode = 'NoError') {
  return sendCall('StatusNotification', {
    connectorId,
    status, // Available, Preparing, Charging, SuspendedEV, SuspendedEVSE, Finishing, Reserved, Unavailable, Faulted
    errorCode,
    timestamp: new Date().toISOString()
  });
}

function startTransaction(idTag, connectorId) {
  currentTransactionId = sendCall('StartTransaction', {
    connectorId,
    idTag,
    meterStart: Math.floor(Math.random() * 10000),
    timestamp: new Date().toISOString()
  });
  
  // Update status ke Charging
  setTimeout(() => {
    sendStatusNotification(connectorId, 'Charging');
  }, 1000);
  
  // Kirim MeterValues setiap 30 detik
  setInterval(() => {
    if (currentTransactionId) {
      sendMeterValues(connectorId);
    }
  }, 30000);
}

function stopTransaction() {
  if (!currentTransactionId) return;
  
  sendCall('StopTransaction', {
    transactionId: currentTransactionId,
    meterStop: Math.floor(Math.random() * 15000),
    timestamp: new Date().toISOString(),
    reason: 'Local'
  });
  
  currentTransactionId = null;
  
  // Update status ke Available
  setTimeout(() => {
    sendStatusNotification(1, 'Available');
  }, 1000);
}

function sendMeterValues(connectorId) {
  return sendCall('MeterValues', {
    connectorId,
    transactionId: currentTransactionId,
    meterValue: [{
      timestamp: new Date().toISOString(),
      sampledValue: [{
        value: (Math.random() * 50 + 10).toFixed(2), // 10-60 kWh
        unit: 'kWh',
        measurand: 'Energy.Active.Import.Register'
      }, {
        value: (Math.random() * 20 + 5).toFixed(2), // 5-25 kW
        unit: 'kW',
        measurand: 'Power.Active.Import'
      }]
    }]
  });
}

// Demo sequence
function runDemo() {
  console.log('\n=== Starting OCPP Demo Sequence ===');
  
  setTimeout(() => {
    console.log('\n1. Sending BootNotification...');
    sendBootNotification();
  }, 1000);
  
  setTimeout(() => {
    console.log('\n2. Sending StatusNotification (Available)...');
    sendStatusNotification(1, 'Available');
  }, 3000);
  
  setTimeout(() => {
    console.log('\n3. Authorizing ID Tag...');
    sendAuthorize('TEST-CARD-12345');
    isAuthorized = true;
  }, 5000);
  
  setTimeout(() => {
    console.log('\n4. Starting Transaction...');
    startTransaction('TEST-CARD-12345', 1);
  }, 7000);
  
  setTimeout(() => {
    console.log('\n5. Sending MeterValues...');
    sendMeterValues(1);
  }, 10000);
  
  setTimeout(() => {
    console.log('\n6. Stopping Transaction...');
    stopTransaction();
  }, 15000);
  
  // Setup heartbeat setelah boot notification
  setTimeout(() => {
    heartbeatInterval = setInterval(() => {
      console.log('\n💓 Sending Heartbeat...');
      sendHeartbeat();
    }, 30000); // Setiap 30 detik
  }, 4000);
}

// WebSocket connection
function connect() {
  console.log(`Connecting to ${SERVER_URL}...`);
  
  ws = new WebSocket(SERVER_URL, SUBPROTOCOL);
  
  ws.on('open', () => {
    console.log('✅ Connected to OCPP server!');
    runDemo();
  });
  
  ws.on('message', (data) => {
    handleIncomingMessage(data);
  });
  
  ws.on('close', (code, reason) => {
    console.log(`❌ Disconnected: code=${code} reason=${reason ? reason.toString() : 'none'}`);
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
  });
  
  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error.message);
  });
}

// Manual controls (uncomment untuk testing manual)
/*
setTimeout(() => {
  console.log('\nManual controls available:');
  console.log('- sendBootNotification()');
  console.log('- sendAuthorize("TAG-123")');
  console.log('- startTransaction("TAG-123", 1)');
  console.log('- stopTransaction()');
  console.log('- sendMeterValues(1)');
  console.log('- sendStatusNotification(1, "Available")');
}, 20000);
*/

// Start connection
connect();