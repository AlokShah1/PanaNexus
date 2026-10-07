#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/33be4fa4f8f05e08578d5fa5dadcd5199e4db4938fc4adbdcddcf3916927abd1/contract';
import endContract from '../../snapshots/33be4fa4f8f05e08578d5fa5dadcd5199e4db4938fc4adbdcddcf3916927abd1/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/8fd0bad7ee315247283e69995f4225b0f50fd69d29ceadb0ecc4b05110a82828/contract';
import startContract from '../../snapshots/8fd0bad7ee315247283e69995f4225b0f50fd69d29ceadb0ecc4b05110a82828/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'EmergencyRequest',
        column: col('pickupAccuracy', 'float8', { codecRef: { codecId: 'pg/float8@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'EmergencyRequest',
        column: col('pickupObtainedAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-string@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'LocationUpdate',
        column: col('accuracy', 'float8', { codecRef: { codecId: 'pg/float8@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Trip',
        column: col('isSimulation', 'bool', {
          notNull: true,
          default: lit(false),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
