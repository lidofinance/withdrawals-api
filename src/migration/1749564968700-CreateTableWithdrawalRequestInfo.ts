import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTableWithdrawalRequestInfo1749564968700 implements MigrationInterface {
  name = 'CreateTableWithdrawalRequestInfo1749564968700';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."waiting_time_calculation_type" AS ENUM('buffer', 'bunker', 'vaultsBalance', 'rewardsOnly', 'validatorBalances', 'requestTimestampMargin', 'exitValidators')`,
    );
    await queryRunner.query(
      `CREATE TABLE "withdrawal_request_info" ("id" SERIAL NOT NULL, "request_id" integer NOT NULL, "amount" character varying NOT NULL, "request_epoch" integer NOT NULL, "request_timestamp" TIMESTAMP WITH TIME ZONE NOT NULL, "first_calculated_finalization_timestamp" TIMESTAMP WITH TIME ZONE, "first_calculated_finalization_type" "public"."waiting_time_calculation_type", "finalized_at" TIMESTAMP WITH TIME ZONE, "max_exit_epoch_at_request_timestamp" integer, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_d7fec0f354ee1d96b5871ac14ca" UNIQUE ("request_id"), CONSTRAINT "PK_e28b3fb338394591f99c907dfa8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_d7fec0f354ee1d96b5871ac14c" ON "withdrawal_request_info" ("request_id") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_d7fec0f354ee1d96b5871ac14c"`);
    await queryRunner.query(`DROP TABLE "withdrawal_request_info"`);
    await queryRunner.query(`DROP TYPE "public"."waiting_time_calculation_type"`);
  }
}
