-- CreateTable
CREATE TABLE "charge_points" (
    "cp_id" TEXT NOT NULL,
    "model" TEXT,
    "vendor" TEXT,
    "firmware_version" TEXT,
    "serial_number" TEXT,
    "last_seen" TIMESTAMP(3),
    "status" TEXT DEFAULT 'Available',
    "additional_info" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "charge_points_pkey" PRIMARY KEY ("cp_id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "transaction_id" SERIAL NOT NULL,
    "cp_id" TEXT NOT NULL,
    "connector_id" INTEGER NOT NULL,
    "id_tag" TEXT NOT NULL,
    "meter_start" DOUBLE PRECISION,
    "start_timestamp" TIMESTAMP(3) NOT NULL,
    "meter_stop" DOUBLE PRECISION,
    "stop_timestamp" TIMESTAMP(3),
    "stop_reason" TEXT,
    "stop_id_tag" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("transaction_id")
);

-- CreateTable
CREATE TABLE "heartbeats" (
    "id" SERIAL NOT NULL,
    "cp_id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "heartbeats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "authorizations" (
    "id" SERIAL NOT NULL,
    "cp_id" TEXT NOT NULL,
    "id_tag" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Accepted',
    "expiry_date" TIMESTAMP(3),
    "parent_id_tag" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "additional_info" JSONB,

    CONSTRAINT "authorizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "status_notifications" (
    "id" SERIAL NOT NULL,
    "cp_id" TEXT NOT NULL,
    "connector_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "error_code" TEXT,
    "info" TEXT,
    "vendor_id" TEXT,
    "vendor_error_code" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "additional_info" JSONB,

    CONSTRAINT "status_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meter_values" (
    "id" SERIAL NOT NULL,
    "cp_id" TEXT NOT NULL,
    "connector_id" INTEGER NOT NULL,
    "transaction_id" INTEGER,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "value" TEXT NOT NULL,
    "context" TEXT,
    "format" TEXT,
    "measurand" TEXT,
    "phase" TEXT,
    "location" TEXT,
    "unit" TEXT,

    CONSTRAINT "meter_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_transfers" (
    "id" SERIAL NOT NULL,
    "cp_id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "message_id" TEXT,
    "data" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Accepted',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_transfers_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_cp_id_fkey" FOREIGN KEY ("cp_id") REFERENCES "charge_points"("cp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "heartbeats" ADD CONSTRAINT "heartbeats_cp_id_fkey" FOREIGN KEY ("cp_id") REFERENCES "charge_points"("cp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authorizations" ADD CONSTRAINT "authorizations_cp_id_fkey" FOREIGN KEY ("cp_id") REFERENCES "charge_points"("cp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_notifications" ADD CONSTRAINT "status_notifications_cp_id_fkey" FOREIGN KEY ("cp_id") REFERENCES "charge_points"("cp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meter_values" ADD CONSTRAINT "meter_values_cp_id_fkey" FOREIGN KEY ("cp_id") REFERENCES "charge_points"("cp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meter_values" ADD CONSTRAINT "meter_values_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("transaction_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_transfers" ADD CONSTRAINT "data_transfers_cp_id_fkey" FOREIGN KEY ("cp_id") REFERENCES "charge_points"("cp_id") ON DELETE RESTRICT ON UPDATE CASCADE;
