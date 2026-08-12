/**
 * 3단계-A · 분류코드 이름 받아오기 (KorService2 `categoryCode2`).
 *
 * 왜 이걸 먼저 받는가:
 *   태그 체계를 머리로 지어내려 했는데, 이미 `tour_place.cat1/cat2/cat3` 에
 *   관광공사 분류가 **100% 채워져 있다.** 3단계 144종은 SPEC 이 잡았던
 *   "세부 150" 과 거의 같은 규모다.
 *   → 우리가 만들 것은 새 분류가 아니라 **이 분류에 없는 것만 얹는 층**이다.
 *
 * 코드만 있고 이름이 없으면 아무 소용이 없어서 이름표부터 받는다.
 * 호출은 3단계 합쳐 200회 미만이라 개발계정 한도로 충분하다.
 *
 * 실행: npm run collect:category
 */
import { callTourApi } from "./lib/tourapi";
import { openDb, nowIso } from "./lib/db";

const SERVICE = "https://apis.data.go.kr/B551011/KorService2";

const db = openDb();
db.exec(`
  CREATE TABLE IF NOT EXISTS category_code (
    code       TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    level      INTEGER NOT NULL,   -- 1 | 2 | 3
    parent     TEXT,
    fetched_at TEXT NOT NULL
  );
`);

const ins = db.prepare(
  `INSERT INTO category_code (code, name, level, parent, fetched_at)
   VALUES (?,?,?,?,?)
   ON CONFLICT(code) DO UPDATE SET name = excluded.name`,
);

type Item = { code?: string; name?: string };

async function fetchLevel(params: Record<string, string | number>): Promise<Item[]> {
  const r = await callTourApi<Item>(SERVICE, "categoryCode2", {
    numOfRows: 200,
    pageNo: 1,
    ...params,
  });
  if (!r.ok) {
    console.log(`  실패 [${r.code}] ${r.message}`);
    return [];
  }
  return r.items;
}

async function main(): Promise<void> {
  const now = nowIso();
  let n1 = 0;
  let n2 = 0;
  let n3 = 0;

  console.log("\n3단계-A · 관광공사 분류코드 수집\n");

  for (const a of await fetchLevel({})) {
    if (!a.code || !a.name) continue;
    ins.run(a.code, a.name, 1, null, now);
    n1++;

    for (const b of await fetchLevel({ cat1: a.code })) {
      if (!b.code || !b.name) continue;
      ins.run(b.code, b.name, 2, a.code, now);
      n2++;

      for (const c of await fetchLevel({ cat1: a.code, cat2: b.code })) {
        if (!c.code || !c.name) continue;
        ins.run(c.code, c.name, 3, b.code, now);
        n3++;
      }
    }
  }

  console.log(`  대분류 ${n1} · 중분류 ${n2} · 소분류 ${n3}`);

  db.prepare(
    `INSERT INTO collect_run (phase, scope, ok_count, fail_count, note, started_at, ended_at)
     VALUES ('category', 'categoryCode2', ?, 0, ?, ?, ?)`,
  ).run(n1 + n2 + n3, `${n1}/${n2}/${n3}`, now, nowIso());

  // 실제로 쓰이는 분류만 추려서 보여준다 (전체 코드표에는 우리 데이터에 없는 것도 있다)
  console.log("\n  우리 데이터에서 쓰이는 소분류 상위 25:\n");
  for (const r of db
    .prepare(
      `select p.cat3 code, c.name, count(*) n
         from tour_place p left join category_code c on c.code = p.cat3
        where p.cat3 <> ''
        group by p.cat3 order by n desc limit 25`,
    )
    .all() as { code: string; name: string | null; n: number }[]) {
    console.log(`  ${String(r.n).padStart(5)}  ${r.code}  ${r.name ?? "(이름 없음)"}`);
  }
  console.log("");
}

main();
