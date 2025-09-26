// Global test setup
import { PrismaClient } from '@prisma/client';

// Mock Redis and Bull for tests
jest.mock('ioredis', () => {
  const mockRedis = {
    quit: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
  };
  return jest.fn(() => mockRedis);
});

jest.mock('bull', () => {
  const mockJob = {
    id: 'test-job-id',
    data: {},
  };
  
  const mockQueue = {
    add: jest.fn().mockResolvedValue(mockJob),
    close: jest.fn().mockResolvedValue(undefined),
    process: jest.fn().mockResolvedValue(undefined),
    getJobCounts: jest.fn().mockResolvedValue({
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
    }),
  };
  
  return jest.fn(() => mockQueue);
});

// Global test timeout
jest.setTimeout(10000);

// Environment variables for tests
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/ocpp_test';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';