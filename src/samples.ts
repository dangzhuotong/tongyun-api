import basics from "../examples/httpbin/basics.http?raw";
import methods from "../examples/httpbin/methods.http?raw";
import env from "../examples/http-client.env.json?raw";
import { assembleWorkspace, type WorkspaceModel } from "./model/workspace";

export function builtinWorkspace(): WorkspaceModel {
  return assembleWorkspace(
    [
      { relativePath: "httpbin/basics.http", content: basics },
      { relativePath: "httpbin/methods.http", content: methods },
    ],
    [{ relativePath: "http-client.env.json", kind: "public", content: env }],
  );
}
