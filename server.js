// server.js
// CSMS (Central System) minimal untuk OCPP 1.6j via WebSocket
// Menangani: BootNotification, Heartbeat, Authorize, StartTransaction,
// StopTransaction, StatusNotification, MeterValues, DataTransfer sederhana.

const { WebSocketServer } = require('ws');
const { v4: uuidv4 } = require('uuid');
const PORT = process.env.PORT || 8080;

// Simpan state in-memory (untuk demo)
const chargePoints = new Map(); // cpId -> { sockets:Set, lastSeen:Date }
let nextTransactionId = 1;

// --- Util OCPP ---
const MessageType = {
  CALL: 2,
  CALLRESULT: 3,
  CALLERROR: 4,
};

// Kirim CALLRESULT
function sendCallResult(ws, uniqueId, payload = {}) {
  const frame = [MessageType.CALLRESULT, uniqueId, payload];
  ws.send(JSON.stringify(frame));
}

// Kirim CALLERROR (kalau ada action tak didukung/invalid)
function sendCallError(ws, uniqueId, errorCode = 'NotImplemented', errorDescription = '', errorDetails = {}) {
  const frame = [MessageType.CALLERROR, uniqueId, errorCode, errorDescription, errorDetails];
  ws.send(JSON.stringify(frame));
}

// (Opsional) Kirim CALL dari CSMS ke CP, misal RemoteStartTransaction
function sendCall(ws, action, payload = {}) {
  const id = uuidv4();
  const frame = [MessageType.CALL, id, action, payload];
  ws.send(JSON.stringify(frame));
  return id;
}

// Ambil cpId dari URL: ws://host:8080/v1/ocpp/CP_1 atau ws://host:8080/ocpp/CP_1
function extractCpId(url = '') {
  try {
    const u = new URL(url, `ws://localhost:${PORT}`);
    const parts = u.pathname.split('/').filter(Boolean);
    
    // Skema: /v1/ocpp/<cpId>
    if (parts.length >= 3 && parts[0] === 'v1' && parts[1].toLowerCase() === 'ocpp') {
      return parts.slice(2).join('/');
    }
    // Skema: /ocpp/<cpId>
    if (parts.length >= 2 && parts[0].toLowerCase() === 'ocpp') {
      return parts.slice(1).join('/');
    }
    // Fallback: /<cpId>
    return parts[0] || 'unknown';
  } catch {
    return 'unknown';
  }
}

// Validasi frame OCPP 1.6j
function parseOcppMessage(data) {
  let msg;
  try {
    msg = JSON.parse(data);
  } catch {
    return { ok: false, reason: 'InvalidJSON' };
  }
  if (!Array.isArray(msg) || msg.length < 3) {
    return { ok: false, reason: 'InvalidFrame' };
  }
  const [typeId] = msg;
  if (![2, 3, 4].includes(typeId)) {
    return { ok: false, reason: 'InvalidType' };
  }
  return { ok: true, msg };
}

// --- Server ---
const wss = new WebSocketServer({
  port: PORT,
  // Terima semua subprotocol, prioritaskan 'ocpp1.6'
  handleProtocols: (protocols) => {
    console.log('Protocols requested:', protocols);
    if (Array.isArray(protocols)) {
      if (protocols.includes('ocpp1.6')) {
        return 'ocpp1.6';
      }
      // Fallback ke protocol pertama jika ocpp1.6 tidak ada
      return protocols[0] || false;
    }
    if (typeof protocols === 'string' && protocols === 'ocpp1.6') {
      return 'ocpp1.6';
    }
    // Jika tidak ada protocols, tetap terima connection
    return 'ocpp1.6';
  },
});

console.log(`OCPP 1.6j CSMS listening on:`);
console.log(`  ws://0.0.0.0:${PORT}/v1/ocpp/<CP_ID>`);
console.log(`  ws://0.0.0.0:${PORT}/ocpp/<CP_ID>`);

wss.on('connection', (ws, req) => {
  const cpId = extractCpId(req.url);
  const sp = req.headers['sec-websocket-protocol'];
  const userAgent = req.headers['user-agent'] || 'unknown';
  console.log(`[CONNECT] cpId=${cpId} subprotocol=${sp || '-'} from ${req.socket.remoteAddress}`);
  console.log(`[CONNECT] URL=${req.url} User-Agent=${userAgent}`);

  // Register CP
  const entry = chargePoints.get(cpId) || { sockets: new Set(), lastSeen: null };
  entry.sockets.add(ws);
  entry.lastSeen = new Date();
  chargePoints.set(cpId, entry);

  // Terima pesan
  ws.on('message', (raw) => {
    const parsed = parseOcppMessage(raw);
    if (!parsed.ok) {
      console.warn(`[${cpId}] Bad message: ${parsed.reason}`);
      return;
    }

    const [typeId, uniqueId, ...rest] = parsed.msg;

    if (typeId === MessageType.CALL) {
      const [action, payload] = rest;
      console.log(`[CALL <=] ${cpId} action=${action} uid=${uniqueId}`);
      entry.lastSeen = new Date();

      switch (action) {
        case 'BootNotification': {
          // payload: { chargePointVendor, chargePointModel, ... }
          const now = new Date().toISOString();
          const response = {
            status: 'Accepted',      // Accepted | Pending | Rejected
            currentTime: now,
            interval: 300,           // detik untuk Heartbeat interval
          };
          return sendCallResult(ws, uniqueId, response);
        }

        case 'Heartbeat': {
          const response = { currentTime: new Date().toISOString() };
          return sendCallResult(ws, uniqueId, response);
        }

        case 'Authorize': {
          // payload: { idTag }
          const response = {
            idTagInfo: {
              status: 'Accepted', // Accepted/Blocked/Expired/Invalid/ConcurrentTx
              expiryDate: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
            },
          };
          return sendCallResult(ws, uniqueId, response);
        }

        case 'StatusNotification': {
          // payload: { connectorId, status, errorCode, ... }
          // Untuk demo: hanya ACK kosong
          return sendCallResult(ws, uniqueId, {});
        }

        case 'StartTransaction': {
          // payload: { connectorId, idTag, meterStart, timestamp }
          const txId = nextTransactionId++;
          const response = {
            transactionId: txId,
            idTagInfo: { status: 'Accepted' },
          };
          return sendCallResult(ws, uniqueId, response);
        }

        case 'StopTransaction': {
          // payload: { meterStop, timestamp, transactionId, idTag?, reason? }
          const response = {
            idTagInfo: { status: 'Accepted' },
          };
          return sendCallResult(ws, uniqueId, response);
        }

        case 'MeterValues': {
          // payload: { connectorId, transactionId?, meterValue:[{ timestamp, sampledValue:[...] }] }
          return sendCallResult(ws, uniqueId, {});
        }

        case 'DataTransfer': {
          // payload: { vendorId, messageId?, data? }
          const response = { status: 'Accepted', data: null };
          return sendCallResult(ws, uniqueId, response);
        }

        // Tambahkan handler lain sesuai kebutuhan:
        // FirmwareStatusNotification, DiagnosticsStatusNotification, ReserveNow, CancelReservation, UnlockConnector, dsb.

        default:
          console.warn(`[${cpId}] Unhandled action: ${action}`);
          return sendCallError(ws, uniqueId, 'NotImplemented', `Action ${action} not implemented`);
      }
    }

    if (typeId === MessageType.CALLRESULT) {
      // Respons dari CP untuk CALL yang kita kirim (mis. RemoteStartTransaction)
      const [payload] = rest;
      console.log(`[RESULT <=] ${cpId} uid=${uniqueId} payload=${JSON.stringify(payload)}`);
      return;
    }

    if (typeId === MessageType.CALLERROR) {
      const [errorCode, desc, details] = rest;
      console.log(`[ERROR <=] ${cpId} uid=${uniqueId} ${errorCode}: ${desc} ${JSON.stringify(details || {})}`);
      return;
    }
  });

  ws.on('close', (code, reason) => {
    console.log(`[DISCONNECT] ${cpId} code=${code} reason=${reason ? reason.toString() : 'none'}`);
    const e = chargePoints.get(cpId);
    if (e) {
      e.sockets.delete(ws);
      if (e.sockets.size === 0) chargePoints.delete(cpId);
    }
  });

  ws.on('error', (error) => {
    console.log(`[ERROR] ${cpId} ${error.message}`);
  });

  // --- Contoh: kirim perintah dari CSMS ke CP beberapa detik setelah connect ---
  // (Ubah/komentari sesuai kebutuhan)
  setTimeout(() => {
    if (ws.readyState === ws.OPEN) {
      // Contoh RemoteStartTransaction (OCPP 1.6 JSON)
      const uid = sendCall(ws, 'RemoteStartTransaction', {
        idTag: 'DEMO-1234',
        connectorId: 1,
      });
      console.log(`[CALL =>] ${cpId} action=RemoteStartTransaction uid=${uid}`);
    }
  }, 5000);
});
