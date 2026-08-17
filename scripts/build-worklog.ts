/**
 * 작업 로그 생성 — `npm run worklog`
 *
 * ── 왜 손으로 안 쓰는가 ──────────────────────────────────
 * 작업 기록을 사람이 따로 적으면 **두 벌이 되고 반드시 어긋난다.**
 * (검색어 표가 두 벌이라 영상 3,450편이 점수에 안 붙었던 것과 같은 문제다)
 *
 * 커밋 메시지에는 이미 "무엇을 왜 그렇게 했는지" 가 다 적혀 있다.
 * → 그걸 날짜별로 접어서 `docs/WORKLOG.md` 로 굽는다. **원본은 git 이고 이 파일은 사본이다.**
 *   그래서 언제든 다시 만들 수 있고, 누적이 저절로 된다.
 *
 * 사람이 덧붙일 말(그날의 판단·다음 할 일)은 커밋 메시지 본문에 적으면
 * 여기 같이 실린다. 이 파일을 직접 고치지 말 것 — 다음 실행에서 덮어쓴다.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const OUT = "./docs/WORKLOG.md";

/** 커밋 하나. 본문은 첫 문단만 쓴다 — 로그는 훑는 문서라 길면 안 읽힌다 */
type Commit = { hash: string; date: string; time: string; subject: string; body: string };

const SEP = "";
const REC = "";

function readCommits(): Commit[] {
  const raw = execFileSync(
    "git",
    ["log", "--no-merges", `--pretty=format:%h${SEP}%ad${SEP}%s${SEP}%b${REC}`, "--date=format:%Y-%m-%d %H:%M"],
    { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  );

  return raw
    .split(REC)
    .map((r) => r.trim())
    .filter(Boolean)
    .map((r) => {
      const [hash, when, subject, body = ""] = r.split(SEP);
      const [date, time] = when.split(" ");
      return {
        hash,
        date,
        time,
        subject: subject.trim(),
        // 본문은 첫 문단까지만. Co-Authored-By 같은 꼬리표는 뺀다
        body: body
          .split(/\n\s*\n/)[0]
          .split("\n")
          .filter((l) => !/^(Co-Authored-By|Signed-off-by):/i.test(l.trim()))
          .join(" ")
          .trim(),
      };
    });
}

function main(): void {
  const commits = readCommits();
  if (commits.length === 0) {
    console.log("  커밋이 없습니다.\n");
    return;
  }

  /** 날짜별로 접는다. git log 가 최신순이라 그대로 쓴다 */
  const byDate = new Map<string, Commit[]>();
  for (const c of commits) {
    if (!byDate.has(c.date)) byDate.set(c.date, []);
    byDate.get(c.date)!.push(c);
  }

  const now = new Date();
  const stamp =
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-` +
    `${String(now.getDate()).padStart(2, "0")} ` +
    `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const lines: string[] = [
    "# 작업 로그",
    "",
    `**마지막 갱신 ${stamp}** · 작업일 ${byDate.size}일 · 커밋 ${commits.length}건`,
    "",
    "> `npm run worklog` 으로 커밋 이력에서 다시 굽는다. **이 파일을 직접 고치지 말 것** —",
    "> 다음 실행에서 덮어쓴다. 남길 말은 커밋 메시지에 적으면 여기 실린다.",
    "",
    "---",
    "",
  ];

  for (const [date, list] of byDate) {
    // 그날 마지막 커밋 시각 = 그날 마지막으로 저장한 시각
    lines.push(`## ${date}  <sub>${list[list.length - 1].time}~${list[0].time} · ${list.length}건</sub>`, "");
    for (const c of list) {
      lines.push(`- **${c.subject}** <sub>${c.time} · \`${c.hash}\`</sub>`);
      if (c.body) lines.push(`  ${c.body}`);
    }
    lines.push("");
  }

  writeFileSync(OUT, lines.join("\n"), "utf8");
  console.log(`\n작업 로그  ${byDate.size}일 · 커밋 ${commits.length}건  →  ${OUT}`);
  console.log(`마지막 갱신 ${stamp}\n`);
}

main();
