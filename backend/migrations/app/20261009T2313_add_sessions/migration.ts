#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/33be4fa4f8f05e08578d5fa5dadcd5199e4db4938fc4adbdcddcf3916927abd1/contract';
import startContract from '../../snapshots/33be4fa4f8f05e08578d5fa5dadcd5199e4db4938fc4adbdcddcf3916927abd1/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/d8ec304aa1dcdf7a97aced4512803cf3026d3fe3ae1cd29495c951aaa9e77f61/contract';
import endContract from '../../snapshots/d8ec304aa1dcdf7a97aced4512803cf3026d3fe3ae1cd29495c951aaa9e77f61/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'Session',
        columns: [
          col('absoluteExpiresAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('idleExpiresAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('ip', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('lastSeenAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('revokedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('role', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('rotatedFrom', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('tokenHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userAgent', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'Session_role_check_7ce26ebb',
            "\"role\" IN ('PATIENT', 'DOCTOR', 'FACILITY_STAFF', 'AMBULANCE_OPERATOR', 'BLOOD_DONOR', 'ORGAN_DONOR', 'ADMIN')",
          ),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Session',
        constraint: 'Session_tokenHash_key',
        columns: ['tokenHash'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Session',
        index: 'Session_absoluteExpiresAt_idx_1b08abe9',
        columns: ['absoluteExpiresAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Session',
        index: 'Session_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Session',
        foreignKey: {
          name: 'Session_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
