// Common test utilities and helpers

export const createMockTransaction = (overrides: Partial<any> = {}) => {
  const baseTransaction = {
    transactionId: 1,
    cpId: 'CP001',
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

  return { ...baseTransaction, ...overrides };
};

export const createMockChargePoint = (overrides: Partial<any> = {}) => {
  const baseChargePoint = {
    cpId: 'CP001',
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

  return { ...baseChargePoint, ...overrides };
};

export const createMockAuthorization = (overrides: Partial<any> = {}) => {
  const baseAuth = {
    id: 1,
    cpId: 'CP001',
    idTag: 'RFID123456',
    status: 'Accepted',
    expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    timestamp: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  };

  return { ...baseAuth, ...overrides };
};

export const createMockHeartbeat = (overrides: Partial<any> = {}) => {
  const baseHeartbeat = {
    id: 1,
    cpId: 'CP001',
    timestamp: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  };

  return { ...baseHeartbeat, ...overrides };
};

export const createMockStatusNotification = (overrides: Partial<any> = {}) => {
  const baseStatus = {
    id: 1,
    cpId: 'CP001',
    connectorId: 1,
    status: 'Available',
    errorCode: 'NoError',
    info: null,
    vendorId: null,
    vendorErrorCode: null,
    timestamp: new Date(),
    additionalInfo: null,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  return { ...baseStatus, ...overrides };
};

export const createMockMeterValue = (overrides: Partial<any> = {}) => {
  const baseMeterValue = {
    id: 1,
    cpId: 'CP001',
    connectorId: 1,
    transactionId: 1,
    timestamp: new Date(),
    value: '1500',
    context: null,
    format: null,
    measurand: 'Energy.Active.Import.Register',
    phase: null,
    location: null,
    unit: 'Wh',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  return { ...baseMeterValue, ...overrides };
};

export const createValidBootNotificationPayload = (overrides: Partial<any> = {}) => {
  const basePayload = {
    chargePointVendor: 'TestVendor',
    chargePointModel: 'TestModel',
    firmwareVersion: '1.0.0',
    chargePointSerialNumber: 'SN123456'
  };

  return { ...basePayload, ...overrides };
};

export const createValidStartTransactionPayload = (overrides: Partial<any> = {}) => {
  const basePayload = {
    connectorId: 1,
    idTag: 'RFID123456',
    meterStart: 1000,
    timestamp: new Date().toISOString()
  };

  return { ...basePayload, ...overrides };
};

export const createValidStopTransactionPayload = (overrides: Partial<any> = {}) => {
  const basePayload = {
    transactionId: 1,
    meterStop: 2000,
    timestamp: new Date().toISOString(),
    reason: 'Local'
  };

  return { ...basePayload, ...overrides };
};

export const createValidStatusNotificationPayload = (overrides: Partial<any> = {}) => {
  const basePayload = {
    connectorId: 1,
    status: 'Available',
    errorCode: 'NoError'
  };

  return { ...basePayload, ...overrides };
};

export const createValidMeterValuesPayload = (overrides: Partial<any> = {}) => {
  const basePayload = {
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

  return { ...basePayload, ...overrides };
};

export const createValidAuthorizePayload = (overrides: Partial<any> = {}) => {
  const basePayload = {
    idTag: 'RFID123456'
  };

  return { ...basePayload, ...overrides };
};

// Common test expectations
export const expectValidOcppResponse = (response: any, expectedStatus = 'Accepted') => {
  expect(response).toBeDefined();
  if (response.status) {
    expect(response.status).toBe(expectedStatus);
  }
  if (response.idTagInfo) {
    expect(response.idTagInfo.status).toBe(expectedStatus);
  }
};

export const expectValidTransactionResponse = (response: any) => {
  expect(response).toBeDefined();
  expect(response.transactionId).toBeDefined();
  expect(typeof response.transactionId).toBe('number');
  expect(response.idTagInfo).toBeDefined();
  expect(response.idTagInfo.status).toBe('Accepted');
};

// Time helpers
export const addHours = (date: Date, hours: number): Date => {
  const result = new Date(date);
  result.setHours(result.getHours() + hours);
  return result;
};

export const addMinutes = (date: Date, minutes: number): Date => {
  const result = new Date(date);
  result.setMinutes(result.getMinutes() + minutes);
  return result;
};

// Error testing helpers
export const expectZodValidationError = async (promise: Promise<any>) => {
  await expect(promise).rejects.toThrow();
};

export const expectDatabaseError = async (promise: Promise<any>, errorMessage?: string) => {
  if (errorMessage) {
    await expect(promise).rejects.toThrow(errorMessage);
  } else {
    await expect(promise).rejects.toThrow();
  }
};

// Queue job helpers
export const createMockJob = (data: any, id = 'test-job-id') => ({
  id,
  data,
  opts: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  }
});

// Database result helpers
export const createMockBatchResult = (count: number) => ({
  count
});

export const createMockUpdateManyResult = (count: number) => ({
  count
});