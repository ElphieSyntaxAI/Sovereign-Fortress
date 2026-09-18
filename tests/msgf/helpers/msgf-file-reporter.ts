import type {
  FullConfig,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from "@playwright/test/reporter";
import fs from "node:fs";
import path from "node:path";

const LOG_PATH = path.resolve(process.cwd(), "tests", "reports", "msgf-stress.log");

function append(line: string) {
  fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
  fs.appendFileSync(LOG_PATH, line.endsWith("\n") ? line : `${line}\n`, "utf8");
}

export default class MsgfFileReporter implements Reporter {
  onBegin(config: FullConfig, suite: Suite) {
    fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
    const stamp = new Date().toISOString();
    append("");
    append(`===== PLAYWRIGHT RUN ${stamp} =====`);
    append(`baseURL=${config.projects.map((p) => p.use?.baseURL).filter(Boolean).join(",") || "(unset)"}`);
    append(`tests=${suite.allTests().length}`);
  }

  onTestBegin(test: TestCase) {
    append(`[test:start] ${test.titlePath().join(" > ")}`);
  }

  onStdOut(chunk: string | Buffer, _test?: TestCase) {
    append(String(chunk).replace(/\r\n/g, "\n").trimEnd());
  }

  onStdErr(chunk: string | Buffer, _test?: TestCase) {
    append(`[stderr] ${String(chunk).replace(/\r\n/g, "\n").trimEnd()}`);
  }

  onTestEnd(test: TestCase, result: TestResult) {
    append(
      `[test:end] ${test.titlePath().join(" > ")} status=${result.status} durationMs=${result.duration}`
    );
    for (const err of result.errors) {
      if (err.message) append(`[test:error] ${err.message.split("\n")[0]}`);
    }
  }

  onEnd() {
    append(`===== PLAYWRIGHT RUN END ${new Date().toISOString()} =====`);
  }
}
