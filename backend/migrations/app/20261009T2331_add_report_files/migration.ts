#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/a7e115b650e2643c5d15cbe082334fe1dce8537ccf85629a6a430f2062a98eeb/contract';
import endContract from '../../snapshots/a7e115b650e2643c5d15cbe082334fe1dce8537ccf85629a6a430f2062a98eeb/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/d8ec304aa1dcdf7a97aced4512803cf3026d3fe3ae1cd29495c951aaa9e77f61/contract';
import startContract from '../../snapshots/d8ec304aa1dcdf7a97aced4512803cf3026d3fe3ae1cd29495c951aaa9e77f61/contract.json' with { type: 'json' };
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
        table: 'ReportFile',
        columns: [
          col('category', 'text', {
            notNull: true,
            default: lit('MEDICAL_REPORT'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('checksumSha256', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('deletedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('isDemo', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('mimeType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('originalFilename', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('patientId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('recordId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('sizeBytes', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('storageKey', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('title', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('uploadedById', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'ReportFile_category_check_b8a5d14f',
            "\"category\" IN ('MEDICAL_REPORT', 'LAB_RESULT', 'PRESCRIPTION', 'IMAGING', 'DISCHARGE_SUMMARY', 'OTHER')",
          ),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'ReportFile',
        constraint: 'ReportFile_storageKey_key',
        columns: ['storageKey'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ReportFile',
        index: 'ReportFile_patientId_idx_e5f07e88',
        columns: ['patientId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ReportFile',
        index: 'ReportFile_recordId_idx_6f7ec67b',
        columns: ['recordId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ReportFile',
        index: 'ReportFile_uploadedById_idx_b92fad21',
        columns: ['uploadedById'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ReportFile',
        foreignKey: {
          name: 'ReportFile_patientId_fkey',
          columns: ['patientId'],
          references: { schema: 'public', table: 'Patient', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ReportFile',
        foreignKey: {
          name: 'ReportFile_recordId_fkey',
          columns: ['recordId'],
          references: { schema: 'public', table: 'MedicalRecord', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ReportFile',
        foreignKey: {
          name: 'ReportFile_uploadedById_fkey',
          columns: ['uploadedById'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
