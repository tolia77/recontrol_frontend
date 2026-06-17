import { describe, expect, it } from "vitest";

import {
  IRREVERSIBLE_IDS,
  IRREVERSIBLE_PATTERNS,
  isIrreversible,
} from "../irreversibleIntentCatalog";

describe("IRREVERSIBLE_IDS", () => {
  it("matches the canonical backend id list character-for-character", () => {
    expect(IRREVERSIBLE_IDS).toEqual([
      "rm_rf_root_adjacent",
      "dd_of_dev",
      "mkfs",
      "find_delete",
      "chmod_777_recursive",
    ]);
  });

  it("has length 5", () => {
    expect(IRREVERSIBLE_IDS.length).toBe(5);
  });
});

describe("IRREVERSIBLE_PATTERNS ordering parity", () => {
  it("PATTERNS length equals IDS length", () => {
    expect(IRREVERSIBLE_PATTERNS.length).toBe(IRREVERSIBLE_IDS.length);
  });

  it("each PATTERN.id matches IDS at the same index", () => {
    IRREVERSIBLE_PATTERNS.forEach((p, i) => {
      expect(p.id).toBe(IRREVERSIBLE_IDS[i]);
    });
  });
});

describe("isIrreversible — positive cases", () => {
  it("rm -rf / flags", () => {
    expect(isIrreversible({ binary: "rm", args: ["-rf", "/"] })).toBe(true);
  });

  it("rm -rf /etc flags", () => {
    expect(isIrreversible({ binary: "rm", args: ["-rf", "/etc"] })).toBe(true);
  });

  it("dd of=/dev/sda flags", () => {
    expect(isIrreversible({ binary: "dd", args: ["of=/dev/sda"] })).toBe(true);
  });

  it("mkfs.ext4 /dev/sdb1 flags", () => {
    expect(isIrreversible({ binary: "mkfs.ext4", args: ["/dev/sdb1"] })).toBe(
      true,
    );
  });

  it("find /tmp -delete flags", () => {
    expect(isIrreversible({ binary: "find", args: ["/tmp", "-delete"] })).toBe(
      true,
    );
  });

  it("chmod -R 777 /var/www flags", () => {
    expect(
      isIrreversible({ binary: "chmod", args: ["-R", "777", "/var/www"] }),
    ).toBe(true);
  });

  it("chmod 777 -R /etc flags — args are commutative", () => {
    expect(
      isIrreversible({ binary: "chmod", args: ["777", "-R", "/etc"] }),
    ).toBe(true);
  });

  it("rm -rf /home (literal top-level) flags", () => {
    expect(isIrreversible({ binary: "rm", args: ["-rf", "/home"] })).toBe(true);
  });
});

describe("isIrreversible — negative cases (newly-allowed)", () => {
  it("plain rm file.txt does not flag", () => {
    expect(isIrreversible({ binary: "rm", args: ["file.txt"] })).toBe(false);
  });

  it("rm -rf /home/user/cache (per-user subdir) does not flag", () => {
    expect(
      isIrreversible({ binary: "rm", args: ["-rf", "/home/user/cache"] }),
    ).toBe(false);
  });

  it("truncate -s 0 does not flag", () => {
    expect(isIrreversible({ binary: "truncate", args: ["-s", "0"] })).toBe(
      false,
    );
  });

  it("kill -9 1234 does not flag", () => {
    expect(isIrreversible({ binary: "kill", args: ["-9", "1234"] })).toBe(
      false,
    );
  });

  it("chown -R root:root /etc does not flag", () => {
    expect(
      isIrreversible({ binary: "chown", args: ["-R", "root:root", "/etc"] }),
    ).toBe(false);
  });

  it("systemctl stop nginx does not flag", () => {
    expect(
      isIrreversible({ binary: "systemctl", args: ["stop", "nginx"] }),
    ).toBe(false);
  });

  it("ls -la does not flag", () => {
    expect(isIrreversible({ binary: "ls", args: ["-la"] })).toBe(false);
  });

  it("chmod -R 644 /var/www does not flag (not 777)", () => {
    expect(
      isIrreversible({ binary: "chmod", args: ["-R", "644", "/var/www"] }),
    ).toBe(false);
  });
});

describe("isIrreversible — edges", () => {
  it("find with empty args does not flag (arg_match required)", () => {
    expect(isIrreversible({ binary: "find", args: [] })).toBe(false);
  });

  it("RM (uppercase) does not flag — case-sensitive", () => {
    expect(isIrreversible({ binary: "RM", args: ["-rf", "/"] })).toBe(false);
  });

  it("empty binary does not flag", () => {
    expect(isIrreversible({ binary: "", args: [] })).toBe(false);
  });

  it("chmod -R 777 in different order still flags — args are commutative", () => {
    expect(
      isIrreversible({ binary: "chmod", args: ["777", "-R", "/etc"] }),
    ).toBe(true);
  });

  it("chmod -R only (no 777) does not flag", () => {
    expect(isIrreversible({ binary: "chmod", args: ["-R", "644"] })).toBe(
      false,
    );
  });
});
