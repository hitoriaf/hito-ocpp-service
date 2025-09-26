import { PrismaClient } from '@prisma/client';
import { CreateTransactionData } from '../types';
import { cp } from 'fs';

export class OcppService {
  constructor(private prisma: PrismaClient) {}

  // ChargePoint operations
  async registerChargePoint(data: {
    cpId: string;
    vendor?: string;
    model?: string;
    firmwareVersion?: string;
    serialNumber?: string;
    additionalInfo?: any;
  }) {
    return this.prisma.chargePoint.upsert({
      where: { cpId: data.cpId },
      update: {
        vendor: data.vendor,
        model: data.model,
        firmwareVersion: data.firmwareVersion,
        serialNumber: data.serialNumber,
        lastSeen: new Date(),
        additionalInfo: data.additionalInfo,
      },
      create: {
        cpId: data.cpId,
        vendor: data.vendor,
        model: data.model,
        firmwareVersion: data.firmwareVersion,
        serialNumber: data.serialNumber,
        lastSeen: new Date(),
        status: 'Available',
        additionalInfo: data.additionalInfo,
      },
    });
  }

  async updateLastSeen(cpId: string) {
    return this.prisma.chargePoint.update({
      where: { cpId },
      data: { lastSeen: new Date() },
    });
  }

  // Heartbeat operations
  async recordHeartbeat(cpId: string) {
    await this.prisma.heartbeat.create({
      data: {
        cpId,
        timestamp: new Date(),
      },
    });

    // Update last seen
    await this.updateLastSeen(cpId);
  }

  // Authorization operations  
  async authorize(cpId: string, idTag: string) {
    // For demo: always accept and create record
    const expiryDate = new Date();
    expiryDate.setHours(expiryDate.getHours() + 24);

    return this.prisma.authorization.create({
      data: {
        cpId,
        idTag,
        status: 'Accepted',
        expiryDate,
        timestamp: new Date(),
      },
    });
  }

  // Transaction operations
  async startTransaction(data: CreateTransactionData) {
    // Check for existing active transaction on connector
    const existing = await this.prisma.transaction.findFirst({
      where: {
        cpId: data.cpId,
        connectorId: data.connectorId,
        status: 'active',
      },
    });

    if (existing) {
      // If there's already an active transaction with same idTag, return the existing one
      // This handles the case where CP tries to start the same transaction again after reconnection
      if (existing.idTag === data.idTag) {
        console.log(`[${data.cpId}] Returning existing transaction ${existing.transactionId} for connector ${data.connectorId}`);
        return existing;
      }
      
      throw new Error(`Connector ${data.connectorId} already has an active transaction`);
    }

    return this.prisma.transaction.create({
      data: {
        cpId: data.cpId,
        connectorId: data.connectorId,
        idTag: data.idTag,
        meterStart: data.meterStart,
        startTimestamp: data.startTimestamp,
        status: 'active',
        additionalInfo: data
      },
    });
  }

  async stopTransaction(data: {
    transactionId?: number;
    cpId: string;
    connectorId?: number;
    idTag?: string;
    meterStop?: number;
    stopReason?: string;
  }) {
    let transactionId = data.transactionId;

    // If no transactionId, try to find active transaction
    if (!transactionId) {
      const where: any = { cpId: data.cpId, status: 'active' };
      
      if (data.connectorId !== undefined) {
        where.connectorId = data.connectorId;
      } else if (data.idTag) {
        where.idTag = data.idTag;
      }

      const transaction = await this.prisma.transaction.findFirst({
        where,
        orderBy: { startTimestamp: 'desc' },
      });

      if (!transaction) {
        throw new Error('No active transaction found to stop');
      }

      transactionId = transaction.transactionId;
    }

    return this.prisma.transaction.update({
      where: { transactionId },
      data: {
        meterStop: data.meterStop,
        stopTimestamp: new Date(),
        stopReason: data.stopReason || 'Local',
        status: 'completed',
        additionalInfo: data
      },
    });
  }

  // Status notification operations
  async recordStatusNotification(data: {
    cpId: string;
    connectorId: number;
    status: string;
    errorCode?: string;
    info?: string;
    vendorId?: string;
    vendorErrorCode?: string;
    additionalInfo?: any;
  }) {
    return this.prisma.statusNotification.create({
      data: {
        cpId: data.cpId,
        connectorId: data.connectorId,
        status: data.status,
        errorCode: data.errorCode,
        info: data.info,
        vendorId: data.vendorId,
        vendorErrorCode: data.vendorErrorCode,
        timestamp: new Date(),
        additionalInfo: data.additionalInfo,
      },
    });
  }

  // Meter values operations
  async recordMeterValues(data: {
    cpId: string;
    connectorId: number;
    transactionId?: number;
    meterValues: Array<{
      timestamp: Date;
      value: string;
      context?: string;
      format?: string;
      measurand?: string;
      phase?: string;
      location?: string;
      unit?: string;
    }>;
  }) {
    const records = data.meterValues.map(mv => ({
      cpId: data.cpId,
      connectorId: data.connectorId,
      transactionId: data.transactionId,
      timestamp: mv.timestamp,
      value: mv.value,
      context: mv.context,
      format: mv.format,
      measurand: mv.measurand,
      phase: mv.phase,
      location: mv.location,
      unit: mv.unit,
    }));

    return this.prisma.meterValue.createMany({
      data: records,
    });
  }
  async setChargePointStatus(cpId: string, status: string) {
    return cpId === 'unknown' 
      ? this.prisma.chargePoint.updateMany({ data: { status } })
      : this.prisma.chargePoint.update({ where: { cpId }, data: { status } });
  }

  // Check for active transactions when charge point reconnects
  async getActiveTransactions(cpId: string) {
    return this.prisma.transaction.findMany({
      where: {
        cpId,
        status: 'active',
      },
      orderBy: {
        startTimestamp: 'desc',
      },
    });
  }

  // Resume transaction after reconnection
  async resumeTransaction(transactionId: number) {
    // Get current transaction data
    const transaction = await this.prisma.transaction.findUnique({
      where: { transactionId },
    });

    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    // Mark transaction as resumed and update additional info
    const currentAdditionalInfo = transaction.additionalInfo as any || {};
    
    return this.prisma.transaction.update({
      where: { transactionId },
      data: {
        additionalInfo: {
          ...currentAdditionalInfo,
          reconnectedAt: new Date().toISOString(),
          reconnectionCount: (currentAdditionalInfo.reconnectionCount || 0) + 1,
        },
      },
    });
  }
}