import { describe, expect, it } from "vitest";
import { flattenVariables, mergeEnvironmentLayers, EnvLayer } from "./env";

describe("flattenVariables", () => {
  it("converts primitives to string representation", () => {
    const input = {
      str: "hello",
      num: 42,
      boolTrue: true,
      boolFalse: false,
      zero: 0,
    };
    const result = flattenVariables(input);
    expect(result).toEqual({
      str: "hello",
      num: "42",
      boolTrue: "true",
      boolFalse: "false",
      zero: "0",
    });
  });

  it("serializes arrays as JSON strings", () => {
    const input = {
      tags: ["api", "testing"],
      numbers: [1, 2, 3],
    };
    const result = flattenVariables(input);
    expect(result).toEqual({
      tags: '["api","testing"]',
      numbers: "[1,2,3]",
    });
  });

  it("flattens nested objects with dot notation", () => {
    const input = {
      auth: {
        token: "bearer-token",
        config: {
          timeout: 5000,
        },
      },
      server: {
        host: "https://httpbin.org",
      },
    };
    const result = flattenVariables(input);
    expect(result).toEqual({
      "auth.token": "bearer-token",
      "auth.config.timeout": "5000",
      "server.host": "https://httpbin.org",
    });
  });

  it("flattens empty objects to an empty string", () => {
    const input = {
      emptyObj: {},
      nested: {
        emptyInner: {},
      },
    };
    const result = flattenVariables(input);
    expect(result).toEqual({
      emptyObj: "",
      "nested.emptyInner": "",
    });
  });

  it("ignores null and undefined values", () => {
    const input = {
      valid: "exists",
      nullVal: null,
      undefinedVal: undefined,
      nested: {
        nullInside: null,
        keep: "kept",
      },
    };
    const result = flattenVariables(input);
    expect(result).toEqual({
      valid: "exists",
      "nested.keep": "kept",
    });
  });
});

describe("mergeEnvironmentLayers", () => {
  it("merges a single public environment layer", () => {
    const layers: EnvLayer[] = [
      {
        path: "http-client.env.json",
        kind: "public",
        content: JSON.stringify({
          dev: {
            host: "https://dev.example.com",
            port: 8080,
          },
          staging: {
            host: "https://staging.example.com",
          },
        }),
      },
    ];

    const result = mergeEnvironmentLayers(layers);
    expect(result.names).toEqual(["dev", "staging"]);
    expect(result.variables.dev).toEqual({
      host: "https://dev.example.com",
      port: "8080",
    });
    expect(result.variables.staging).toEqual({
      host: "https://staging.example.com",
    });
    expect(result.privateKeys.dev).toEqual([]);
    expect(result.sources).toEqual([
      { path: "http-client.env.json", kind: "public" },
    ]);
    expect(result.problems).toEqual([]);
  });

  it("lets private layers override public variables and records privateKeys", () => {
    const layers: EnvLayer[] = [
      {
        path: "http-client.env.json",
        kind: "public",
        content: JSON.stringify({
          prod: {
            host: "https://api.example.com",
            token: "public-placeholder",
          },
        }),
      },
      {
        path: "http-client.private.env.json",
        kind: "private",
        content: JSON.stringify({
          prod: {
            token: "super-secret-key",
          },
        }),
      },
    ];

    const result = mergeEnvironmentLayers(layers);
    expect(result.variables.prod.token).toBe("super-secret-key");
    expect(result.variables.prod.host).toBe("https://api.example.com");
    expect(result.privateKeys.prod).toEqual(["token"]);
  });

  it("removes keys from privateKeys when an inner public layer overrides them", () => {
    const layers: EnvLayer[] = [
      {
        path: "root/http-client.private.env.json",
        kind: "private",
        content: JSON.stringify({
          dev: {
            apiKey: "secret-key",
          },
        }),
      },
      {
        path: "root/sub/http-client.env.json",
        kind: "public",
        content: JSON.stringify({
          dev: {
            apiKey: "public-override",
          },
        }),
      },
    ];

    const result = mergeEnvironmentLayers(layers);
    expect(result.variables.dev.apiKey).toBe("public-override");
    expect(result.privateKeys.dev).toEqual([]);
  });

  it("records problems when JSON syntax is invalid", () => {
    const layers: EnvLayer[] = [
      {
        path: "broken.env.json",
        kind: "public",
        content: "{ broken json",
      },
    ];

    const result = mergeEnvironmentLayers(layers);
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0]).toBe("broken.env.json 不是合法 JSON");
    expect(result.names).toEqual([]);
  });

  it("records problems when top-level is not an object or is an array", () => {
    const layers: EnvLayer[] = [
      {
        path: "array.env.json",
        kind: "public",
        content: JSON.stringify(["env1", "env2"]),
      },
      {
        path: "null.env.json",
        kind: "public",
        content: "null",
      },
    ];

    const result = mergeEnvironmentLayers(layers);
    expect(result.problems).toEqual([
      "array.env.json 的顶层必须是环境对象",
      "null.env.json 的顶层必须是环境对象",
    ]);
  });

  it("records problems when an environment value is not an object", () => {
    const layers: EnvLayer[] = [
      {
        path: "bad-env.json",
        kind: "public",
        content: JSON.stringify({
          valid: { host: "localhost" },
          invalidEnv: "string-value",
          arrayEnv: [1, 2],
        }),
      },
    ];

    const result = mergeEnvironmentLayers(layers);
    expect(result.problems).toContain("bad-env.json 的环境「invalidEnv」必须是对象");
    expect(result.problems).toContain("bad-env.json 的环境「arrayEnv」必须是对象");
    expect(result.names).toEqual(["valid"]);
    expect(result.variables.valid).toEqual({ host: "localhost" });
  });

  it("returns empty set when no layers provided", () => {
    const result = mergeEnvironmentLayers([]);
    expect(result).toEqual({
      names: [],
      variables: {},
      privateKeys: {},
      sources: [],
      problems: [],
    });
  });
});
