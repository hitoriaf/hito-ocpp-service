import { z } from 'zod';

// BootNotification
export const BootNotificationRequestSchema = z.object({
  chargePointVendor: z.string(),
  chargePointModel: z.string(),
  chargePointSerialNumber: z.string().optional(),
  chargeBoxSerialNumber: z.string().optional(),
  firmwareVersion: z.string().optional(),
  iccid: z.string().optional(),
  imsi: z.string().optional(),
  meterType: z.string().optional(),
  meterSerialNumber: z.string().optional()
});

// Heartbeat
export const HeartbeatRequestSchema = z.object({});

// Authorize
export const AuthorizeRequestSchema = z.object({
  idTag: z.string()
});

// StartTransaction
export const StartTransactionRequestSchema = z.object({
  connectorId: z.number(),
  idTag: z.string(),
  meterStart: z.number(),
  reservationId: z.number().optional(),
  timestamp: z.string()
});

// StopTransaction
export const StopTransactionRequestSchema = z.object({
  meterStop: z.number(),
  timestamp: z.string(),
  transactionId: z.number(),
  reason: z.string().optional(),
  idTag: z.string().optional(),
  transactionData: z.array(z.any()).optional()
});

// StatusNotification
export const StatusNotificationRequestSchema = z.object({
  connectorId: z.number(),
  errorCode: z.string(),
  status: z.string(),
  timestamp: z.string().optional(),
  info: z.string().optional(),
  vendorId: z.string().optional(),
  vendorErrorCode: z.string().optional()
});

// MeterValues
export const SampledValueSchema = z.object({
  value: z.string(),
  measurand: z.string().optional(),
  phase: z.string().optional(),
  unit: z.string().optional()
});

export const MeterValueSchema = z.object({
  timestamp: z.string(),
  sampledValue: z.array(SampledValueSchema)
});

export const MeterValuesRequestSchema = z.object({
  connectorId: z.number(),
  transactionId: z.number().optional(),
  meterValue: z.array(MeterValueSchema)
});

// DataTransfer
export const DataTransferRequestSchema = z.object({
  vendorId: z.string(),
  messageId: z.string().optional(),
  data: z.string().optional()
});