import { OcppService } from '../services';
import { QueueService } from '../services/QueueService';
import {
  BootNotificationRequestSchema,
  HeartbeatRequestSchema,
  AuthorizeRequestSchema,
  StartTransactionRequestSchema,
  StopTransactionRequestSchema,
  StatusNotificationRequestSchema,
  MeterValuesRequestSchema,
} from '../validation';

export class OcppController {
  constructor(
    private ocppService: OcppService,
    private queueService: QueueService
  ) {}

  async handleBootNotification(cpId: string, payload: any) {
    const validated = BootNotificationRequestSchema.parse(payload);
    
    await this.ocppService.registerChargePoint({
      cpId,
      vendor: validated.chargePointVendor,
      model: validated.chargePointModel,
      firmwareVersion: validated.firmwareVersion,
      serialNumber: validated.chargePointSerialNumber,
      additionalInfo: payload,
    });

    return {
      status: 'Accepted' as const,
      currentTime: new Date().toISOString(),
      interval: 300, // 5 minutes
    };
  }

  async handleHeartbeat(cpId: string, payload: any) {
    HeartbeatRequestSchema.parse(payload);
    
    // Queue heartbeat instead of processing immediately
    await this.queueService.queueHeartbeat({
      cpId,
      timestamp: new Date().toISOString(),
    });

    return {
      currentTime: new Date().toISOString(),
    };
  }

  async handleAuthorize(cpId: string, payload: any) {
    const validated = AuthorizeRequestSchema.parse(payload);
    
    await this.ocppService.authorize(cpId, validated.idTag);

    return {
      idTagInfo: {
        status: 'Accepted' as const,
        expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
    };
  }

  async handleStartTransaction(cpId: string, payload: any) {
    const validated = StartTransactionRequestSchema.parse(payload);
    
    const transaction = await this.ocppService.startTransaction({
      cpId,
      connectorId: validated.connectorId,
      idTag: validated.idTag,
      meterStart: validated.meterStart,
      startTimestamp: new Date(validated.timestamp),
    });

    return {
      transactionId: transaction.transactionId,
      idTagInfo: {
        status: 'Accepted' as const,
      },
    };
  }

  async handleStopTransaction(cpId: string, payload: any) {
    const validated = StopTransactionRequestSchema.parse(payload);
    
    await this.ocppService.stopTransaction({
      transactionId: validated.transactionId,
      cpId,
      meterStop: validated.meterStop,
      stopReason: validated.reason,
      idTag: validated.idTag,
    });

    return {
      idTagInfo: {
        status: 'Accepted' as const,
      },
    };
  }

  async handleStatusNotification(cpId: string, payload: any) {
    const validated = StatusNotificationRequestSchema.parse(payload);
    
    // Queue status notification instead of processing immediately
    await this.queueService.queueStatusNotification({
      cpId,
      connectorId: validated.connectorId,
      status: validated.status,
      errorCode: validated.errorCode,
      info: validated.info,
      vendorId: validated.vendorId,
      vendorErrorCode: validated.vendorErrorCode,
      timestamp: new Date().toISOString(),
      additionalInfo: payload,
    });

    return {}; // Empty response
  }

  async handleMeterValues(cpId: string, payload: any) {
    const validated = MeterValuesRequestSchema.parse(payload);
    
    const meterValues = validated.meterValue.flatMap(mv => 
      mv.sampledValue.map(sv => ({
        timestamp: mv.timestamp,
        value: sv.value,
        measurand: sv.measurand,
        phase: sv.phase,
        unit: sv.unit,
      }))
    );

    // Queue meter values instead of processing immediately
    await this.queueService.queueMeterValues({
      cpId,
      connectorId: validated.connectorId,
      transactionId: validated.transactionId,
      meterValues,
    });

    return {}; // Empty response
  }

  // Handle charge point reconnection and resume active transactions
  async handleReconnection(cpId: string) {
    const activeTransactions = await this.ocppService.getActiveTransactions(cpId);
    
    if (activeTransactions.length > 0) {
      console.log(`[${cpId}] Found ${activeTransactions.length} active transaction(s) to resume`);
      
      // Resume all active transactions
      for (const transaction of activeTransactions) {
        await this.ocppService.resumeTransaction(transaction.transactionId);
        console.log(`[${cpId}] Resumed transaction ${transaction.transactionId} on connector ${transaction.connectorId}`);
      }
    }
    
    return activeTransactions;
  }
}