import { it, expect } from "vitest";
import crypto from "node:crypto";
import { database, ownerId } from "./db-harness";
it("manual retry cannot reuse a paid reservation, including after dead-letter", async () => {
  const db = await database();
  try {
    const captured = await db.query<{ id: string }>(
      "select capture_manual($1,$2,'','/script','test source',null) id",
      [ownerId, crypto.randomUUID()],
    );
    const capture = captured.rows[0].id;
    const first = (
      await db.query<{ id: string; attempt: number }>(
        "select * from claim_jobs('retry-test',1,180)",
      )
    ).rows[0];
    expect(first.attempt).toBe(1);
    expect(
      (
        await db.query<{ ok: boolean }>(
          "select reserve_budget($1,'retry-test',0.5,0.5,1) ok",
          [first.id],
        )
      ).rows[0].ok,
    ).toBe(true);
    await db.query(
      "update jobs set status='dead_letter',max_attempts=1,lease_owner=null,lease_expires_at=null where id=$1",
      [first.id],
    );
    await db.query("select retry_capture($1,$2)", [ownerId, capture]);
    const retried = (
      await db.query<{ id: string; attempt: number }>(
        "select * from claim_jobs('retry-test',1,180)",
      )
    ).rows[0];
    expect(retried.id).toBe(first.id);
    expect(retried.attempt).toBe(2);
    expect(
      (
        await db.query<{ ok: boolean }>(
          "select reserve_budget($1,'retry-test',0.5,0.5,1) ok",
          [first.id],
        )
      ).rows[0].ok,
    ).toBe(false);
    // After a legitimate day reset, the new attempt receives its own reservation.
    await db.query(
      "update budget_reservations set created_at=now()-interval '2 days' where job_id=$1",
      [first.id],
    );
    expect(
      (
        await db.query<{ ok: boolean }>(
          "select reserve_budget($1,'retry-test',0.5,0.5,1) ok",
          [first.id],
        )
      ).rows[0].ok,
    ).toBe(true);
    expect(
      (
        await db.query<{ n: number }>(
          "select count(*)::int n from budget_reservations where job_id=$1",
          [first.id],
        )
      ).rows[0].n,
    ).toBe(2);
  } finally {
    await db.close();
  }
});
