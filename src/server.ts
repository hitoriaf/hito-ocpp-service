import * as uWS from 'uws';
import * as dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { OcppService, QueueService, QueueProcessor } from './services';
import { OcppController } from './controllers';

// Load environment variables
dotenv.config();

const PORT = parseInt(process.env.PORT || '8080');

// Message types
enum MessageType {
  CALL = 2,
  CALLRESULT = 3,
  CALLERROR = 4,
}

// WebSocket user data interface
interface WebSocketUserData {
  url: string;
  userAgent: string;
  cpId?: string;
}

class SimpleOcppServer {
  private prisma: PrismaClient;
  private ocppService: OcppService;
  private queueService: QueueService;
  private queueProcessor: QueueProcessor;
  private ocppController: OcppController;

  constructor() {
    this.prisma = new PrismaClient();
    this.ocppService = new OcppService(this.prisma);
    this.queueService = new QueueService();
    this.queueProcessor = new QueueProcessor(this.ocppService, this.queueService);
    this.ocppController = new OcppController(this.ocppService, this.queueService);
  }

  async start() {
    try {
      // Connect to database
      await this.prisma.$connect();

      const app = uWS.App({});

      // Health check
      app.get('/health', (res, req) => {
        res.writeStatus('200 OK').end('Hello World!');
      });

      // WebSocket
      app.ws('/v1/*', {
        upgrade: (res, req, context) => {
          const url = req.getUrl();
          const userAgent = req.getHeader('user-agent') || 'unknown';
          res.upgrade({ url, userAgent }, 
            req.getHeader('sec-websocket-key'),
            req.getHeader('sec-websocket-protocol'), 
            req.getHeader('sec-websocket-extensions'),
            context
          );
        },

        open: async (ws: uWS.WebSocket<WebSocketUserData>) => {
          const userData = ws.getUserData();
          const cpId = this.extractCpId(userData.url);
          userData.cpId = cpId;
          
          //update status to online
          this.ocppService.setChargePointStatus(cpId, 'Online').catch(console.error);
          
          // Check for active transactions and resume them
          try {
            const activeTransactions = await this.ocppController.handleReconnection(cpId);
            if (activeTransactions.length > 0) {
              console.log(`[${cpId}] Reconnected with ${activeTransactions.length} active transaction(s)`);
            }
          } catch (error) {
            console.error(`[${cpId}] Error during reconnection handling:`, error);
          }
          
          console.log(`Open ${cpId}`);
        },

        message: async (ws: uWS.WebSocket<WebSocketUserData>, message: ArrayBuffer) => {
          await this.handleMessage(ws, Buffer.from(message).toString());
        },

        close: (ws: uWS.WebSocket<WebSocketUserData>) => {
          const cpId = ws.getUserData().cpId || 'unknown';
          //update last seen on close
          this.ocppService.updateLastSeen(cpId).catch(console.error);
          //update status to offline
          this.ocppService.setChargePointStatus(cpId, 'Offline').catch(console.error);
          console.log(`Closed ${cpId}`);
        }
      });

      // Start server
      app.listen(PORT, (token) => {
        if (token) {
          console.log(`Server running on port ${PORT}`);
        } else {
          throw new Error(`Failed to listen on port ${PORT}`);
        }
      });

      //Shut Down gracefully
      process.on('SIGINT', () => this.shutdown());
      process.on('SIGTERM', () => this.shutdown());

    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  private extractCpId(url: string): string {
    const parts = url.split('/').filter(Boolean);
    return parts[2] || 'unknown';
  }

  private async handleMessage(ws: uWS.WebSocket<WebSocketUserData>, raw: string) {
    const cpId = ws.getUserData().cpId || 'unknown';

    try {
      const message = JSON.parse(raw);
      if (!Array.isArray(message) || message.length < 3) {
        return this.sendError(ws, 'unknown', 'InvalidMessage', 'Invalid OCPP message format');
      }

      const [messageType, uniqueId, action, payload] = message;

      if (messageType === MessageType.CALL) {
        console.log(`[${cpId}] ${action}`);
        const response = await this.handleAction(cpId, action, payload || {});
        this.sendCallResult(ws, uniqueId, response);
      }

    } catch (error) {
      console.error(`[${cpId}] Error:`, error);
      this.sendError(ws, 'unknown', 'InternalError', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private async handleAction(cpId: string, action: string, payload: any): Promise<any> {
    switch (action) {
      case 'BootNotification':
        return this.ocppController.handleBootNotification(cpId, payload);
      case 'Heartbeat':
        return this.ocppController.handleHeartbeat(cpId, payload);
      case 'Authorize':
        return this.ocppController.handleAuthorize(cpId, payload);
      case 'StartTransaction':
        return this.ocppController.handleStartTransaction(cpId, payload);
      case 'StopTransaction':
        return this.ocppController.handleStopTransaction(cpId, payload);
      case 'StatusNotification':
        return this.ocppController.handleStatusNotification(cpId, payload);
      case 'MeterValues':
        return this.ocppController.handleMeterValues(cpId, payload);
      default:
        throw new Error(`Unsupported action: ${action}`);
    }
  }

  private sendCallResult(ws: uWS.WebSocket<WebSocketUserData>, uniqueId: string, payload: any) {
    const response = [MessageType.CALLRESULT, uniqueId, payload];
    ws.send(JSON.stringify(response));
  }

  private sendError(ws: uWS.WebSocket<WebSocketUserData>, uniqueId: string, errorCode: string, description: string) {
    const error = [MessageType.CALLERROR, uniqueId, errorCode, description, {}];
    ws.send(JSON.stringify(error));
  }

  private async shutdown() {
    console.log('Shutting down...');
    await this.ocppService.setChargePointStatus('unknown', 'Offline');
    await this.queueService.close();
    await this.prisma.$disconnect();
    process.exit(0);
  }
}

// Start server
const server = new SimpleOcppServer();
server.start();