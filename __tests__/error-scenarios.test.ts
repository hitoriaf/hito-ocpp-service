import { OcppController } from '../src/controllers/OcppController';
import { OcppService } from '../src/services/OcppService';
import { QueueService } from '../src/services/QueueService';
import { createMockPrismaClient, MockPrismaClient } from './mocks/prisma';
import { ZodError } from 'zod';

jest.mock('../src/services/QueueService');

describe('OCPP Service - Error Scenarios', () => {
  let ocppController: OcppController;
  let ocppService: OcppService;
  let mockPrisma: MockPrismaClient;
  let mockQueueService: jest.Mocked<QueueService>;

  beforeEach(() => {
    mockPrisma = createMockPrismaClient();
    ocppService = new OcppService(mockPrisma);
    mockQueueService = new QueueService() as jest.Mocked<QueueService>;
    ocppController = new OcppController(ocppService, mockQueueService);
  });

  describe('Validation Errors', () => {
    it('should handle invalid BootNotification payload', async () => {
      const cpId = 'CP001';
      const invalidPayload = {
        chargePointModel: 'TestModel',
        // Missing required chargePointVendor
      };

      await expect(
        ocppController.handleBootNotification(cpId, invalidPayload)
      ).rejects.toThrow(ZodError);
    });

    it('should handle invalid StartTransaction payload', async () => {
      const cpId = 'CP001';
      const invalidPayload = {
        connectorId: 'invalid_number', // Should be number
        idTag: 'RFID123456',
        meterStart: 1000,
        timestamp: new Date().toISOString()
      };

      await expect(
        ocppController.handleStartTransaction(cpId, invalidPayload)
      ).rejects.toThrow(ZodError);
    });

    it('should handle invalid StopTransaction payload', async () => {
      const cpId = 'CP001';
      const invalidPayload = {
        meterStop: 'invalid_number', // Should be number
        timestamp: new Date().toISOString(),
        transactionId: 1
      };

      await expect(
        ocppController.handleStopTransaction(cpId, invalidPayload)
      ).rejects.toThrow(ZodError);
    });

    it('should handle invalid Authorize payload', async () => {
      const cpId = 'CP001';
      const invalidPayload = {}; // Missing required idTag

      await expect(
        ocppController.handleAuthorize(cpId, invalidPayload)
      ).rejects.toThrow(ZodError);
    });

    it('should handle invalid StatusNotification payload', async () => {
      const cpId = 'CP001';
      const invalidPayload = {
        status: 'Available',
        // Missing required connectorId and errorCode
      };

      await expect(
        ocppController.handleStatusNotification(cpId, invalidPayload)
      ).rejects.toThrow(ZodError);
    });

    it('should handle invalid MeterValues payload', async () => {
      const cpId = 'CP001';
      const invalidPayload = {
        connectorId: 'invalid', // Should be number
        meterValue: []
      };

      await expect(
        ocppController.handleMeterValues(cpId, invalidPayload)
      ).rejects.toThrow(ZodError);
    });
  });

  describe('Database Connection Errors', () => {
    it('should handle database connection failure during BootNotification', async () => {
      const cpId = 'CP001';
      const payload = {
        chargePointVendor: 'TestVendor',
        chargePointModel: 'TestModel'
      };

      mockPrisma.chargePoint.upsert.mockRejectedValue(new Error('Database connection lost'));

      await expect(
        ocppController.handleBootNotification(cpId, payload)
      ).rejects.toThrow('Database connection lost');
    });

    it('should handle database timeout during transaction creation', async () => {
      const cpId = 'CP001';
      const payload = {
        connectorId: 1,
        idTag: 'RFID123456',
        meterStart: 1000,
        timestamp: new Date().toISOString()
      };

      mockPrisma.transaction.findFirst.mockResolvedValue(null);
      mockPrisma.transaction.create.mockRejectedValue(new Error('Query timeout'));

      await expect(
        ocppController.handleStartTransaction(cpId, payload)
      ).rejects.toThrow('Query timeout');
    });

    it('should handle database constraint violation', async () => {
      const cpId = 'CP001';
      const payload = {
        connectorId: 1,
        idTag: 'RFID123456',
        meterStart: 1000,
        timestamp: new Date().toISOString()
      };

      mockPrisma.transaction.findFirst.mockResolvedValue(null);
      mockPrisma.transaction.create.mockRejectedValue(
        new Error('Unique constraint failed on the fields: (`transactionId`)')
      );

      await expect(
        ocppController.handleStartTransaction(cpId, payload)
      ).rejects.toThrow('Unique constraint failed');
    });

    it('should handle authorization database error', async () => {
      const cpId = 'CP001';
      const payload = { idTag: 'RFID123456' };

      mockPrisma.authorization.create.mockRejectedValue(new Error('Database error'));

      await expect(
        ocppController.handleAuthorize(cpId, payload)
      ).rejects.toThrow('Database error');
    });
  });

  describe('Queue Service Errors', () => {
    it('should handle queue connection failure for heartbeat', async () => {
      const cpId = 'CP001';
      const payload = {};

      mockQueueService.queueHeartbeat.mockRejectedValue(new Error('Redis connection failed'));

      await expect(
        ocppController.handleHeartbeat(cpId, payload)
      ).rejects.toThrow('Redis connection failed');
    });

    it('should handle queue full error for status notification', async () => {
      const cpId = 'CP001';
      const payload = {
        connectorId: 1,
        status: 'Available',
        errorCode: 'NoError'
      };

      mockQueueService.queueStatusNotification.mockRejectedValue(new Error('Queue is full'));

      await expect(
        ocppController.handleStatusNotification(cpId, payload)
      ).rejects.toThrow('Queue is full');
    });

    it('should handle queue processing error for meter values', async () => {
      const cpId = 'CP001';
      const payload = {
        connectorId: 1,
        meterValue: [
          {
            timestamp: new Date().toISOString(),
            sampledValue: [{ value: '1500' }]
          }
        ]
      };

      mockQueueService.queueMeterValues.mockRejectedValue(new Error('Queue processing error'));

      await expect(
        ocppController.handleMeterValues(cpId, payload)
      ).rejects.toThrow('Queue processing error');
    });
  });

  describe('Transaction Conflicts', () => {
    it('should handle concurrent transaction start attempts', async () => {
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
        connectorId: 1,
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

      await expect(
        ocppController.handleStartTransaction(cpId, payload)
      ).rejects.toThrow('Connector 1 already has an active transaction');
    });

    it('should handle stopping non-existent transaction', async () => {
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

    it('should handle transaction update failure', async () => {
      const cpId = 'CP001';
      const payload = {
        transactionId: 1,
        meterStop: 2000,
        timestamp: new Date().toISOString(),
        reason: 'Local'
      };

      mockPrisma.transaction.update.mockRejectedValue(new Error('Transaction not found'));

      await expect(
        ocppController.handleStopTransaction(cpId, payload)
      ).rejects.toThrow('Transaction not found');
    });
  });

  describe('Reconnection Handling Errors', () => {
    it('should handle database error during active transaction lookup', async () => {
      const cpId = 'CP001';

      mockPrisma.transaction.findMany.mockRejectedValue(new Error('Database query failed'));

      await expect(
        ocppController.handleReconnection(cpId)
      ).rejects.toThrow('Database query failed');
    });

    it('should handle transaction resume failure', async () => {
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
      mockPrisma.transaction.findUnique.mockResolvedValue(null); // Transaction not found during resume

      await expect(
        ocppController.handleReconnection(cpId)
      ).rejects.toThrow('Transaction 1 not found');
    });

    it('should handle partial transaction resume failures', async () => {
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
        .mockResolvedValueOnce({ ...activeTransactions[0], additionalInfo: {} } as any)
        .mockRejectedValueOnce(new Error('Update failed for transaction 2'));

      await expect(
        ocppController.handleReconnection(cpId)
      ).rejects.toThrow('Update failed for transaction 2');
    });
  });

  describe('Resource Exhaustion', () => {
    it('should handle memory exhaustion during large meter values processing', async () => {
      const cpId = 'CP001';
      
      // Create a payload with many meter values
      const largeMeterValues = Array.from({ length: 10000 }, (_, i) => ({
        timestamp: new Date().toISOString(),
        sampledValue: [{ value: `${1000 + i}` }]
      }));

      const payload = {
        connectorId: 1,
        meterValue: largeMeterValues
      };

      mockQueueService.queueMeterValues.mockRejectedValue(new Error('Out of memory'));

      await expect(
        ocppController.handleMeterValues(cpId, payload)
      ).rejects.toThrow('Out of memory');
    });

    it('should handle database connection pool exhaustion', async () => {
      const cpId = 'CP001';
      const payload = {
        chargePointVendor: 'TestVendor',
        chargePointModel: 'TestModel'
      };

      mockPrisma.chargePoint.upsert.mockRejectedValue(
        new Error('Connection pool exhausted')
      );

      await expect(
        ocppController.handleBootNotification(cpId, payload)
      ).rejects.toThrow('Connection pool exhausted');
    });
  });

  describe('Network and Timeout Errors', () => {
    it('should handle network timeout during database operations', async () => {
      const cpId = 'CP001';
      const payload = { idTag: 'RFID123456' };

      mockPrisma.authorization.create.mockRejectedValue(
        new Error('Network timeout')
      );

      await expect(
        ocppController.handleAuthorize(cpId, payload)
      ).rejects.toThrow('Network timeout');
    });

    it('should handle Redis connection timeout', async () => {
      const cpId = 'CP001';
      const payload = {};

      mockQueueService.queueHeartbeat.mockRejectedValue(
        new Error('Connection timeout')
      );

      await expect(
        ocppController.handleHeartbeat(cpId, payload)
      ).rejects.toThrow('Connection timeout');
    });
  });

  describe('Data Integrity Errors', () => {
    it('should handle corrupted transaction data', async () => {
      const cpId = 'CP001';
      const payload = {
        transactionId: 1,
        meterStop: 2000,
        timestamp: new Date().toISOString()
      };

      // Mock corrupted data scenario
      const corruptedTransaction = {
        transactionId: 1,
        cpId: null, // Corrupted data
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
      };

      mockPrisma.transaction.update.mockRejectedValue(
        new Error('Data integrity constraint violation')
      );

      await expect(
        ocppController.handleStopTransaction(cpId, payload)
      ).rejects.toThrow('Data integrity constraint violation');
    });

    it('should handle malformed JSON in additional info', async () => {
      const cpId = 'CP001';
      const payload = {
        connectorId: 1,
        idTag: 'RFID123456',
        meterStart: 1000,
        timestamp: new Date().toISOString()
      };

      mockPrisma.transaction.findFirst.mockResolvedValue(null);
      mockPrisma.transaction.create.mockRejectedValue(
        new Error('Invalid JSON format in additionalInfo field')
      );

      await expect(
        ocppController.handleStartTransaction(cpId, payload)
      ).rejects.toThrow('Invalid JSON format in additionalInfo field');
    });
  });

  describe('Service Dependency Failures', () => {
    it('should handle OcppService initialization with invalid Prisma client', () => {
      const invalidPrisma = {} as any; // Empty object instead of null
      
      // This should not throw during construction, but would fail during actual operations
      const service = new OcppService(invalidPrisma);
      expect(service).toBeDefined();
    });

    it('should handle OcppController initialization with invalid QueueService', () => {
      const invalidQueueService = {} as any; // Empty object instead of null
      
      // This should not throw during construction, but would fail during actual operations
      const controller = new OcppController(ocppService, invalidQueueService);
      expect(controller).toBeDefined();
    });
  });

  describe('Concurrent Operation Errors', () => {
    it('should handle race condition in transaction creation', async () => {
      const cpId = 'CP001';
      const payload = {
        connectorId: 1,
        idTag: 'RFID123456',
        meterStart: 1000,
        timestamp: new Date().toISOString()
      };

      // Simulate race condition: findFirst returns null, but create fails due to concurrent insert
      mockPrisma.transaction.findFirst.mockResolvedValue(null);
      mockPrisma.transaction.create.mockRejectedValue(
        new Error('Duplicate key violation - transaction already exists')
      );

      await expect(
        ocppController.handleStartTransaction(cpId, payload)
      ).rejects.toThrow('Duplicate key violation - transaction already exists');
    });

    it('should handle concurrent charge point registration', async () => {
      const cpId = 'CP001';
      const payload = {
        chargePointVendor: 'TestVendor',
        chargePointModel: 'TestModel'
      };

      mockPrisma.chargePoint.upsert.mockRejectedValue(
        new Error('Concurrent modification detected')
      );

      await expect(
        ocppController.handleBootNotification(cpId, payload)
      ).rejects.toThrow('Concurrent modification detected');
    });
  });
});