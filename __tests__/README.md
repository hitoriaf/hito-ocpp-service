# OCPP Service Test Suite

This directory contains comprehensive Jest tests for the OCPP (Open Charge Point Protocol) service, covering OCPP message handling, database operations, connection management, and error scenarios.

## Test Structure

```
__tests__/
├── setup.ts                          # Global test setup and configuration
├── mocks/
│   └── prisma.ts                      # Prisma client mock utilities
├── helpers/
│   └── test-utils.ts                  # Common test utilities and helpers
├── controllers/
│   └── OcppController.test.ts         # OCPP message handling tests
├── services/
│   ├── OcppService.test.ts           # Database operations tests
│   └── QueueService.test.ts          # Queue and connection management tests
├── integration/
│   └── ocpp-integration.test.ts      # End-to-end integration tests
└── error-scenarios.test.ts           # Comprehensive error handling tests
```

## Test Coverage Areas

### 1. OCPP Message Handling (`controllers/OcppController.test.ts`)
- **BootNotification**: Charge point registration and acceptance
- **Heartbeat**: Connection keep-alive mechanism
- **Authorize**: RFID tag authorization
- **StartTransaction**: Transaction initiation and conflict handling
- **StopTransaction**: Transaction completion and cleanup
- **StatusNotification**: Connector status updates
- **MeterValues**: Energy consumption data handling
- **Reconnection**: Active transaction resume on reconnect

### 2. Database Operations (`services/OcppService.test.ts`)
- Charge point registration (create/update)
- Transaction lifecycle management
- Authorization records
- Heartbeat logging
- Status notification storage
- Meter values batch processing
- Active transaction queries
- Transaction resumption logic

### 3. Connection Management (`services/QueueService.test.ts`)
- Redis connection handling
- Queue initialization and configuration
- Job queuing with retry policies
- Queue statistics and monitoring
- Connection pooling and resilience
- Graceful shutdown procedures

### 4. Error Scenarios (`error-scenarios.test.ts`)
- **Validation Errors**: Invalid payload handling
- **Database Failures**: Connection timeouts, constraint violations
- **Queue Failures**: Redis unavailability, queue overflow
- **Transaction Conflicts**: Concurrent operations, race conditions
- **Network Issues**: Timeouts, connection drops
- **Resource Exhaustion**: Memory limits, connection pools
- **Data Integrity**: Corrupted data, constraint violations

### 5. Integration Tests (`integration/ocpp-integration.test.ts`)
- Complete charging session flows
- Multi-connector scenarios
- Reconnection and session resume
- Performance and load testing
- Error recovery scenarios

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Tests in Watch Mode
```bash
npm run test:watch
```

### Generate Coverage Report
```bash
npm run test:coverage
```

### Run Tests for CI/CD
```bash
npm run test:ci
```

### Run Specific Test Suites
```bash
# OCPP message handling
npm test -- controllers/OcppController.test.ts

# Database operations
npm test -- services/OcppService.test.ts

# Queue management
npm test -- services/QueueService.test.ts

# Error scenarios
npm test -- error-scenarios.test.ts

# Integration tests
npm test -- integration/ocpp-integration.test.ts
```

## Test Configuration

The test suite uses:
- **Jest** as the testing framework
- **ts-jest** for TypeScript support
- **jest-mock-extended** for advanced mocking
- **Prisma mocks** for database operations
- **Redis/Bull mocks** for queue operations

Key configurations in `jest.config.js`:
- TypeScript compilation
- Coverage collection
- Test environment setup
- Mock configurations
- Timeout settings

## Mock Strategy

### Database Mocking
- Uses `jest-mock-extended` for type-safe Prisma mocks
- Provides realistic database responses
- Handles error scenarios and edge cases

### Queue Mocking
- Mocks Redis and Bull queue operations
- Simulates job processing and failures
- Tests retry policies and backoff strategies

### External Dependencies
- All external services are mocked
- Environment variables are controlled
- Network calls are intercepted

## Test Data Helpers

The `helpers/test-utils.ts` file provides:
- Mock data generators for all entity types
- Valid payload creators for OCPP messages
- Common assertion helpers
- Time manipulation utilities
- Error testing utilities

Example usage:
```typescript
import { 
  createMockTransaction, 
  createValidStartTransactionPayload,
  expectValidTransactionResponse 
} from '../helpers/test-utils';

const mockTransaction = createMockTransaction({ 
  connectorId: 2, 
  idTag: 'CUSTOM_RFID' 
});

const payload = createValidStartTransactionPayload({ 
  connectorId: 2 
});

const response = await controller.handleStartTransaction(cpId, payload);
expectValidTransactionResponse(response);
```

## Error Testing Patterns

### Validation Errors
Tests verify that invalid OCPP payloads are rejected with appropriate Zod validation errors.

### Database Errors
Simulates various database failure scenarios:
- Connection timeouts
- Constraint violations
- Transaction conflicts
- Data corruption

### Network Errors
Tests handling of network-related failures:
- Redis connection drops
- Queue service unavailability
- Timeout scenarios

### Concurrency Issues
Tests race conditions and concurrent operations:
- Multiple transaction starts on same connector
- Simultaneous charge point registrations
- Parallel queue operations

## Performance Testing

Integration tests include performance scenarios:
- Rapid heartbeat processing
- Bulk meter value handling
- Multi-connector operations
- High-load queue processing

## Coverage Goals

Target coverage metrics:
- **Lines**: >90%
- **Functions**: >95%
- **Branches**: >85%
- **Statements**: >90%

Critical paths require 100% coverage:
- Transaction lifecycle
- Safety-critical validations
- Error handling paths

## Test Environment

Tests run in an isolated environment with:
- Mocked external dependencies
- Controlled time and randomness
- Deterministic test data
- Clean state between tests

## Debugging Tests

### Verbose Output
```bash
npm test -- --verbose
```

### Debug Specific Test
```bash
npm test -- --testNamePattern="should handle valid StartTransaction"
```

### Coverage Analysis
```bash
npm run test:coverage
open coverage/lcov-report/index.html
```

## CI/CD Integration

The test suite is configured for continuous integration:
- Runs on every commit
- Generates coverage reports
- Fails builds on coverage drops
- Provides detailed error reporting

## Best Practices

1. **Test Isolation**: Each test is independent and doesn't affect others
2. **Meaningful Names**: Test descriptions clearly state what is being tested
3. **Arrange-Act-Assert**: Clear test structure with setup, execution, and verification
4. **Error Testing**: Every error path is tested with appropriate scenarios
5. **Mock Accuracy**: Mocks behave like real dependencies
6. **Performance Awareness**: Tests complete quickly while being thorough

## Contributing

When adding new tests:
1. Follow existing naming conventions
2. Add appropriate mocks for new dependencies
3. Include both happy path and error scenarios
4. Update test utilities if adding common patterns
5. Maintain or improve coverage metrics

## Troubleshooting

### Common Issues

**Tests timing out**: Increase timeout in jest.config.js or use `jest.setTimeout()`

**Mock not working**: Ensure mocks are properly configured in setup.ts

**Coverage issues**: Check that all code paths are tested, including error handlers

**Flaky tests**: Look for async operations without proper awaiting or cleanup