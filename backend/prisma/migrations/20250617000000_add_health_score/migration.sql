-- CreateEnum
CREATE TYPE "HealthDimension" AS ENUM ('EMERGENCY_RESERVE', 'ASSET_ALLOCATION', 'GROWTH_STABILITY', 'INVENTORY_TIMELINESS');

-- CreateTable
CREATE TABLE "health_configs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "monthly_expense" DECIMAL(15,2) NOT NULL,
    "target_cash_ratio" DECIMAL(5,4) NOT NULL,
    "target_long_term_invest_ratio" DECIMAL(5,4) NOT NULL,
    "target_stable_bond_ratio" DECIMAL(5,4) NOT NULL,
    "emergency_reserve_weight" DECIMAL(5,4) NOT NULL,
    "asset_allocation_weight" DECIMAL(5,4) NOT NULL,
    "growth_stability_weight" DECIMAL(5,4) NOT NULL,
    "inventory_timeliness_weight" DECIMAL(5,4) NOT NULL,
    "volatility_window_months" INTEGER NOT NULL DEFAULT 6,
    "min_emergency_reserve_months" INTEGER NOT NULL DEFAULT 3,
    "ideal_emergency_reserve_months" INTEGER NOT NULL DEFAULT 6,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "health_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_scores" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "total_score" DECIMAL(5,2) NOT NULL,
    "emergency_reserve_score" DECIMAL(5,2) NOT NULL,
    "asset_allocation_score" DECIMAL(5,2) NOT NULL,
    "growth_stability_score" DECIMAL(5,2) NOT NULL,
    "inventory_timeliness_score" DECIMAL(5,2) NOT NULL,
    "emergency_reserve_weight" DECIMAL(5,4) NOT NULL,
    "asset_allocation_weight" DECIMAL(5,4) NOT NULL,
    "growth_stability_weight" DECIMAL(5,4) NOT NULL,
    "inventory_timeliness_weight" DECIMAL(5,4) NOT NULL,
    "emergency_reserve_suggestion" VARCHAR(500) NOT NULL,
    "asset_allocation_suggestion" VARCHAR(500) NOT NULL,
    "growth_stability_suggestion" VARCHAR(500) NOT NULL,
    "inventory_timeliness_suggestion" VARCHAR(500) NOT NULL,
    "data_quality" VARCHAR(20) NOT NULL,
    "data_quality_note" VARCHAR(500),
    "calculated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "health_scores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "health_configs_user_id_key" ON "health_configs"("user_id");

-- CreateIndex
CREATE INDEX "health_scores_user_id_idx" ON "health_scores"("user_id");

-- CreateIndex
CREATE INDEX "health_scores_user_id_calculated_at_idx" ON "health_scores"("user_id", "calculated_at");

-- AddForeignKey
ALTER TABLE "health_configs" ADD CONSTRAINT "health_configs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_scores" ADD CONSTRAINT "health_scores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
