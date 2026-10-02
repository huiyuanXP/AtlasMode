import { Project, ts } from "ts-morph";
import type { SourceFile } from "./scan.js";
import type { Graph } from "./graph.js";

function decode(bytes: Buffer) {
  if (bytes[0] === 0xff && bytes[1] === 0xfe)
    return bytes.subarray(2).toString("utf16le");
  if (bytes[0] === 0xfe && bytes[1] === 0xff)
    return Buffer.from(bytes.subarray(2)).swap16().toString("utf16le");
  return bytes.toString("utf8").replace(/^\uFEFF/, "");
}

export function indexTypeScript(files: SourceFile[], graph: Graph) {
  if (!files.length) return;
  const project = new Project({
    useInMemoryFileSystem: true,
    skipAddingFilesFromTsConfig: true,
    compilerOptions: {
      allowJs: true,
      checkJs: true,
      jsx: ts.JsxEmit.Preserve,
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      noLib: true,
    },
  });
  for (const file of files)
    project.createSourceFile("/" + file.path, decode(file.bytes));
  const program = project.getProgram().compilerObject,
    checker = program.getTypeChecker();
  const filePaths = new Set(files.map((f) => "/" + f.path));
  const sources = program
    .getSourceFiles()
    .filter((s) => filePaths.has(s.fileName));
  const declarations = new Map<ts.Node, string>();
  const names = new Map<string, number>(),
    externalBindings = new Map<ts.Symbol, string>();
  const pathOf = (source: ts.SourceFile) => source.fileName.slice(1);
  const lineOf = (node: ts.Node) =>
    node.getSourceFile().getLineAndCharacterOfPosition(node.getStart()).line +
    1;
  function expressionIdentity(expression: ts.Expression): string {
    const tokens: [number, string][] = [];
    function visit(node: ts.Node) {
      if (node.kind <= ts.SyntaxKind.LastToken) {
        // Leaf tokens retain string/template/regex contents. AST children omit
        // whitespace and comments, unlike source text or whitespace stripping.
        tokens.push([node.kind, node.getText()]);
      } else for (const child of node.getChildren()) visit(child);
    }
    visit(expression);
    return JSON.stringify(tokens);
  }
  function declarationName(node: ts.Node): string | undefined {
    if (ts.isGetAccessorDeclaration(node)) return `get ${node.name.getText()}`;
    if (ts.isSetAccessorDeclaration(node)) return `set ${node.name.getText()}`;
    if (
      ts.isClassDeclaration(node) ||
      ts.isFunctionDeclaration(node) ||
      ts.isMethodDeclaration(node)
    )
      return node.name?.getText() ?? "<default>";
    if (ts.isConstructorDeclaration(node)) return "constructor";
    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
      if (
        ts.isVariableDeclaration(node.parent) ||
        ts.isPropertyAssignment(node.parent) ||
        ts.isPropertyDeclaration(node.parent)
      )
        return node.parent.name.getText();
      if (ts.isFunctionExpression(node) && node.name) return node.name.text;
      if (ts.isCallExpression(node.parent))
        return `<callback:${expressionIdentity(node.parent.expression)}:${node.parent.arguments.indexOf(node as ts.Expression)}>`;
      return "<anonymous>";
    }
    return undefined;
  }
  function isImplementation(node: ts.Node) {
    return (
      ts.isClassDeclaration(node) ||
      ts.isArrowFunction(node) ||
      ts.isFunctionExpression(node) ||
      ((ts.isFunctionDeclaration(node) ||
        ts.isMethodDeclaration(node) ||
        ts.isConstructorDeclaration(node) ||
        ts.isGetAccessorDeclaration(node) ||
        ts.isSetAccessorDeclaration(node)) &&
        !!node.body)
    );
  }
  function exported(node: ts.Node) {
    let candidate = node;
    if (
      (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) &&
      ts.isVariableDeclaration(node.parent)
    )
      candidate = node.parent.parent.parent;
    return (
      ts.canHaveModifiers(candidate) &&
      !!ts
        .getModifiers(candidate)
        ?.some(
          (m) =>
            m.kind === ts.SyntaxKind.ExportKeyword ||
            m.kind === ts.SyntaxKind.DefaultKeyword,
        )
    );
  }
  for (const source of sources) {
    const path = pathOf(source),
      file = graph.file(path);
    function collect(node: ts.Node, ownerId: string, ownerName: string) {
      const name = declarationName(node);
      if (name && isImplementation(node)) {
        const base = ownerName ? `${ownerName}.${name}` : name,
          key = `${path}:${base}:${ts.SyntaxKind[node.kind]}`;
        const count = (names.get(key) ?? 0) + 1;
        names.set(key, count);
        const q = count === 1 ? base : `${base}#${count}`;
        const n = graph.node(
          "function",
          path,
          q,
          {
            name,
            parentId: ownerId,
            language: file.language,
            startLine: lineOf(node),
            endLine: source.getLineAndCharacterOfPosition(node.end).line + 1,
            exported: exported(node),
            signature: ts.isClassDeclaration(node)
              ? `class ${name}`
              : node.getText().split("{")[0]!.trim().slice(0, 500),
          },
          ts.SyntaxKind[node.kind],
        );
        declarations.set(node, n.id);
        graph.edge("contains", ownerId, n.id, "resolved", path, lineOf(node));
        ts.forEachChild(node, (c) => collect(c, n.id, q));
      } else ts.forEachChild(node, (c) => collect(c, ownerId, ownerName));
    }
    collect(source, file.id, "");
    for (const d of program.getSyntacticDiagnostics(source))
      graph.diagnostics.push({
        filePath: path,
        ...(d.start === undefined
          ? {}
          : { line: source.getLineAndCharacterOfPosition(d.start).line + 1 }),
        message: ts.flattenDiagnosticMessageText(d.messageText, "\n"),
      });
  }
  // Module imports and re-exports must use the checker-selected source file.
  for (const source of sources) {
    const path = pathOf(source);
    for (const statement of source.statements) {
      if (
        !(
          ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)
        ) ||
        !statement.moduleSpecifier ||
        !ts.isStringLiteral(statement.moduleSpecifier)
      )
        continue;
      const spec = statement.moduleSpecifier.text,
        symbol = checker.getSymbolAtLocation(statement.moduleSpecifier);
      const targetSource = symbol?.declarations?.find(ts.isSourceFile);
      const local =
        targetSource && sources.includes(targetSource)
          ? graph.file(pathOf(targetSource)).id
          : null;
      const external = !local && !spec.startsWith(".") && !spec.startsWith("/");
      const targetId = local ?? (external ? graph.external(spec).id : null);
      graph.edge(
        "imports",
        graph.file(path).id,
        targetId,
        local ? "resolved" : external ? "external" : "unresolved",
        path,
        lineOf(statement),
        statement.getText(),
        targetId
          ? undefined
          : `Module ${spec} was not included or could not be resolved`,
      );
      if (
        external &&
        ts.isImportDeclaration(statement) &&
        statement.importClause
      ) {
        const clause = statement.importClause;
        const identifiers: ts.Identifier[] = [];
        if (clause.name) identifiers.push(clause.name);
        if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings))
          identifiers.push(clause.namedBindings.name);
        if (clause.namedBindings && ts.isNamedImports(clause.namedBindings))
          identifiers.push(...clause.namedBindings.elements.map((e) => e.name));
        for (const ident of identifiers) {
          const sym = checker.getSymbolAtLocation(ident);
          if (sym)
            externalBindings.set(
              sym,
              `${spec}:${ident.parent && ts.isImportSpecifier(ident.parent) ? (ident.parent.propertyName ?? ident).text : ident.text}`,
            );
        }
      }
    }
  }
  function targetFromSymbol(symbol: ts.Symbol | undefined): string | undefined {
    if (!symbol) return undefined;
    if (symbol.flags & ts.SymbolFlags.Alias)
      symbol = checker.getAliasedSymbol(symbol);
    for (const declaration of symbol.declarations ?? []) {
      if (
        ts.isGetAccessorDeclaration(declaration) ||
        ts.isSetAccessorDeclaration(declaration)
      )
        continue;
      const direct = declarations.get(declaration);
      if (direct) return direct;
      if (
        ts.isVariableDeclaration(declaration) ||
        ts.isPropertyAssignment(declaration) ||
        ts.isPropertyDeclaration(declaration)
      ) {
        const initializer = declaration.initializer;
        if (initializer) {
          const id = declarations.get(initializer);
          if (id) return id;
        }
      }
    }
    return undefined;
  }
  for (const source of sources) {
    const path = pathOf(source);
    function visit(node: ts.Node, ownerId: string) {
      const mapped = declarations.get(node);
      if (mapped) ownerId = mapped;
      if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
        const expression = node.expression;
        // Only declaration symbols identify implementations. A callable type's
        // signature alone cannot prove a parameter's runtime target.
        const symbol = checker.getSymbolAtLocation(
          ts.isPropertyAccessExpression(expression)
            ? expression.name
            : expression,
        );
        const target = targetFromSymbol(symbol);
        let root: ts.Expression = expression;
        while (
          ts.isPropertyAccessExpression(root) ||
          ts.isElementAccessExpression(root)
        )
          root = root.expression;
        const rootSymbol = checker.getSymbolAtLocation(root),
          externalName = rootSymbol && externalBindings.get(rootSymbol);
        const external = !target && externalName;
        graph.edge(
          "calls",
          ownerId,
          target ??
            (external
              ? graph.external(`${externalName}:${expression.getText()}`).id
              : null),
          target ? "resolved" : external ? "external" : "unresolved",
          path,
          lineOf(node),
          node.getText(),
          target || external
            ? undefined
            : "No unique indexed implementation for this call (dynamic, ambient, or excluded target)",
        );
      }
      ts.forEachChild(node, (child) => visit(child, ownerId));
    }
    visit(source, graph.file(path).id);
  }
}
