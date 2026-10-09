import type { CodeNode } from "@codemap/core";
import { useEffect, useState } from "react";
import type { Locale } from "../../i18n/index.js";
import "./nodeIdentity.css";

const types = {
  zh: {
    function: "函数",
    method: "方法",
    class: "类",
    file: "文件",
    folder: "目录",
    external: "外部依赖",
    declaration: "声明",
  },
  en: {
    function: "Function",
    method: "Method",
    class: "Class",
    file: "File",
    folder: "Folder",
    external: "External dependency",
    declaration: "Declaration",
  },
};
const icons = {
  function: "\uf121",
  method: "\uf0e8",
  class: "\uf1b2",
  file: "\uf15b",
  folder: "\uf07b",
  external: "\uf08e",
  declaration: "\uf121",
};

export function nodeIdentity(node: CodeNode, locale: Locale = "zh") {
  const type =
    node.kind === "function"
      ? (node.declarationKind ??
        (/^\s*class\s+\S/.test(node.signature ?? "") ? "class" : "declaration"))
      : node.kind;
  const callableName =
    type === "method" ? (node.qualifiedName ?? node.name) : node.name;
  const label =
    type === "class"
      ? `class ${node.name}`
      : type === "function" || type === "method"
        ? `${callableName}${callableName.endsWith("()") ? "" : "()"}`
        : type === "folder"
          ? `${node.name}${node.name.endsWith("/") ? "" : "/"}`
          : node.name;
  return { label, typeLabel: types[locale][type], icon: icons[type] };
}

let fontReady: Promise<boolean> | undefined;
function loadLocalFont() {
  fontReady ??= document.fonts
    .load('16px "AtlasMode Nerd Icons"', "\uf121")
    .then(
      (fonts) => fonts.length > 0,
      () => false,
    );
  return fontReady;
}

export function NodeIdentity({
  node,
  locale = "zh",
  className = "",
}: {
  node: CodeNode;
  locale?: Locale;
  className?: string;
}) {
  const identity = nodeIdentity(node, locale);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    if (
      typeof document !== "undefined" &&
      typeof document.fonts?.load === "function"
    ) {
      void loadLocalFont().then((ready) => {
        if (active) setLoaded(ready);
      });
    }
    return () => {
      active = false;
    };
  }, []);
  return (
    <span className={`node-identity ${className}`.trim()}>
      <span
        className="node-identity-icon"
        data-font-loaded={loaded}
        aria-hidden="true"
      >
        {loaded ? identity.icon : "◇"}
      </span>
      <span className="node-identity-label">{identity.label}</span>
      <span className="node-identity-type">{identity.typeLabel}</span>
    </span>
  );
}
