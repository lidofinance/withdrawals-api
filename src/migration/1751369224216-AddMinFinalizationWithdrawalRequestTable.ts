import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMinFinalizationWithdrawalRequestTable1751369224216 implements MigrationInterface {
    name = 'AddMinFinalizationWithdrawalRequestTable1751369224216'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "withdrawal_request_info" DROP COLUMN "max_exit_epoch_at_request_timestamp"`);
        await queryRunner.query(`ALTER TABLE "withdrawal_request_info" ADD "min_calculated_finalization_timestamp" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "withdrawal_request_info" ADD "min_calculated_finalization_type" "public"."waiting_time_calculation_type"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "withdrawal_request_info" DROP COLUMN "min_calculated_finalization_type"`);
        await queryRunner.query(`ALTER TABLE "withdrawal_request_info" DROP COLUMN "min_calculated_finalization_timestamp"`);
        await queryRunner.query(`ALTER TABLE "withdrawal_request_info" ADD "max_exit_epoch_at_request_timestamp" integer`);
    }

}
