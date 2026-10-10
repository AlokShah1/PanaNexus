#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/9c4fc514036ceec57c993de9c99ef16a0c1ce03890eb84dff9e2eead3ab96a0e/contract';
import endContract from '../../snapshots/9c4fc514036ceec57c993de9c99ef16a0c1ce03890eb84dff9e2eead3ab96a0e/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/df732f015029f7610fe8ce3c119b65e4362006a4a186bd1a5e7f6022eb655cb1/contract';
import startContract from '../../snapshots/df732f015029f7610fe8ce3c119b65e4362006a4a186bd1a5e7f6022eb655cb1/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createIndex({
        schema: 'public',
        table: 'Appointment',
        index: 'appt_active_slot_d39b8f21',
        columns: ['doctorId', 'startsAt'],
        extras: { where: "status IN ('REQUESTED', 'CONFIRMED')", unique: true },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
