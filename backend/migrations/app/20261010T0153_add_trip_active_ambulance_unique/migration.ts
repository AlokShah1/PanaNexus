#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/204acd322d039179b42b362eb9c90399ffdc5f44a622a2083cea088afdc2c6c0/contract';
import endContract from '../../snapshots/204acd322d039179b42b362eb9c90399ffdc5f44a622a2083cea088afdc2c6c0/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/9c4fc514036ceec57c993de9c99ef16a0c1ce03890eb84dff9e2eead3ab96a0e/contract';
import startContract from '../../snapshots/9c4fc514036ceec57c993de9c99ef16a0c1ce03890eb84dff9e2eead3ab96a0e/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createIndex({
        schema: 'public',
        table: 'Trip',
        index: 'trip_active_ambulance_d4c02969',
        columns: ['ambulanceId'],
        extras: { where: "status IN ('EN_ROUTE', 'ARRIVED', 'TRANSPORTING')", unique: true },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
