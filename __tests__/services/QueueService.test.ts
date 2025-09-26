import { QueueService, HeartbeatJob, StatusNotificationJob, MeterValuesJob } from '../../src/services/QueueService';

// Mock the dependencies
jest.mock('ioredis');
jest.mock('bull');

describe('QueueService - Connection Management', () => {
  let queueService: QueueService;
  let mockHeartbeatQueue: any;
  let mockStatusNotificationQueue: any;
  let mockMeterValuesQueue: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock queue instances
    mockHeartbeatQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-id', data: {} }),
      close: jest.fn().mockResolvedValue(undefined),
      process: jest.fn().mockResolvedValue(undefined),
      getJobCounts: jest.fn().mockResolvedValue({
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
      }),
    };

    mockStatusNotificationQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-id', data: {} }),
      close: jest.fn().mockResolvedValue(undefined),
      process: jest.fn().mockResolvedValue(undefined),
      getJobCounts: jest.fn().mockResolvedValue({
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
      }),
    };

    mockMeterValuesQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-id', data: {} }),
      close: jest.fn().mockResolvedValue(undefined),
      process: jest.fn().mockResolvedValue(undefined),
      getJobCounts: jest.fn().mockResolvedValue({
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
      }),
    };

    // Mock Bull constructor to return our mock queues
    const Bull = require('bull');
    Bull.mockImplementation((queueName: string) => {
      if (queueName === 'heartbeat-queue') return mockHeartbeatQueue;
      if (queueName === 'status-notification-queue') return mockStatusNotificationQueue;
      if (queueName === 'meter-values-queue') return mockMeterValuesQueue;
      return {};
    });

    queueService = new QueueService();
  });

  describe('initialization', () => {
    it('should initialize with correct Redis configuration', () => {
      const Redis = require('ioredis');
      
      expect(Redis).toHaveBeenCalledWith({
        host: 'localhost',
        port: 6379,
        password: undefined,
        maxRetriesPerRequest: 3,
      });
    });

    it('should initialize queues with Redis configuration', () => {
      const Bull = require('bull');
      const expectedRedisConfig = {
        redis: {
          host: 'localhost',
          port: 6379,
          password: undefined,
        }
      };

      expect(Bull).toHaveBeenCalledWith('heartbeat-queue', expectedRedisConfig);
      expect(Bull).toHaveBeenCalledWith('status-notification-queue', expectedRedisConfig);
      expect(Bull).toHaveBeenCalledWith('meter-values-queue', expectedRedisConfig);
    });
  });

  describe('queueHeartbeat', () => {
    it('should queue heartbeat job with correct configuration', async () => {
      const heartbeatData: HeartbeatJob = {
        cpId: 'CP001',
        timestamp: new Date().toISOString(),
      };

      const result = await queueService.queueHeartbeat(heartbeatData);

      expect(mockHeartbeatQueue.add).toHaveBeenCalledWith(
        'process-heartbeat',
        heartbeatData,
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        }
      );

      expect(result).toEqual({ id: 'job-id', data: {} });
    });

    it('should handle queueing multiple heartbeats', async () => {
      const heartbeats = [
        { cpId: 'CP001', timestamp: new Date().toISOString() },
        { cpId: 'CP002', timestamp: new Date().toISOString() },
        { cpId: 'CP003', timestamp: new Date().toISOString() },
      ];

      for (const heartbeat of heartbeats) {
        await queueService.queueHeartbeat(heartbeat);
      }

      expect(mockHeartbeatQueue.add).toHaveBeenCalledTimes(3);
    });
  });

  describe('queueStatusNotification', () => {
    it('should queue status notification job with correct configuration', async () => {
      const statusData: StatusNotificationJob = {
        cpId: 'CP001',
        connectorId: 1,
        status: 'Available',
        errorCode: 'NoError',
        timestamp: new Date().toISOString(),
      };

      const result = await queueService.queueStatusNotification(statusData);

      expect(mockStatusNotificationQueue.add).toHaveBeenCalledWith(
        'process-status-notification',
        statusData,
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        }
      );

      expect(result).toEqual({ id: 'job-id', data: {} });
    });

    it('should queue status notification with optional fields', async () => {
      const statusData: StatusNotificationJob = {
        cpId: 'CP001',
        connectorId: 2,
        status: 'Faulted',
        errorCode: 'GroundFailure',
        info: 'Ground fault detected',
        vendorId: 'TestVendor',
        vendorErrorCode: 'GF001',
        timestamp: new Date().toISOString(),
        additionalInfo: { severity: 'high' },
      };

      await queueService.queueStatusNotification(statusData);

      expect(mockStatusNotificationQueue.add).toHaveBeenCalledWith(
        'process-status-notification',
        statusData,
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        }
      );
    });
  });

  describe('queueMeterValues', () => {
    it('should queue meter values job with correct configuration', async () => {
      const meterData: MeterValuesJob = {
        cpId: 'CP001',
        connectorId: 1,
        transactionId: 123,
        meterValues: [
          {
            timestamp: new Date().toISOString(),
            value: '1500',
            measurand: 'Energy.Active.Import.Register',
            unit: 'Wh',
          },
        ],
      };

      const result = await queueService.queueMeterValues(meterData);

      expect(mockMeterValuesQueue.add).toHaveBeenCalledWith(
        'process-meter-values',
        meterData,
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        }
      );

      expect(result).toEqual({ id: 'job-id', data: {} });
    });

    it('should queue meter values with multiple readings', async () => {
      const meterData: MeterValuesJob = {
        cpId: 'CP001',
        connectorId: 1,
        meterValues: [
          {
            timestamp: new Date().toISOString(),
            value: '1500',
            measurand: 'Energy.Active.Import.Register',
          },
          {
            timestamp: new Date().toISOString(),
            value: '22.1',
            measurand: 'Voltage',
            phase: 'L1',
          },
          {
            timestamp: new Date().toISOString(),
            value: '15.5',
            measurand: 'Current.Import',
            phase: 'L1',
          },
        ],
      };

      await queueService.queueMeterValues(meterData);

      expect(mockMeterValuesQueue.add).toHaveBeenCalledWith(
        'process-meter-values',
        meterData,
        expect.any(Object)
      );
    });
  });

  describe('queue getters', () => {
    it('should return heartbeat queue instance', () => {
      const heartbeatQueue = queueService.getHeartbeatQueue();
      expect(heartbeatQueue).toBe(mockHeartbeatQueue);
    });

    it('should return status notification queue instance', () => {
      const statusQueue = queueService.getStatusNotificationQueue();
      expect(statusQueue).toBe(mockStatusNotificationQueue);
    });

    it('should return meter values queue instance', () => {
      const meterQueue = queueService.getMeterValuesQueue();
      expect(meterQueue).toBe(mockMeterValuesQueue);
    });
  });

  describe('close', () => {
    it('should close all queues and Redis connection', async () => {
      const mockRedis = {
        quit: jest.fn().mockResolvedValue(undefined),
      };

      // Mock the redis instance
      (queueService as any).redis = mockRedis;

      await queueService.close();

      expect(mockHeartbeatQueue.close).toHaveBeenCalled();
      expect(mockStatusNotificationQueue.close).toHaveBeenCalled();
      expect(mockMeterValuesQueue.close).toHaveBeenCalled();
      expect(mockRedis.quit).toHaveBeenCalled();
    });

    it('should handle errors during close gracefully', async () => {
      const mockRedis = {
        quit: jest.fn().mockRejectedValue(new Error('Redis connection error')),
      };

      mockHeartbeatQueue.close.mockRejectedValue(new Error('Queue close error'));
      (queueService as any).redis = mockRedis;

      // Should not throw an error
      await expect(queueService.close()).rejects.toThrow('Queue close error');
    });
  });

  describe('getQueueStats', () => {
    it('should return statistics for all queues', async () => {
      const expectedStats = {
        heartbeat: {
          waiting: 5,
          active: 2,
          completed: 100,
          failed: 1,
        },
        statusNotification: {
          waiting: 3,
          active: 1,
          completed: 50,
          failed: 0,
        },
        meterValues: {
          waiting: 10,
          active: 5,
          completed: 200,
          failed: 2,
        },
      };

      mockHeartbeatQueue.getJobCounts.mockResolvedValue(expectedStats.heartbeat);
      mockStatusNotificationQueue.getJobCounts.mockResolvedValue(expectedStats.statusNotification);
      mockMeterValuesQueue.getJobCounts.mockResolvedValue(expectedStats.meterValues);

      const result = await queueService.getQueueStats();

      expect(result).toEqual(expectedStats);
      expect(mockHeartbeatQueue.getJobCounts).toHaveBeenCalled();
      expect(mockStatusNotificationQueue.getJobCounts).toHaveBeenCalled();
      expect(mockMeterValuesQueue.getJobCounts).toHaveBeenCalled();
    });

    it('should handle errors when getting queue stats', async () => {
      mockHeartbeatQueue.getJobCounts.mockRejectedValue(new Error('Queue error'));

      await expect(queueService.getQueueStats()).rejects.toThrow('Queue error');
    });
  });

  describe('environment configuration', () => {
    it('should use environment variables for Redis configuration', () => {
      // Set environment variables
      process.env.REDIS_HOST = 'redis.example.com';
      process.env.REDIS_PORT = '6380';
      process.env.REDIS_PASSWORD = 'secret123';

      // Create new instance to test environment configuration
      const newQueueService = new QueueService();

      const Redis = require('ioredis');
      
      // Check that Redis was called with environment values
      expect(Redis).toHaveBeenCalledWith({
        host: 'redis.example.com',
        port: 6380,
        password: 'secret123',
        maxRetriesPerRequest: 3,
      });

      // Clean up
      delete process.env.REDIS_HOST;
      delete process.env.REDIS_PORT;
      delete process.env.REDIS_PASSWORD;
    });
  });

  describe('job retry configuration', () => {
    it('should configure jobs with exponential backoff retry policy', async () => {
      const heartbeatData: HeartbeatJob = {
        cpId: 'CP001',
        timestamp: new Date().toISOString(),
      };

      await queueService.queueHeartbeat(heartbeatData);

      const expectedJobOptions = {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      };

      expect(mockHeartbeatQueue.add).toHaveBeenCalledWith(
        'process-heartbeat',
        heartbeatData,
        expectedJobOptions
      );
    });
  });

  describe('queue naming', () => {
    it('should use correct queue names', () => {
      const Bull = require('bull');

      expect(Bull).toHaveBeenCalledWith('heartbeat-queue', expect.any(Object));
      expect(Bull).toHaveBeenCalledWith('status-notification-queue', expect.any(Object));
      expect(Bull).toHaveBeenCalledWith('meter-values-queue', expect.any(Object));
    });
  });

  describe('connection resilience', () => {
    it('should configure Redis with retry options', () => {
      const Redis = require('ioredis');

      expect(Redis).toHaveBeenCalledWith(
        expect.objectContaining({
          maxRetriesPerRequest: 3,
        })
      );
    });
  });
});