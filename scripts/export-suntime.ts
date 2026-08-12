import { writeFileSync, mkdirSync } from "node:fs";
import { openDb } from "./lib/db";
const db = openDb();
const rows = db
  .prepare(
    `select location, locdate, sunrise, sunset, civilm, civile, lat, lng
       from sun_time where sunrise is not null order by location, locdate`,
  )
  .all();
mkdirSync("./src/data/real", { recursive: true });
writeFileSync("./src/data/real/suntime.json", JSON.stringify(rows) + "\n", "utf8");
console.log("suntime.json", rows.length, "건");
