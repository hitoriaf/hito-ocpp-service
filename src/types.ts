// Simple types based on Prisma models
export type ChargePoint = {
  cpId: string;
  model?: string;
  vendor?: string;
  firmwareVersion?: string;
  serialNumber?: string;
  lastSeen?: Date;
  status?: string;
};

export type Transaction = {
  transactionId: number;
  cpId: string;
  connectorId: number;
  idTag: string;
  meterStart?: number;
  startTimestamp: Date;
  meterStop?: number;
  stopTimestamp?: Date;
  stopReason?: string;
  stopIdTag?: string;
  status: string;
};

export type CreateTransactionData = {
  cpId: string;
  connectorId: number;
  idTag: string;
  meterStart?: number;
  startTimestamp: Date;
};