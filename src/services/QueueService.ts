import Redis from 'ioredis';
import Bull, { Job } from 'bull';

export interface HeartbeatJob {
  cpId: string;
  timestamp: string;
}

export interface StatusNotificationJob {
  cpId: string;
  connectorId: number;
  status: string;
  errorCode?: string;
  info?: string;
  vendorId?: string;
  vendorErrorCode?: string;
  timestamp: string;
  additionalInfo?: any;
}

export interface MeterValuesJob {
  cpId: string;
  connectorId: number;
  transactionId?: number;
  meterValues: Array<{
    timestamp: string;
    value: string;
    context?: string;
    format?: string;
    measurand?: string;
    phase?: string;
    location?: string;
    unit?: string;
  }>;
}

export class QueueService {
  private redis: Redis;
  private heartbeatQueue: Bull.Queue<HeartbeatJob>;
  private statusNotificationQueue: Bull.Queue<StatusNotificationJob>;
  private meterValuesQueue: Bull.Queue<MeterValuesJob>;

  constructor() {
    // Initialize Redis connection
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: 3,
    });

    // Initialize queues
    const redisConfig = {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
      }
    };

    this.heartbeatQueue = new Bull<HeartbeatJob>('heartbeat-queue', redisConfig);
    this.statusNotificationQueue = new Bull<StatusNotificationJob>('status-notification-queue', redisConfig);
    this.meterValuesQueue = new Bull<MeterValuesJob>('meter-values-queue', redisConfig);

    console.log('Queue Service initialized');
  }

  // Queue heartbeat job
  async queueHeartbeat(data: HeartbeatJob): Promise<Job<HeartbeatJob>> {
    return this.heartbeatQueue.add('process-heartbeat', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });
  }

  // Queue status notification job
  async queueStatusNotification(data: StatusNotificationJob): Promise<Job<StatusNotificationJob>> {
    return this.statusNotificationQueue.add('process-status-notification', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });
  }

  // Queue meter values job
  async queueMeterValues(data: MeterValuesJob): Promise<Job<MeterValuesJob>> {
    return this.meterValuesQueue.add('process-meter-values', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });
  }

  // Get queue instances for setting up processors
  getHeartbeatQueue(): Bull.Queue<HeartbeatJob> {
    return this.heartbeatQueue;
  }

  getStatusNotificationQueue(): Bull.Queue<StatusNotificationJob> {
    return this.statusNotificationQueue;
  }

  getMeterValuesQueue(): Bull.Queue<MeterValuesJob> {
    return this.meterValuesQueue;
  }

  // Close all connections
  async close(): Promise<void> {
    await this.heartbeatQueue.close();
    await this.statusNotificationQueue.close();
    await this.meterValuesQueue.close();
    await this.redis.quit();
  }

  // Get queue statistics
  async getQueueStats() {
    const heartbeatStats = await this.heartbeatQueue.getJobCounts();
    const statusNotificationStats = await this.statusNotificationQueue.getJobCounts();
    const meterValuesStats = await this.meterValuesQueue.getJobCounts();

    return {
      heartbeat: heartbeatStats,
      statusNotification: statusNotificationStats,
      meterValues: meterValuesStats,
    };
  }
}