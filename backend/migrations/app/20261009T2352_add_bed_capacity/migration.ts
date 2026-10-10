#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/34644c1394de0be468b59c8c95f608f9dc969e7bdf8d72b5f76d16514bad11f3/contract';
import endContract from '../../snapshots/34644c1394de0be468b59c8c95f608f9dc969e7bdf8d72b5f76d16514bad11f3/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/a7e115b650e2643c5d15cbe082334fe1dce8537ccf85629a6a430f2062a98eeb/contract';
import startContract from '../../snapshots/a7e115b650e2643c5d15cbe082334fe1dce8537ccf85629a6a430f2062a98eeb/contract.json' with { type: 'json' };
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
        table: 'BedCapacity',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('facilityId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('label', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('occupiedBeds', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('totalBeds', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('updatedById', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('ward', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'BedCapacity_ward_check_11a48c15',
            "\"ward\" IN ('GENERAL', 'ICU', 'PEDIATRIC', 'MATERNITY', 'EMERGENCY', 'SURGICAL', 'ISOLATION', 'OTHER')",
          ),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'BedCapacity',
        constraint: 'BedCapacity_facilityId_ward_key',
        columns: ['facilityId', 'ward'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'BedCapacity',
        index: 'BedCapacity_facilityId_idx_3710d8c1',
        columns: ['facilityId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'BedCapacity',
        index: 'BedCapacity_updatedById_idx_d0517c24',
        columns: ['updatedById'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'BedCapacity',
        foreignKey: {
          name: 'BedCapacity_facilityId_fkey',
          columns: ['facilityId'],
          references: { schema: 'public', table: 'HealthcareFacility', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'BedCapacity',
        foreignKey: {
          name: 'BedCapacity_updatedById_fkey',
          columns: ['updatedById'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
