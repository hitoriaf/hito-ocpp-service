import { Job } from 'bull';
import { OcppService } from './OcppService';
import { QueueService, HeartbeatJob, StatusNotificationJob, MeterValuesJob } from './QueueService';

export class QueueProcessor {
  constructor(
    private ocppService: OcppService,
    private queueService: QueueService
  ) {
    this.setupProcessors();
  }

  private setupProcessors(): void {
    // Heartbeat processor
    this.queueService.getHeartbeatQueue().process('process-heartbeat', 5, async (job: Job<HeartbeatJob>) => {
      console.log(`Processing heartbeat job for CP ${job.data.cpId}`);
      
      try {
        await this.ocppService.recordHeartbeat(job.data.cpId);
        console.log(`Heartbeat processed successfully for CP ${job.data.cpId}`);
      } catch (error) {
        console.error(`Failed to process heartbeat for CP ${job.data.cpId}:`, error);
        throw error; // This will mark the job as failed and trigger retry
      }
    });

    // Status notification processor
    this.queueService.getStatusNotificationQueue().process('process-status-notification', 5, async (job: Job<StatusNotificationJob>) => {
      console.log(`Processing status notification job for CP ${job.data.cpId}, connector ${job.data.connectorId}`);
      
      try {
        await this.ocppService.recordStatusNotification({
          cpId: job.data.cpId,
          connectorId: job.data.connectorId,
          status: job.data.status,
          errorCode: job.data.errorCode,
          info: job.data.info,
          vendorId: job.data.vendorId,
          vendorErrorCode: job.data.vendorErrorCode,
          additionalInfo: job.data.additionalInfo,
        });
        console.log(`Status notification processed successfully for CP ${job.data.cpId}`);
      } catch (error) {
        console.error(`Failed to process status notification for CP ${job.data.cpId}:`, error);
        throw error;
      }
    });

    // Meter values processor
    this.queueService.getMeterValuesQueue().process('process-meter-values', 5, async (job: Job<MeterValuesJob>) => {
      console.log(`Processing meter values job for CP ${job.data.cpId}, connector ${job.data.connectorId}`);
      
      try {
        // Convert string timestamps back to Date objects
        const meterValues = job.data.meterValues.map(mv => ({
          ...mv,
          timestamp: new Date(mv.timestamp),
        }));

        await this.ocppService.recordMeterValues({
          cpId: job.data.cpId,
          connectorId: job.data.connectorId,
          transactionId: job.data.transactionId,
          meterValues,
        });
        console.log(`Meter values processed successfully for CP ${job.data.cpId}`);
      } catch (error) {
        console.error(`Failed to process meter values for CP ${job.data.cpId}:`, error);
        throw error;
      }
    });

    // Set up event listeners for job status
    this.setupEventListeners();

    console.log('Queue processors initialized');
  }

  private setupEventListeners(): void {
    // Heartbeat queue events
    this.queueService.getHeartbeatQueue().on('completed', (job: Job<HeartbeatJob>) => {
      console.log(`Heartbeat job ${job.id} completed for CP ${job.data.cpId}`);
    });

    this.queueService.getHeartbeatQueue().on('failed', (job: Job<HeartbeatJob>, err: Error) => {
      console.error(`Heartbeat job ${job.id} failed for CP ${job.data.cpId}:`, err.message);
    });

    // Status notification queue events
    this.queueService.getStatusNotificationQueue().on('completed', (job: Job<StatusNotificationJob>) => {
      console.log(`Status notification job ${job.id} completed for CP ${job.data.cpId}`);
    });

    this.queueService.getStatusNotificationQueue().on('failed', (job: Job<StatusNotificationJob>, err: Error) => {
      console.error(`Status notification job ${job.id} failed for CP ${job.data.cpId}:`, err.message);
    });

    // Meter values queue events
    this.queueService.getMeterValuesQueue().on('completed', (job: Job<MeterValuesJob>) => {
      console.log(`Meter values job ${job.id} completed for CP ${job.data.cpId}`);
    });

    this.queueService.getMeterValuesQueue().on('failed', (job: Job<MeterValuesJob>, err: Error) => {
      console.error(`Meter values job ${job.id} failed for CP ${job.data.cpId}:`, err.message);
    });
  }
}