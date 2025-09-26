import { OcppController } from '../../src/controllers/OcppController';
import { OcppService } from '../../src/services/OcppService';
import { QueueService } from '../../src/services/QueueService';
import { createMockPrismaClient, MockPrismaClient } from '../mocks/prisma';

// Mock the services
jest.mock('../../src/services/QueueService');

describe('OcppController - OCPP Message Handling', () => {
  let ocppController: OcppController;
  let mockPrisma: MockPrismaClient;
  let mockQueueService: jest.Mocked<QueueService>;
  let ocppService: OcppService;

  beforeEach(() => {
    mockPrisma = createMockPrismaClient();
    ocppService = new OcppService(mockPrisma);
    mockQueueService = new QueueService() as jest.Mocked<QueueService>;
    ocppController = new OcppController(ocppService, mockQueueService);
  });

  describe('handleBootNotification', () => {
    it('should handle valid BootNotification request', async () => {
      const cpId = 'CP001';
      const payload = {
        chargePointVendor: 'TestVendor',
        chargePointModel: 'TestModel',
        firmwareVersion: '1.0.0',
        chargePointSerialNumber: 'SN123456'
      };

      const mockChargePoint = {
        cpId,
        vendor: payload.chargePointVendor,
        model: payload.chargePointModel,
        firmwareVersion: payload.firmwareVersion,
        serialNumber: payload.chargePointSerialNumber,
        lastSeen: new Date(),
        status: 'Available',
        additionalInfo: payload,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.chargePoint.upsert.mockResolvedValue(mockChargePoint);

      const result = await ocppController.handleBootNotification(cpId, payload);

      expect(mockPrisma.chargePoint.upsert).toHaveBeenCalledWith({
        where: { cpId },
        update: {
          vendor: payload.chargePointVendor,
          model: payload.chargePointModel,
          firmwareVersion: payload.firmwareVersion,
          serialNumber: payload.chargePointSerialNumber,
          lastSeen: expect.any(Date),
          additionalInfo: payload,
        },
        create: {
          cpId,
          vendor: payload.chargePointVendor,
          model: payload.chargePointModel,
          firmwareVersion: payload.firmwareVersion,
          serialNumber: payload.chargePointSerialNumber,
          lastSeen: expect.any(Date),
          status: 'Available',
          additionalInfo: payload,
        },
      });

      expect(result).toEqual({
        status: 'Accepted',
        currentTime: expect.any(String),
        interval: 300,
      });
    });

    it('should reject invalid BootNotification payload', async () => {
      const cpId = 'CP001';
      const invalidPayload = {
        chargePointModel: 'TestModel',
        // Missing required chargePointVendor
      };

      await expect(
        ocppController.handleBootNotification(cpId, invalidPayload)
      ).rejects.toThrow();
    });
  });

  describe('handleHeartbeat', () => {
    it('should handle valid Heartbeat request and queue it', async () => {
      const cpId = 'CP001';
      const payload = {};

      mockQueueService.queueHeartbeat.mockResolvedValue({
        id: 'job-id',
        data: { cpId, timestamp: expect.any(String) }
      } as any);

      const result = await ocppController.handleHeartbeat(cpId, payload);

      expect(mockQueueService.queueHeartbeat).toHaveBeenCalledWith({
        cpId,
        timestamp: expect.any(String),
      });

      expect(result).toEqual({
        currentTime: expect.any(String),
      });
    });
  });

  describe('handleAuthorize', () => {
    it('should handle valid Authorize request', async () => {
      const cpId = 'CP001';
      const payload = { idTag: 'RFID123456' };

      const mockAuth = {
        id: 1,
        cpId,
        idTag: payload.idTag,
        status: 'Accepted',
        expiryDate: new Date(),
        timestamp: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.authorization.create.mockResolvedValue(mockAuth);

      const result = await ocppController.handleAuthorize(cpId, payload);

      expect(mockPrisma.authorization.create).toHaveBeenCalledWith({
        data: {
          cpId,
          idTag: payload.idTag,
          status: 'Accepted',
          expiryDate: expect.any(Date),
          timestamp: expect.any(Date),
        },
      });

      expect(result).toEqual({
        idTagInfo: {
          status: 'Accepted',
          expiryDate: expect.any(String),
        },
      });
    });

    it('should reject invalid idTag', async () => {
      const cpId = 'CP001';
      const invalidPayload = {}; // Missing idTag

      await expect(
        ocppController.handleAuthorize(cpId, invalidPayload)
      ).rejects.toThrow();
    });
  });

  describe('handleStartTransaction', () => {
    it('should handle valid StartTransaction request', async () => {
      const cpId = 'CP001';
      const payload = {
        connectorId: 1,
        idTag: 'RFID123456',
        meterStart: 1000,
        timestamp: new Date().toISOString()
      };

      const mockTransaction = {
        transactionId: 1,
        cpId,
        connectorId: payload.connectorId,
        idTag: payload.idTag,
        meterStart: payload.meterStart,
        startTimestamp: new Date(payload.timestamp),
        meterStop: null,
        stopTimestamp: null,
        stopReason: null,
        status: 'active',
        additionalInfo: payload,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.transaction.findFirst.mockResolvedValue(null); // No existing transaction
      mockPrisma.transaction.create.mockResolvedValue(mockTransaction);

      const result = await ocppController.handleStartTransaction(cpId, payload);

      expect(mockPrisma.transaction.findFirst).toHaveBeenCalledWith({
        where: {
          cpId,
          connectorId: payload.connectorId,
          status: 'active',
        },
      });

      expect(mockPrisma.transaction.create).toHaveBeenCalledWith({
        data: {
          cpId,
          connectorId: payload.connectorId,
          idTag: payload.idTag,
          meterStart: payload.meterStart,
          startTimestamp: new Date(payload.timestamp),
          status: 'active',
          additionalInfo: expect.objectContaining({
            cpId,
            connectorId: payload.connectorId,
            idTag: payload.idTag,
            meterStart: payload.meterStart,
            startTimestamp: expect.any(Date),
          }),
        },
      });

      expect(result).toEqual({
        transactionId: mockTransaction.transactionId,
        idTagInfo: {
          status: 'Accepted',
        },
      });
    });

    it('should handle existing active transaction on connector', async () => {
      const cpId = 'CP001';
      const payload = {
        connectorId: 1,
        idTag: 'RFID123456',
        meterStart: 1000,
        timestamp: new Date().toISOString()
      };

      const existingTransaction = {
        transactionId: 1,
        cpId,
        connectorId: payload.connectorId,
        idTag: payload.idTag, // Same idTag
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

      const result = await ocppController.handleStartTransaction(cpId, payload);

      expect(mockPrisma.transaction.create).not.toHaveBeenCalled();
      expect(result).toEqual({
        transactionId: existingTransaction.transactionId,
        idTagInfo: {
          status: 'Accepted',
        },
      });
    });

    it('should throw error for existing transaction with different idTag', async () => {
      const cpId = 'CP001';
      const payload = {
        connectorId: 1,
        idTag: 'RFID123456',
        meterStart: 1000,
        timestamp: new Date().toISOString()
      };

      const existingTransaction = {
        transactionId: 1,
        cpId,
        connectorId: payload.connectorId,
        idTag: 'DIFFERENT_RFID', // Different idTag
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

      await expect(
        ocppController.handleStartTransaction(cpId, payload)
      ).rejects.toThrow('Connector 1 already has an active transaction');
    });
  });

  describe('handleStopTransaction', () => {
    it('should handle valid StopTransaction request', async () => {
      const cpId = 'CP001';
      const payload = {
        transactionId: 1,
        meterStop: 2000,
        timestamp: new Date().toISOString(),
        reason: 'Local'
      };

      const updatedTransaction = {
        transactionId: payload.transactionId,
        cpId,
        connectorId: 1,
        idTag: 'RFID123456',
        meterStart: 1000,
        startTimestamp: new Date(),
        meterStop: payload.meterStop,
        stopTimestamp: new Date(),
        stopReason: payload.reason,
        status: 'completed',
        additionalInfo: payload,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.transaction.update.mockResolvedValue(updatedTransaction);

      const result = await ocppController.handleStopTransaction(cpId, payload);

      expect(mockPrisma.transaction.update).toHaveBeenCalledWith({
        where: { transactionId: payload.transactionId },
        data: {
          meterStop: payload.meterStop,
          stopTimestamp: expect.any(Date),
          stopReason: payload.reason,
          status: 'completed',
          additionalInfo: expect.objectContaining({
            cpId,
            transactionId: payload.transactionId,
            meterStop: payload.meterStop,
            stopReason: payload.reason,
          }),
        },
      });

      expect(result).toEqual({
        idTagInfo: {
          status: 'Accepted',
        },
      });
    });

    it('should find and stop transaction without transactionId', async () => {
      const cpId = 'CP001';
      const payload = {
        meterStop: 2000,
        timestamp: new Date().toISOString(),
        reason: 'Local',
        idTag: 'RFID123456'
      };

      const foundTransaction = {
        transactionId: 1,
        cpId,
        connectorId: 1,
        idTag: payload.idTag,
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
        meterStop: payload.meterStop,
        stopTimestamp: new Date(),
        stopReason: payload.reason,
        status: 'completed',
        additionalInfo: payload,
      };

      mockPrisma.transaction.findFirst.mockResolvedValue(foundTransaction);
      mockPrisma.transaction.update.mockResolvedValue(updatedTransaction);

      const result = await ocppController.handleStopTransaction(cpId, payload);

      expect(mockPrisma.transaction.findFirst).toHaveBeenCalledWith({
        where: {
          cpId,
          status: 'active',
          idTag: payload.idTag,
        },
        orderBy: { startTimestamp: 'desc' },
      });

      expect(result).toEqual({
        idTagInfo: {
          status: 'Accepted',
        },
      });
    });

    it('should throw error when no active transaction found', async () => {
      const cpId = 'CP001';
      const payload = {
        meterStop: 2000,
        timestamp: new Date().toISOString(),
        reason: 'Local'
      };

      mockPrisma.transaction.findFirst.mockResolvedValue(null);

      await expect(
        ocppController.handleStopTransaction(cpId, payload)
      ).rejects.toThrow('No active transaction found to stop');
    });
  });

  describe('handleStatusNotification', () => {
    it('should handle valid StatusNotification and queue it', async () => {
      const cpId = 'CP001';
      const payload = {
        connectorId: 1,
        status: 'Available',
        errorCode: 'NoError'
      };

      mockQueueService.queueStatusNotification.mockResolvedValue({
        id: 'job-id',
        data: expect.any(Object)
      } as any);

      const result = await ocppController.handleStatusNotification(cpId, payload);

      expect(mockQueueService.queueStatusNotification).toHaveBeenCalledWith({
        cpId,
        connectorId: payload.connectorId,
        status: payload.status,
        errorCode: payload.errorCode,
        info: undefined,
        vendorId: undefined,
        vendorErrorCode: undefined,
        timestamp: expect.any(String),
        additionalInfo: payload,
      });

      expect(result).toEqual({});
    });
  });

  describe('handleMeterValues', () => {
    it('should handle valid MeterValues and queue them', async () => {
      const cpId = 'CP001';
      const payload = {
        connectorId: 1,
        transactionId: 1,
        meterValue: [
          {
            timestamp: new Date().toISOString(),
            sampledValue: [
              {
                value: '1500',
                measurand: 'Energy.Active.Import.Register',
                unit: 'Wh'
              }
            ]
          }
        ]
      };

      mockQueueService.queueMeterValues.mockResolvedValue({
        id: 'job-id',
        data: expect.any(Object)
      } as any);

      const result = await ocppController.handleMeterValues(cpId, payload);

      expect(mockQueueService.queueMeterValues).toHaveBeenCalledWith({
        cpId,
        connectorId: payload.connectorId,
        transactionId: payload.transactionId,
        meterValues: [
          {
            timestamp: payload.meterValue[0].timestamp,
            value: payload.meterValue[0].sampledValue[0].value,
            measurand: payload.meterValue[0].sampledValue[0].measurand,
            phase: undefined,
            unit: payload.meterValue[0].sampledValue[0].unit,
          }
        ],
      });

      expect(result).toEqual({});
    });

    it('should handle multiple meter values with multiple sampled values', async () => {
      const cpId = 'CP001';
      const payload = {
        connectorId: 1,
        meterValue: [
          {
            timestamp: new Date().toISOString(),
            sampledValue: [
              { value: '1500', measurand: 'Energy.Active.Import.Register' },
              { value: '22.1', measurand: 'Voltage', phase: 'L1' }
            ]
          },
          {
            timestamp: new Date().toISOString(),
            sampledValue: [
              { value: '1600', measurand: 'Energy.Active.Import.Register' }
            ]
          }
        ]
      };

      mockQueueService.queueMeterValues.mockResolvedValue({
        id: 'job-id',
        data: expect.any(Object)
      } as any);

      await ocppController.handleMeterValues(cpId, payload);

      expect(mockQueueService.queueMeterValues).toHaveBeenCalledWith({
        cpId,
        connectorId: payload.connectorId,
        transactionId: undefined,
        meterValues: [
          {
            timestamp: payload.meterValue[0].timestamp,
            value: '1500',
            measurand: 'Energy.Active.Import.Register',
            phase: undefined,
            unit: undefined,
          },
          {
            timestamp: payload.meterValue[0].timestamp,
            value: '22.1',
            measurand: 'Voltage',
            phase: 'L1',
            unit: undefined,
          },
          {
            timestamp: payload.meterValue[1].timestamp,
            value: '1600',
            measurand: 'Energy.Active.Import.Register',
            phase: undefined,
            unit: undefined,
          }
        ],
      });
    });
  });

  describe('handleReconnection', () => {
    it('should find and resume active transactions on reconnection', async () => {
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
        },
        {
          transactionId: 2,
          cpId,
          connectorId: 2,
          idTag: 'RFID789012',
          meterStart: 2000,
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
      mockPrisma.transaction.findUnique
        .mockResolvedValueOnce(activeTransactions[0])
        .mockResolvedValueOnce(activeTransactions[1]);
      mockPrisma.transaction.update
        .mockResolvedValueOnce({ ...activeTransactions[0], additionalInfo: expect.any(Object) })
        .mockResolvedValueOnce({ ...activeTransactions[1], additionalInfo: expect.any(Object) });

      const result = await ocppController.handleReconnection(cpId);

      expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith({
        where: {
          cpId,
          status: 'active',
        },
        orderBy: {
          startTimestamp: 'desc',
        },
      });

      expect(mockPrisma.transaction.update).toHaveBeenCalledTimes(2);
      expect(result).toEqual(activeTransactions);
    });

    it('should return empty array when no active transactions found', async () => {
      const cpId = 'CP001';

      mockPrisma.transaction.findMany.mockResolvedValue([]);

      const result = await ocppController.handleReconnection(cpId);

      expect(result).toEqual([]);
    });
  });
});