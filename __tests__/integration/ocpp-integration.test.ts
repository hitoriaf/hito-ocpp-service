import { OcppController } from '../../src/controllers/OcppController';
import { OcppService } from '../../src/services/OcppService';
import { QueueService } from '../../src/services/QueueService';
import { QueueProcessor } from '../../src/services/QueueProcessor';
import { createMockPrismaClient, MockPrismaClient } from '../mocks/prisma';

jest.mock('../../src/services/QueueService');

describe('OCPP Integration Tests', () => {
  let ocppController: OcppController;
  let ocppService: OcppService;
  let mockPrisma: MockPrismaClient;
  let mockQueueService: jest.Mocked<QueueService>;
  let queueProcessor: QueueProcessor | undefined;

  beforeEach(() => {
    mockPrisma = createMockPrismaClient();
    ocppService = new OcppService(mockPrisma);
    mockQueueService = new QueueService() as jest.Mocked<QueueService>;
    ocppController = new OcppController(ocppService, mockQueueService);
    // Don't initialize QueueProcessor in tests as it uses process() which is mocked
  });

  describe('Complete Charging Session Flow', () => {
    it('should handle complete charging session from BootNotification to StopTransaction', async () => {
      const cpId = 'CP001';

      // 1. Boot Notification
      const bootPayload = {
        chargePointVendor: 'TestVendor',
        chargePointModel: 'TestModel',
        firmwareVersion: '1.0.0',
        chargePointSerialNumber: 'SN123456'
      };

      const mockChargePoint = {
        cpId,
        vendor: bootPayload.chargePointVendor,
        model: bootPayload.chargePointModel,
        firmwareVersion: bootPayload.firmwareVersion,
        serialNumber: bootPayload.chargePointSerialNumber,
        lastSeen: new Date(),
        status: 'Available',
        additionalInfo: bootPayload,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.chargePoint.upsert.mockResolvedValue(mockChargePoint);

      const bootResponse = await ocppController.handleBootNotification(cpId, bootPayload);
      expect(bootResponse.status).toBe('Accepted');

      // 2. Status Notification - Available
      const statusPayload = {
        connectorId: 1,
        status: 'Available',
        errorCode: 'NoError'
      };

      mockQueueService.queueStatusNotification.mockResolvedValue({
        id: 'status-job-1',
        data: expect.any(Object)
      } as any);

      const statusResponse = await ocppController.handleStatusNotification(cpId, statusPayload);
      expect(statusResponse).toEqual({});

      // 3. Authorize
      const authorizePayload = { idTag: 'RFID123456' };

      const mockAuth = {
        id: 1,
        cpId,
        idTag: authorizePayload.idTag,
        status: 'Accepted',
        expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        timestamp: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.authorization.create.mockResolvedValue(mockAuth);

      const authResponse = await ocppController.handleAuthorize(cpId, authorizePayload);
      expect(authResponse.idTagInfo.status).toBe('Accepted');

      // 4. Start Transaction
      const startPayload = {
        connectorId: 1,
        idTag: 'RFID123456',
        meterStart: 1000,
        timestamp: new Date().toISOString()
      };

      const mockTransaction = {
        transactionId: 1,
        cpId,
        connectorId: startPayload.connectorId,
        idTag: startPayload.idTag,
        meterStart: startPayload.meterStart,
        startTimestamp: new Date(startPayload.timestamp),
        meterStop: null,
        stopTimestamp: null,
        stopReason: null,
        status: 'active',
        additionalInfo: { ...startPayload, startTimestamp: startPayload.timestamp } as any,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.transaction.findFirst.mockResolvedValue(null);
      mockPrisma.transaction.create.mockResolvedValue(mockTransaction);

      const startResponse = await ocppController.handleStartTransaction(cpId, startPayload);
      expect(startResponse.transactionId).toBe(1);
      expect(startResponse.idTagInfo.status).toBe('Accepted');

      // 5. Status Notification - Charging
      const chargingStatusPayload = {
        connectorId: 1,
        status: 'Charging',
        errorCode: 'NoError'
      };

      await ocppController.handleStatusNotification(cpId, chargingStatusPayload);

      // 6. Meter Values
      const meterValuesPayload = {
        connectorId: 1,
        transactionId: 1,
        meterValue: [
          {
            timestamp: new Date().toISOString(),
            sampledValue: [
              { value: '1500', measurand: 'Energy.Active.Import.Register', unit: 'Wh' },
              { value: '22.1', measurand: 'Voltage', phase: 'L1', unit: 'V' }
            ]
          }
        ]
      };

      mockQueueService.queueMeterValues.mockResolvedValue({
        id: 'meter-job-1',
        data: expect.any(Object)
      } as any);

      const meterResponse = await ocppController.handleMeterValues(cpId, meterValuesPayload);
      expect(meterResponse).toEqual({});

      // 7. Stop Transaction
      const stopPayload = {
        transactionId: 1,
        meterStop: 2000,
        timestamp: new Date().toISOString(),
        reason: 'Local'
      };

      const stoppedTransaction = {
        ...mockTransaction,
        meterStop: stopPayload.meterStop,
        stopTimestamp: new Date(),
        stopReason: stopPayload.reason,
        status: 'completed',
        additionalInfo: stopPayload
      };

      mockPrisma.transaction.update.mockResolvedValue(stoppedTransaction);

      const stopResponse = await ocppController.handleStopTransaction(cpId, stopPayload);
      expect(stopResponse.idTagInfo.status).toBe('Accepted');

      // Verify all database calls were made
      expect(mockPrisma.chargePoint.upsert).toHaveBeenCalledTimes(1);
      expect(mockPrisma.authorization.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.transaction.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.transaction.update).toHaveBeenCalledTimes(1);

      // Verify all queue calls were made
      expect(mockQueueService.queueStatusNotification).toHaveBeenCalledTimes(2);
      expect(mockQueueService.queueMeterValues).toHaveBeenCalledTimes(1);
    });

    it('should handle charging session with reconnection', async () => {
      const cpId = 'CP001';

      // Start a transaction
      const startPayload = {
        connectorId: 1,
        idTag: 'RFID123456',
        meterStart: 1000,
        timestamp: new Date().toISOString()
      };

      const mockTransaction = {
        transactionId: 1,
        cpId,
        connectorId: startPayload.connectorId,
        idTag: startPayload.idTag,
        meterStart: startPayload.meterStart,
        startTimestamp: new Date(startPayload.timestamp),
        meterStop: null,
        stopTimestamp: null,
        stopReason: null,
        status: 'active',
        additionalInfo: { ...startPayload, startTimestamp: startPayload.timestamp } as any,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.transaction.findFirst.mockResolvedValue(null);
      mockPrisma.transaction.create.mockResolvedValue(mockTransaction);

      await ocppController.handleStartTransaction(cpId, startPayload);

      // Simulate reconnection - should find active transaction
      mockPrisma.transaction.findMany.mockResolvedValue([mockTransaction]);
      mockPrisma.transaction.findUnique.mockResolvedValue(mockTransaction);

      const resumedTransaction = {
        ...mockTransaction,
        additionalInfo: {
          ...mockTransaction.additionalInfo,
          reconnectedAt: expect.any(String),
          reconnectionCount: 1,
        }
      };

      mockPrisma.transaction.update.mockResolvedValue(resumedTransaction as any);

      const activeTransactions = await ocppController.handleReconnection(cpId);

      expect(activeTransactions).toHaveLength(1);
      expect(activeTransactions[0].transactionId).toBe(1);
      expect(mockPrisma.transaction.update).toHaveBeenCalledWith({
        where: { transactionId: 1 },
        data: {
          additionalInfo: {
            ...mockTransaction.additionalInfo,
            reconnectedAt: expect.any(String),
            reconnectionCount: 1,
          },
        },
      });
    });
  });

  describe('Heartbeat Handling', () => {
    it('should process heartbeats and update last seen', async () => {
      const cpId = 'CP001';
      const heartbeatPayload = {};

      mockQueueService.queueHeartbeat.mockResolvedValue({
        id: 'heartbeat-job-1',
        data: { cpId, timestamp: expect.any(String) }
      } as any);

      const response = await ocppController.handleHeartbeat(cpId, heartbeatPayload);

      expect(response.currentTime).toBeDefined();
      expect(mockQueueService.queueHeartbeat).toHaveBeenCalledWith({
        cpId,
        timestamp: expect.any(String),
      });

      // Simulate processing the queued heartbeat
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

  describe('Multiple Connectors', () => {
    it('should handle transactions on multiple connectors simultaneously', async () => {
      const cpId = 'CP001';

      // Start transaction on connector 1
      const start1Payload = {
        connectorId: 1,
        idTag: 'RFID123456',
        meterStart: 1000,
        timestamp: new Date().toISOString()
      };

      const mockTransaction1 = {
        transactionId: 1,
        cpId,
        connectorId: 1,
        idTag: start1Payload.idTag,
        meterStart: start1Payload.meterStart,
        startTimestamp: new Date(start1Payload.timestamp),
        meterStop: null,
        stopTimestamp: null,
        stopReason: null,
        status: 'active',
        additionalInfo: { ...start1Payload, startTimestamp: start1Payload.timestamp } as any,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Start transaction on connector 2
      const start2Payload = {
        connectorId: 2,
        idTag: 'RFID789012',
        meterStart: 2000,
        timestamp: new Date().toISOString()
      };

      const mockTransaction2 = {
        transactionId: 2,
        cpId,
        connectorId: 2,
        idTag: start2Payload.idTag,
        meterStart: start2Payload.meterStart,
        startTimestamp: new Date(start2Payload.timestamp),
        meterStop: null,
        stopTimestamp: null,
        stopReason: null,
        status: 'active',
        additionalInfo: { ...start2Payload, startTimestamp: start2Payload.timestamp } as any,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Mock no existing transactions for both connectors
      mockPrisma.transaction.findFirst
        .mockResolvedValueOnce(null) // For connector 1
        .mockResolvedValueOnce(null); // For connector 2

      mockPrisma.transaction.create
        .mockResolvedValueOnce(mockTransaction1)
        .mockResolvedValueOnce(mockTransaction2);

      const response1 = await ocppController.handleStartTransaction(cpId, start1Payload);
      const response2 = await ocppController.handleStartTransaction(cpId, start2Payload);

      expect(response1.transactionId).toBe(1);
      expect(response2.transactionId).toBe(2);

      // Verify both transactions are created
      expect(mockPrisma.transaction.create).toHaveBeenCalledTimes(2);
    });

    it('should prevent starting transaction on occupied connector', async () => {
      const cpId = 'CP001';

      const existingTransaction = {
        transactionId: 1,
        cpId,
        connectorId: 1,
        idTag: 'EXISTING_RFID',
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

      const newTransactionPayload = {
        connectorId: 1,
        idTag: 'NEW_RFID',
        meterStart: 1000,
        timestamp: new Date().toISOString()
      };

      mockPrisma.transaction.findFirst.mockResolvedValue(existingTransaction);

      await expect(
        ocppController.handleStartTransaction(cpId, newTransactionPayload)
      ).rejects.toThrow('Connector 1 already has an active transaction');
    });
  });

  describe('Error Recovery', () => {
    it('should handle partial queue failures gracefully', async () => {
      const cpId = 'CP001';

      // Queue heartbeat successfully
      const heartbeatPayload = {};
      mockQueueService.queueHeartbeat.mockResolvedValue({
        id: 'heartbeat-job-1',
        data: expect.any(Object)
      } as any);

      await ocppController.handleHeartbeat(cpId, heartbeatPayload);

      // Queue status notification fails
      const statusPayload = {
        connectorId: 1,
        status: 'Available',
        errorCode: 'NoError'
      };

      mockQueueService.queueStatusNotification.mockRejectedValue(
        new Error('Queue service unavailable')
      );

      await expect(
        ocppController.handleStatusNotification(cpId, statusPayload)
      ).rejects.toThrow('Queue service unavailable');

      // Queue meter values should still work
      const meterPayload = {
        connectorId: 1,
        meterValue: [
          {
            timestamp: new Date().toISOString(),
            sampledValue: [{ value: '1500' }]
          }
        ]
      };

      mockQueueService.queueMeterValues.mockResolvedValue({
        id: 'meter-job-1',
        data: expect.any(Object)
      } as any);

      const meterResponse = await ocppController.handleMeterValues(cpId, meterPayload);
      expect(meterResponse).toEqual({});
    });

    it('should handle database recovery after connection loss', async () => {
      const cpId = 'CP001';
      const bootPayload = {
        chargePointVendor: 'TestVendor',
        chargePointModel: 'TestModel'
      };

      // First attempt fails
      mockPrisma.chargePoint.upsert.mockRejectedValueOnce(
        new Error('Database connection lost')
      );

      await expect(
        ocppController.handleBootNotification(cpId, bootPayload)
      ).rejects.toThrow('Database connection lost');

      // Second attempt succeeds
      const mockChargePoint = {
        cpId,
        vendor: bootPayload.chargePointVendor,
        model: bootPayload.chargePointModel,
        firmwareVersion: null,
        serialNumber: null,
        lastSeen: new Date(),
        status: 'Available',
        additionalInfo: bootPayload,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.chargePoint.upsert.mockResolvedValue(mockChargePoint);

      const response = await ocppController.handleBootNotification(cpId, bootPayload);
      expect(response.status).toBe('Accepted');
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle multiple rapid heartbeats', async () => {
      const cpId = 'CP001';
      const heartbeatCount = 100;

      mockQueueService.queueHeartbeat.mockImplementation(() => 
        Promise.resolve({
          id: `heartbeat-job-${Math.random()}`,
          data: expect.any(Object)
        } as any)
      );

      const heartbeatPromises = Array.from({ length: heartbeatCount }, () =>
        ocppController.handleHeartbeat(cpId, {})
      );

      const responses = await Promise.all(heartbeatPromises);

      expect(responses).toHaveLength(heartbeatCount);
      expect(mockQueueService.queueHeartbeat).toHaveBeenCalledTimes(heartbeatCount);
    });

    it('should handle multiple meter values efficiently', async () => {
      const cpId = 'CP001';
      const meterValueBatches = 50;

      mockQueueService.queueMeterValues.mockImplementation(() => 
        Promise.resolve({
          id: `meter-job-${Math.random()}`,
          data: expect.any(Object)
        } as any)
      );

      const meterPromises = Array.from({ length: meterValueBatches }, (_, i) =>
        ocppController.handleMeterValues(cpId, {
          connectorId: 1,
          transactionId: 1,
          meterValue: [
            {
              timestamp: new Date().toISOString(),
              sampledValue: [{ value: `${1500 + i}` }]
            }
          ]
        })
      );

      const responses = await Promise.all(meterPromises);

      expect(responses).toHaveLength(meterValueBatches);
      expect(mockQueueService.queueMeterValues).toHaveBeenCalledTimes(meterValueBatches);
    });
  });
});