import { OcppService } from '../../src/services/OcppService';
import { createMockPrismaClient, MockPrismaClient } from '../mocks/prisma';

describe('OcppService - Database Operations', () => {
  let ocppService: OcppService;
  let mockPrisma: MockPrismaClient;

  beforeEach(() => {
    mockPrisma = createMockPrismaClient();
    ocppService = new OcppService(mockPrisma);
  });

  describe('registerChargePoint', () => {
    it('should create a new charge point when it does not exist', async () => {
      const cpData = {
        cpId: 'CP001',
        vendor: 'TestVendor',
        model: 'TestModel',
        firmwareVersion: '1.0.0',
        serialNumber: 'SN123456',
        additionalInfo: { customField: 'value' }
      };

      const mockChargePoint = {
        ...cpData,
        lastSeen: new Date(),
        status: 'Available',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.chargePoint.upsert.mockResolvedValue(mockChargePoint);

      const result = await ocppService.registerChargePoint(cpData);

      expect(mockPrisma.chargePoint.upsert).toHaveBeenCalledWith({
        where: { cpId: cpData.cpId },
        update: {
          vendor: cpData.vendor,
          model: cpData.model,
          firmwareVersion: cpData.firmwareVersion,
          serialNumber: cpData.serialNumber,
          lastSeen: expect.any(Date),
          additionalInfo: cpData.additionalInfo,
        },
        create: {
          cpId: cpData.cpId,
          vendor: cpData.vendor,
          model: cpData.model,
          firmwareVersion: cpData.firmwareVersion,
          serialNumber: cpData.serialNumber,
          lastSeen: expect.any(Date),
          status: 'Available',
          additionalInfo: cpData.additionalInfo,
        },
      });

      expect(result).toEqual(mockChargePoint);
    });

    it('should update existing charge point', async () => {
      const cpData = {
        cpId: 'CP001',
        vendor: 'UpdatedVendor',
        model: 'UpdatedModel',
        firmwareVersion: '2.0.0',
      };

      const mockChargePoint = {
        ...cpData,
        serialNumber: null,
        lastSeen: new Date(),
        status: 'Available',
        additionalInfo: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.chargePoint.upsert.mockResolvedValue(mockChargePoint);

      const result = await ocppService.registerChargePoint(cpData);

      expect(mockPrisma.chargePoint.upsert).toHaveBeenCalledWith({
        where: { cpId: cpData.cpId },
        update: {
          vendor: cpData.vendor,
          model: cpData.model,
          firmwareVersion: cpData.firmwareVersion,
          serialNumber: undefined,
          lastSeen: expect.any(Date),
          additionalInfo: undefined,
        },
        create: {
          cpId: cpData.cpId,
          vendor: cpData.vendor,
          model: cpData.model,
          firmwareVersion: cpData.firmwareVersion,
          serialNumber: undefined,
          lastSeen: expect.any(Date),
          status: 'Available',
          additionalInfo: undefined,
        },
      });

      expect(result).toEqual(mockChargePoint);
    });
  });

  describe('updateLastSeen', () => {
    it('should update the last seen timestamp', async () => {
      const cpId = 'CP001';
      const mockUpdatedChargePoint = {
        cpId,
        vendor: 'TestVendor',
        model: 'TestModel',
        firmwareVersion: '1.0.0',
        serialNumber: 'SN123456',
        lastSeen: new Date(),
        status: 'Available',
        additionalInfo: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.chargePoint.update.mockResolvedValue(mockUpdatedChargePoint);

      const result = await ocppService.updateLastSeen(cpId);

      expect(mockPrisma.chargePoint.update).toHaveBeenCalledWith({
        where: { cpId },
        data: { lastSeen: expect.any(Date) },
      });

      expect(result).toEqual(mockUpdatedChargePoint);
    });
  });

  describe('recordHeartbeat', () => {
    it('should create a heartbeat record and update last seen', async () => {
      const cpId = 'CP001';
      const mockHeartbeat = {
        id: 1,
        cpId,
        timestamp: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockUpdatedChargePoint = {
        cpId,
        vendor: 'TestVendor',
        model: 'TestModel',
        firmwareVersion: '1.0.0',
        serialNumber: 'SN123456',
        lastSeen: new Date(),
        status: 'Available',
        additionalInfo: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.heartbeat.create.mockResolvedValue(mockHeartbeat);
      mockPrisma.chargePoint.update.mockResolvedValue(mockUpdatedChargePoint);

      await ocppService.recordHeartbeat(cpId);

      expect(mockPrisma.heartbeat.create).toHaveBeenCalledWith({
        data: {
          cpId,
          timestamp: expect.any(Date),
        },
      });

      expect(mockPrisma.chargePoint.update).toHaveBeenCalledWith({
        where: { cpId },
        data: { lastSeen: expect.any(Date) },
      });
    });
  });

  describe('authorize', () => {
    it('should create an authorization record with accepted status', async () => {
      const cpId = 'CP001';
      const idTag = 'RFID123456';

      const mockAuth = {
        id: 1,
        cpId,
        idTag,
        status: 'Accepted',
        expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        timestamp: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.authorization.create.mockResolvedValue(mockAuth);

      const result = await ocppService.authorize(cpId, idTag);

      expect(mockPrisma.authorization.create).toHaveBeenCalledWith({
        data: {
          cpId,
          idTag,
          status: 'Accepted',
          expiryDate: expect.any(Date),
          timestamp: expect.any(Date),
        },
      });

      expect(result).toEqual(mockAuth);
      
      // Check expiry date is 24 hours from now (only if not null)
      if (result.expiryDate) {
        const expectedExpiryTime = Date.now() + 24 * 60 * 60 * 1000;
        const actualExpiryTime = result.expiryDate.getTime();
        expect(Math.abs(actualExpiryTime - expectedExpiryTime)).toBeLessThan(1000); // Within 1 second
      }
    });
  });

  describe('startTransaction', () => {
    it('should create a new transaction when no existing active transaction', async () => {
      const transactionData = {
        cpId: 'CP001',
        connectorId: 1,
        idTag: 'RFID123456',
        meterStart: 1000,
        startTimestamp: new Date()
      };

      const mockTransaction = {
        transactionId: 1,
        cpId: transactionData.cpId,
        connectorId: transactionData.connectorId,
        idTag: transactionData.idTag,
        meterStart: transactionData.meterStart,
        startTimestamp: transactionData.startTimestamp,
        meterStop: null,
        stopTimestamp: null,
        stopReason: null,
        status: 'active',
        additionalInfo: { ...transactionData, startTimestamp: transactionData.startTimestamp.toISOString() } as any,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.transaction.findFirst.mockResolvedValue(null);
      mockPrisma.transaction.create.mockResolvedValue(mockTransaction);

      const result = await ocppService.startTransaction(transactionData);

      expect(mockPrisma.transaction.findFirst).toHaveBeenCalledWith({
        where: {
          cpId: transactionData.cpId,
          connectorId: transactionData.connectorId,
          status: 'active',
        },
      });

      expect(mockPrisma.transaction.create).toHaveBeenCalledWith({
        data: {
          cpId: transactionData.cpId,
          connectorId: transactionData.connectorId,
          idTag: transactionData.idTag,
          meterStart: transactionData.meterStart,
          startTimestamp: transactionData.startTimestamp,
          status: 'active',
          additionalInfo: transactionData,
        },
      });

      expect(result).toEqual(mockTransaction);
    });

    it('should return existing transaction with same idTag', async () => {
      const transactionData = {
        cpId: 'CP001',
        connectorId: 1,
        idTag: 'RFID123456',
        meterStart: 1000,
        startTimestamp: new Date()
      };

      const existingTransaction = {
        transactionId: 1,
        cpId: transactionData.cpId,
        connectorId: transactionData.connectorId,
        idTag: transactionData.idTag,
        meterStart: 500,
        startTimestamp: new Date(),
        meterStop: null,
        stopTimestamp: null,
        stopReason: null,
        status: 'active',
        additionalInfo: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.transaction.findFirst.mockResolvedValue(existingTransaction);

      const result = await ocppService.startTransaction(transactionData);

      expect(mockPrisma.transaction.create).not.toHaveBeenCalled();
      expect(result).toEqual(existingTransaction);
    });

    it('should throw error when existing transaction has different idTag', async () => {
      const transactionData = {
        cpId: 'CP001',
        connectorId: 1,
        idTag: 'RFID123456',
        meterStart: 1000,
        startTimestamp: new Date()
      };

      const existingTransaction = {
        transactionId: 1,
        cpId: transactionData.cpId,
        connectorId: transactionData.connectorId,
        idTag: 'DIFFERENT_RFID',
        meterStart: 500,
        startTimestamp: new Date(),
        meterStop: null,
        stopTimestamp: null,
        stopReason: null,
        status: 'active',
        additionalInfo: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.transaction.findFirst.mockResolvedValue(existingTransaction);

      await expect(ocppService.startTransaction(transactionData)).rejects.toThrow(
        'Connector 1 already has an active transaction'
      );

      expect(mockPrisma.transaction.create).not.toHaveBeenCalled();
    });
  });

  describe('stopTransaction', () => {
    it('should stop transaction by transactionId', async () => {
      const stopData = {
        transactionId: 1,
        cpId: 'CP001',
        meterStop: 2000,
        stopReason: 'Local'
      };

      const updatedTransaction = {
        transactionId: stopData.transactionId,
        cpId: stopData.cpId,
        connectorId: 1,
        idTag: 'RFID123456',
        meterStart: 1000,
        startTimestamp: new Date(),
        meterStop: stopData.meterStop,
        stopTimestamp: new Date(),
        stopReason: stopData.stopReason,
        status: 'completed',
        additionalInfo: stopData,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.transaction.update.mockResolvedValue(updatedTransaction);

      const result = await ocppService.stopTransaction(stopData);

      expect(mockPrisma.transaction.update).toHaveBeenCalledWith({
        where: { transactionId: stopData.transactionId },
        data: {
          meterStop: stopData.meterStop,
          stopTimestamp: expect.any(Date),
          stopReason: stopData.stopReason,
          status: 'completed',
          additionalInfo: stopData,
        },
      });

      expect(result).toEqual(updatedTransaction);
    });

    it('should find and stop transaction by cpId and connectorId when no transactionId provided', async () => {
      const stopData = {
        cpId: 'CP001',
        connectorId: 1,
        meterStop: 2000,
        stopReason: 'Local'
      };

      const foundTransaction = {
        transactionId: 1,
        cpId: stopData.cpId,
        connectorId: stopData.connectorId,
        idTag: 'RFID123456',
        meterStart: 1000,
        startTimestamp: new Date(),
        meterStop: null,
        stopTimestamp: null,
        stopReason: null,
        status: 'active',
        additionalInfo: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const updatedTransaction = {
        ...foundTransaction,
        meterStop: stopData.meterStop,
        stopTimestamp: new Date(),
        stopReason: stopData.stopReason,
        status: 'completed',
        additionalInfo: stopData,
      };

      mockPrisma.transaction.findFirst.mockResolvedValue(foundTransaction);
      mockPrisma.transaction.update.mockResolvedValue(updatedTransaction);

      const result = await ocppService.stopTransaction(stopData);

      expect(mockPrisma.transaction.findFirst).toHaveBeenCalledWith({
        where: {
          cpId: stopData.cpId,
          status: 'active',
          connectorId: stopData.connectorId,
        },
        orderBy: { startTimestamp: 'desc' },
      });

      expect(mockPrisma.transaction.update).toHaveBeenCalledWith({
        where: { transactionId: foundTransaction.transactionId },
        data: {
          meterStop: stopData.meterStop,
          stopTimestamp: expect.any(Date),
          stopReason: stopData.stopReason,
          status: 'completed',
          additionalInfo: stopData,
        },
      });

      expect(result).toEqual(updatedTransaction);
    });

    it('should find and stop transaction by idTag when no transactionId or connectorId provided', async () => {
      const stopData = {
        cpId: 'CP001',
        idTag: 'RFID123456',
        meterStop: 2000,
        stopReason: 'Remote'
      };

      const foundTransaction = {
        transactionId: 1,
        cpId: stopData.cpId,
        connectorId: 1,
        idTag: stopData.idTag,
        meterStart: 1000,
        startTimestamp: new Date(),
        meterStop: null,
        stopTimestamp: null,
        stopReason: null,
        status: 'active',
        additionalInfo: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const updatedTransaction = {
        ...foundTransaction,
        meterStop: stopData.meterStop,
        stopTimestamp: new Date(),
        stopReason: stopData.stopReason,
        status: 'completed',
        additionalInfo: stopData,
      };

      mockPrisma.transaction.findFirst.mockResolvedValue(foundTransaction);
      mockPrisma.transaction.update.mockResolvedValue(updatedTransaction);

      const result = await ocppService.stopTransaction(stopData);

      expect(mockPrisma.transaction.findFirst).toHaveBeenCalledWith({
        where: {
          cpId: stopData.cpId,
          status: 'active',
          idTag: stopData.idTag,
        },
        orderBy: { startTimestamp: 'desc' },
      });

      expect(result).toEqual(updatedTransaction);
    });

    it('should throw error when no active transaction found', async () => {
      const stopData = {
        cpId: 'CP001',
        meterStop: 2000,
        stopReason: 'Local'
      };

      mockPrisma.transaction.findFirst.mockResolvedValue(null);

      await expect(ocppService.stopTransaction(stopData)).rejects.toThrow(
        'No active transaction found to stop'
      );

      expect(mockPrisma.transaction.update).not.toHaveBeenCalled();
    });
  });

  describe('recordStatusNotification', () => {
    it('should create a status notification record', async () => {
      const notificationData = {
        cpId: 'CP001',
        connectorId: 1,
        status: 'Available',
        errorCode: 'NoError',
        info: 'Additional info',
        vendorId: 'TestVendor',
        vendorErrorCode: 'TEST001',
        additionalInfo: { customField: 'value' }
      };

      const mockNotification = {
        id: 1,
        cpId: notificationData.cpId,
        connectorId: notificationData.connectorId,
        status: notificationData.status,
        errorCode: notificationData.errorCode,
        info: notificationData.info,
        vendorId: notificationData.vendorId,
        vendorErrorCode: notificationData.vendorErrorCode,
        timestamp: new Date(),
        additionalInfo: notificationData.additionalInfo,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.statusNotification.create.mockResolvedValue(mockNotification);

      const result = await ocppService.recordStatusNotification(notificationData);

      expect(mockPrisma.statusNotification.create).toHaveBeenCalledWith({
        data: {
          cpId: notificationData.cpId,
          connectorId: notificationData.connectorId,
          status: notificationData.status,
          errorCode: notificationData.errorCode,
          info: notificationData.info,
          vendorId: notificationData.vendorId,
          vendorErrorCode: notificationData.vendorErrorCode,
          timestamp: expect.any(Date),
          additionalInfo: notificationData.additionalInfo,
        },
      });

      expect(result).toEqual(mockNotification);
    });
  });

  describe('recordMeterValues', () => {
    it('should create multiple meter value records', async () => {
      const meterData = {
        cpId: 'CP001',
        connectorId: 1,
        transactionId: 1,
        meterValues: [
          {
            timestamp: new Date(),
            value: '1500',
            measurand: 'Energy.Active.Import.Register',
            unit: 'Wh'
          },
          {
            timestamp: new Date(),
            value: '22.1',
            measurand: 'Voltage',
            phase: 'L1',
            unit: 'V'
          }
        ]
      };

      const mockResult = { count: 2 };

      mockPrisma.meterValue.createMany.mockResolvedValue(mockResult);

      const result = await ocppService.recordMeterValues(meterData);

      expect(mockPrisma.meterValue.createMany).toHaveBeenCalledWith({
        data: [
          {
            cpId: meterData.cpId,
            connectorId: meterData.connectorId,
            transactionId: meterData.transactionId,
            timestamp: meterData.meterValues[0].timestamp,
            value: meterData.meterValues[0].value,
            context: undefined,
            format: undefined,
            measurand: meterData.meterValues[0].measurand,
            phase: undefined,
            location: undefined,
            unit: meterData.meterValues[0].unit,
          },
          {
            cpId: meterData.cpId,
            connectorId: meterData.connectorId,
            transactionId: meterData.transactionId,
            timestamp: meterData.meterValues[1].timestamp,
            value: meterData.meterValues[1].value,
            context: undefined,
            format: undefined,
            measurand: meterData.meterValues[1].measurand,
            phase: meterData.meterValues[1].phase,
            location: undefined,
            unit: meterData.meterValues[1].unit,
          }
        ],
      });

      expect(result).toEqual(mockResult);
    });
  });

  describe('setChargePointStatus', () => {
    it('should update specific charge point status', async () => {
      const cpId = 'CP001';
      const status = 'Online';

      const mockUpdatedChargePoint = {
        cpId,
        vendor: 'TestVendor',
        model: 'TestModel',
        firmwareVersion: '1.0.0',
        serialNumber: 'SN123456',
        lastSeen: new Date(),
        status,
        additionalInfo: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.chargePoint.update.mockResolvedValue(mockUpdatedChargePoint);

      const result = await ocppService.setChargePointStatus(cpId, status);

      expect(mockPrisma.chargePoint.update).toHaveBeenCalledWith({
        where: { cpId },
        data: { status }
      });

      expect(result).toEqual(mockUpdatedChargePoint);
    });

    it('should update all charge points when cpId is "unknown"', async () => {
      const cpId = 'unknown';
      const status = 'Offline';

      const mockResult = { count: 5 };

      mockPrisma.chargePoint.updateMany.mockResolvedValue(mockResult);

      const result = await ocppService.setChargePointStatus(cpId, status);

      expect(mockPrisma.chargePoint.updateMany).toHaveBeenCalledWith({
        data: { status }
      });

      expect(result).toEqual(mockResult);
    });
  });

  describe('getActiveTransactions', () => {
    it('should return active transactions for a charge point', async () => {
      const cpId = 'CP001';
      const activeTransactions = [
        {
          transactionId: 1,
          cpId,
          connectorId: 1,
          idTag: 'RFID123456',
          meterStart: 1000,
          startTimestamp: new Date(),
          meterStop: null,
          stopTimestamp: null,
          stopReason: null,
          status: 'active',
          additionalInfo: {},
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockPrisma.transaction.findMany.mockResolvedValue(activeTransactions);

      const result = await ocppService.getActiveTransactions(cpId);

      expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith({
        where: {
          cpId,
          status: 'active',
        },
        orderBy: {
          startTimestamp: 'desc',
        },
      });

      expect(result).toEqual(activeTransactions);
    });

    it('should return empty array when no active transactions', async () => {
      const cpId = 'CP001';

      mockPrisma.transaction.findMany.mockResolvedValue([]);

      const result = await ocppService.getActiveTransactions(cpId);

      expect(result).toEqual([]);
    });
  });

  describe('resumeTransaction', () => {
    it('should update transaction with reconnection info', async () => {
      const transactionId = 1;
      const existingTransaction = {
        transactionId,
        cpId: 'CP001',
        connectorId: 1,
        idTag: 'RFID123456',
        meterStart: 1000,
        startTimestamp: new Date(),
        meterStop: null,
        stopTimestamp: null,
        stopReason: null,
        status: 'active',
        additionalInfo: { existingField: 'value' },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const updatedTransaction = {
        ...existingTransaction,
        additionalInfo: {
          existingField: 'value',
          reconnectedAt: expect.any(String),
          reconnectionCount: 1,
        },
      };

      mockPrisma.transaction.findUnique.mockResolvedValue(existingTransaction);
      mockPrisma.transaction.update.mockResolvedValue(updatedTransaction as any);

      const result = await ocppService.resumeTransaction(transactionId);

      expect(mockPrisma.transaction.findUnique).toHaveBeenCalledWith({
        where: { transactionId },
      });

      expect(mockPrisma.transaction.update).toHaveBeenCalledWith({
        where: { transactionId },
        data: {
          additionalInfo: {
            existingField: 'value',
            reconnectedAt: expect.any(String),
            reconnectionCount: 1,
          },
        },
      });

      expect(result).toEqual(updatedTransaction);
    });

    it('should increment reconnection count for subsequent reconnections', async () => {
      const transactionId = 1;
      const existingTransaction = {
        transactionId,
        cpId: 'CP001',
        connectorId: 1,
        idTag: 'RFID123456',
        meterStart: 1000,
        startTimestamp: new Date(),
        meterStop: null,
        stopTimestamp: null,
        stopReason: null,
        status: 'active',
        additionalInfo: { 
          reconnectionCount: 2,
          lastReconnectedAt: '2023-01-01T00:00:00Z'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const updatedTransaction = {
        ...existingTransaction,
        additionalInfo: { 
          reconnectionCount: 2,
          lastReconnectedAt: '2023-01-01T00:00:00Z',
          reconnectedAt: expect.any(String),
          newReconnectionCount: 3,
        },
      };

      mockPrisma.transaction.findUnique.mockResolvedValue(existingTransaction);
      mockPrisma.transaction.update.mockResolvedValue(updatedTransaction as any);

      const result = await ocppService.resumeTransaction(transactionId);

      expect(mockPrisma.transaction.update).toHaveBeenCalledWith({
        where: { transactionId },
        data: {
          additionalInfo: {
            lastReconnectedAt: '2023-01-01T00:00:00Z',
            reconnectedAt: expect.any(String),
            reconnectionCount: 3,
          },
        },
      });
    });

    it('should throw error when transaction not found', async () => {
      const transactionId = 999;

      mockPrisma.transaction.findUnique.mockResolvedValue(null);

      await expect(ocppService.resumeTransaction(transactionId)).rejects.toThrow(
        'Transaction 999 not found'
      );

      expect(mockPrisma.transaction.update).not.toHaveBeenCalled();
    });
  });
});