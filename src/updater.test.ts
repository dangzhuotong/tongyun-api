import { describe, expect, it } from "vitest";
import pkgRaw from "../package.json?raw";
import tauriRaw from "../src-tauri/tauri.conf.json?raw";
import cargoRaw from "../src-tauri/Cargo.toml?raw";
import releaseYml from "../.github/workflows/release.yml?raw";
import buildYml from "../.github/workflows/build.yml?raw";
import { resolveDisplayedAppVersion, updateCheckNotice } from "./updater";

const UPDATER_PUBKEY =
  "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IEVDRTc5MkIxQTczRjczMzAKUldRd2N6K25zWkxuN0hyMmJzejFuYmM1TEJ4VExQaG5SYUFhTXpzRmllN3lrTmttRzZ0U2ZualMK";

describe("resolveDisplayedAppVersion", () => {
  it("prefers the installed Tauri version and strips a leading v", () => {
    expect(resolveDisplayedAppVersion("v0.3.0", "0.2.0")).toBe("0.3.0");
    expect(resolveDisplayedAppVersion("0.3.0", "0.2.0")).toBe("0.3.0");
  });

  it("falls back to the bundled package version when Tauri has not reported one", () => {
    expect(resolveDisplayedAppVersion(null, "0.2.0")).toBe("0.2.0");
    expect(resolveDisplayedAppVersion("  ", "0.2.0")).toBe("0.2.0");
  });
});

describe("updateCheckNotice", () => {
  it("tells the user they are current only on a manual check", () => {
    expect(updateCheckNotice(true, "latest")).toBe("已是最新版本");
    expect(updateCheckNotice(false, "latest")).toBeNull();
  });

  it("keeps startup failures quiet and surfaces manual failures", () => {
    expect(updateCheckNotice(false, "failed", "offline")).toBeNull();
    expect(updateCheckNotice(true, "failed", "offline")).toBe("检查更新失败：offline");
  });
});

describe("release versions stay aligned", () => {
  it("keeps package.json, tauri.conf.json, and Cargo.toml on 0.2.1 with the updater pubkey", () => {
    const pkg = JSON.parse(pkgRaw) as { version: string };
    const tauri = JSON.parse(tauriRaw) as {
      version: string;
      bundle: { createUpdaterArtifacts?: boolean };
      plugins: { updater: { pubkey: string; endpoints: string[] } };
    };
    const cargoVersion = cargoRaw.match(/^version = "([^"]+)"/m)?.[1];
    expect(pkg.version).toBe("0.2.1");
    expect(tauri.version).toBe(pkg.version);
    expect(cargoVersion).toBe(pkg.version);
    expect(tauri.bundle.createUpdaterArtifacts).toBe(true);
    expect(tauri.plugins.updater.endpoints).toEqual([
      "https://github.com/dangzhuotong/tongyun-api/releases/latest/download/latest.json",
    ]);
    expect(tauri.plugins.updater.pubkey).toBe(UPDATER_PUBKEY);
  });
});

describe("release workflow", () => {
  it("publishes on v* tags and signs updater artifacts in CI", () => {
    expect(releaseYml).toMatch(/tags:\s*\n\s*- ["']v\*["']/);
    expect(releaseYml).toContain(
      "TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}",
    );
    expect(releaseYml).toContain(
      "TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}",
    );
    expect(releaseYml).toContain("includeUpdaterJson:");
    expect(releaseYml).toContain("projectPath: .");
    expect(releaseYml).toContain("pnpm install --frozen-lockfile");
    expect(releaseYml).toContain("tauriScript: pnpm tauri");
    expect(releaseYml).toContain("rm -f src-tauri/.cargo/config.toml");
  });

  it("keeps push artifact builds unsigned and off the GitHub Release", () => {
    expect(buildYml).toMatch(/branches:\s*\n\s*- main\s*\n\s*- master/);
    expect(buildYml).not.toContain("includeUpdaterJson");
    expect(buildYml).not.toContain("secrets.TAURI_SIGNING_PRIVATE_KEY");
    expect(buildYml).toContain("contents: read");
    expect(buildYml).toContain("--no-sign");
  });
});
