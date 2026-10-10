#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/204acd322d039179b42b362eb9c90399ffdc5f44a622a2083cea088afdc2c6c0/contract';
import startContract from '../../snapshots/204acd322d039179b42b362eb9c90399ffdc5f44a622a2083cea088afdc2c6c0/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/928229059311ebb323f8788329cd63559c8e31cb8f9cbf3c3a23bd037390f7a6/contract';
import endContract from '../../snapshots/928229059311ebb323f8788329cd63559c8e31cb8f9cbf3c3a23bd037390f7a6/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'Admission',
        columns: [
          col('admittedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('dischargedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('facilityId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('notes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('patientId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('staffId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('ADMITTED'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('ward', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'Admission_status_check_bfff8205',
            "\"status\" IN ('ADMITTED', 'DISCHARGED', 'TRANSFERRED')",
          ),
          checkExpression(
            'Admission_ward_check_11a48c15',
            "\"ward\" IN ('GENERAL', 'ICU', 'PEDIATRIC', 'MATERNITY', 'EMERGENCY', 'SURGICAL', 'ISOLATION', 'OTHER')",
          ),
        ],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Admission',
        index: 'Admission_facilityId_idx_3710d8c1',
        columns: ['facilityId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Admission',
        index: 'Admission_facilityId_ward_status_idx_158c8f59',
        columns: ['facilityId', 'ward', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Admission',
        index: 'Admission_patientId_idx_e5f07e88',
        columns: ['patientId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Admission',
        index: 'Admission_patientId_status_idx_f2f98c70',
        columns: ['patientId', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Admission',
        index: 'Admission_staffId_idx_ce92c64e',
        columns: ['staffId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Admission',
        index: 'admission_active_ward_af4e0b07',
        columns: ['facilityId', 'patientId', 'ward', 'status'],
        extras: { where: "status = 'ADMITTED'", unique: true },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Admission',
        foreignKey: {
          name: 'Admission_patientId_fkey',
          columns: ['patientId'],
          references: { schema: 'public', table: 'Patient', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Admission',
        foreignKey: {
          name: 'Admission_facilityId_fkey',
          columns: ['facilityId'],
          references: { schema: 'public', table: 'HealthcareFacility', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Admission',
        foreignKey: {
          name: 'Admission_staffId_fkey',
          columns: ['staffId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
