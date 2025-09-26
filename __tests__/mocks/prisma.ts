// Mock Prisma Client for tests
import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';

export type MockPrismaClient = DeepMockProxy<PrismaClient>;

const mockPrisma = mockDeep<PrismaClient>();

export const createMockPrismaClient = (): MockPrismaClient => {
  mockReset(mockPrisma);
  return mockPrisma;
};

export { mockPrisma };