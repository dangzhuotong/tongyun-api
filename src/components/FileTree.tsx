import { ChevronDown, ChevronRight, FileCode2 } from "lucide-react";
import { useState } from "react";
import { buildTree, type HttpFileModel, type TreeDir } from "../model/workspace";

interface FileTreeProps {
  files: HttpFileModel[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function FileTree({ files, selectedId, onSelect }: FileTreeProps) {
  const tree = buildTree(files);
  const count = files.reduce((sum, file) => sum + file.requests.length, 0);

  return (
    <aside className="tree">
      <div className="pane-label">
        <span>请求</span>
        <span>{count}</span>
      </div>
      {files.length === 0 ? (
        <p className="empty-copy">这个文件夹里还没有 .http 文件。</p>
      ) : (
        <div className="tree-scroll">
          <TreeBranch dir={tree} selectedId={selectedId} onSelect={onSelect} />
        </div>
      )}
    </aside>
  );
}

function TreeBranch({
  dir,
  selectedId,
  onSelect,
}: {
  dir: TreeDir;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <>
      {dir.dirs.map((child) => (
        <FolderNode key={child.path} dir={child} selectedId={selectedId} onSelect={onSelect} />
      ))}
      {dir.files.map((file) => (
        <FileNode key={file.path} file={file} selectedId={selectedId} onSelect={onSelect} />
      ))}
    </>
  );
}

function FolderNode({
  dir,
  selectedId,
  onSelect,
}: {
  dir: TreeDir;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="folder">
      <button type="button" className="folder-button" onClick={() => setOpen((value) => !value)}>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span>{dir.name}</span>
      </button>
      {open ? (
        <div className="folder-children">
          <TreeBranch dir={dir} selectedId={selectedId} onSelect={onSelect} />
        </div>
      ) : null}
    </div>
  );
}

function FileNode({
  file,
  selectedId,
  onSelect,
}: {
  file: HttpFileModel;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const name = file.path.split("/").pop() ?? file.path;
  return (
    <div className="file-node">
      <div className="file-name">
        <FileCode2 size={14} />
        <span>{name}</span>
        {file.warnings.length > 0 ? <i className="warn-dot" title={file.warnings[0].message} /> : null}
      </div>
      {file.requests.map((request) => (
        <button
          key={request.id}
          type="button"
          className={request.id === selectedId ? "request-row selected" : "request-row"}
          onClick={() => onSelect(request.id)}
        >
          <span className="method" data-method={request.method}>
            {request.method}
          </span>
          <span className="request-name">{request.name}</span>
        </button>
      ))}
    </div>
  );
}
