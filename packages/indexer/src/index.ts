import { readFileSync, realpathSync, existsSync } from 'node:fs';
import path from 'node:path';
import { Project, Node, SyntaxKind, ts } from 'ts-morph';
import type {
  ArrowFunction,
  FunctionDeclaration,
  FunctionExpression,
  MethodDeclaration,
  ConstructorDeclaration,
} from 'ts-morph';
import { CodeSnapshotSchema } from '@codemap/core';
import type {
  CodeNode,
  CodeRelation,
  CodeSnapshot,
  IndexerPort,
} from '@codemap/core';
import { collect, digest } from './scan.js';

type Callable =
  | FunctionDeclaration
  | ArrowFunction
  | FunctionExpression
  | MethodDeclaration
  | ConstructorDeclaration;
function isCallable(node: Node): node is Callable {
  return (
    Node.isArrowFunction(node) ||
    Node.isFunctionExpression(node) ||
    (Node.isFunctionDeclaration(node) && node.getBody() !== undefined) ||
    (Node.isMethodDeclaration(node) && node.getBody() !== undefined) ||
    (Node.isConstructorDeclaration(node) && node.getBody() !== undefined)
  );
}
function range(node: Node) {
  const sf = node.getSourceFile();
  return {
    start: node.getStart(),
    end: node.getEnd(),
    startLine: sf.getLineAndColumnAtPos(node.getStart()).line,
    endLine: sf.getLineAndColumnAtPos(node.getEnd()).line,
  };
}
function structuralPath(node: Node, stop?: Node): string {
  const parts: string[] = [];
  let current: Node | undefined = node;
  while (current && current !== stop && !Node.isSourceFile(current)) {
    const parent: Node | undefined = current.getParent();
    const siblings =
      parent
        ?.getChildren()
        .flatMap((child) =>
          child.getKind() === SyntaxKind.SyntaxList
            ? child.getChildren()
            : [child],
        )
        .filter((child) => child.getKind() === current?.getKind()) ?? [];
    parts.push(
      current.getKindName() +
        ':' +
        Math.max(
          0,
          siblings.findIndex((child) => child === current),
        ),
    );
    current = parent;
  }
  return parts.reverse().join('/');
}
export class TypeScriptIndexer implements IndexerPort {
  constructor(private readonly root: string) {}
  async fingerprint(): Promise<string> {
    return (await collect(this.root)).baselineDigest;
  }
  async scan(): Promise<CodeSnapshot> {
    const input = await collect(this.root);
    const identity = (kind: string, key: string) =>
      kind + ':' + digest(input.repositoryId + '|' + key).slice(0, 24);
    const configPath = path.join(input.root, 'tsconfig.json');
    const safeRead = (filename: string): string | undefined => {
      try {
        const actual = realpathSync(filename);
        return actual.startsWith(input.root + path.sep)
          ? readFileSync(actual, 'utf8')
          : undefined;
      } catch {
        return undefined;
      }
    };
    const defaults: ts.CompilerOptions = {
      allowJs: true,
      checkJs: false,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      target: ts.ScriptTarget.ESNext,
      noEmit: true,
    };
    const config = existsSync(configPath)
      ? ts.readConfigFile(configPath, safeRead)
      : { config: { compilerOptions: {} } };
    const parsed = ts.parseJsonConfigFileContent(
      config.config ?? {},
      {
        useCaseSensitiveFileNames: true,
        readDirectory: () => [],
        fileExists: (filename) => safeRead(filename) !== undefined,
        readFile: safeRead,
      },
      input.root,
      defaults,
    );
    // Resolve declared package public entries to their included TypeScript source,
    // without reading dependencies or following imports outside the authorized root.
    const packageDirectories = new Set<string>();
    for (const relative of input.files.keys()) {
      let directory = path.posix.dirname(relative);
      while (directory !== '.') {
        packageDirectories.add(directory);
        directory = path.posix.dirname(directory);
      }
    }
    const publicEntries = new Map<string, string[]>();
    for (const directory of packageDirectories) {
      const raw = safeRead(path.join(input.root, directory, 'package.json'));
      if (!raw) continue;
      let manifest: {
        name?: string;
        exports?: unknown;
        types?: string;
        main?: string;
      };
      try {
        manifest = JSON.parse(raw);
      } catch {
        continue;
      }
      if (typeof manifest.name !== 'string') continue;
      let entry: unknown = manifest.exports;
      if (entry && typeof entry === 'object' && '.' in entry)
        entry = (entry as Record<string, unknown>)['.'];
      if (entry && typeof entry === 'object') {
        const conditions = entry as Record<string, unknown>;
        entry = conditions.types ?? conditions.import ?? conditions.default;
      }
      entry = entry ?? manifest.types ?? manifest.main;
      if (typeof entry !== 'string' || !entry.startsWith('./')) continue;
      let target = path.posix.normalize(path.posix.join(directory, entry));
      const configRaw = safeRead(
        path.join(input.root, directory, 'tsconfig.json'),
      );
      let local: { compilerOptions?: { rootDir?: string; outDir?: string } } =
        {};
      try {
        local = JSON.parse(configRaw ?? '{}');
      } catch {
        continue;
      }
      const output = path.posix.join(
        directory,
        local.compilerOptions?.outDir ?? 'dist',
      );
      if (target.startsWith(output + '/'))
        target = path.posix.join(
          directory,
          local.compilerOptions?.rootDir ?? 'src',
          target.slice(output.length + 1),
        );
      const stem = target.replace(/(?:\.d)?\.[cm]?[jt]sx?$/, '');
      const source = [
        target,
        stem + '.ts',
        stem + '.tsx',
        stem + '.js',
        stem + '.jsx',
      ].find((candidate) => input.files.has(candidate));
      if (source) {
        const entries = publicEntries.get(manifest.name) ?? [];
        entries.push(source);
        publicEntries.set(manifest.name, entries);
      }
    }
    parsed.options.paths = { ...parsed.options.paths };
    for (const [name, entries] of publicEntries)
      if (entries.length === 1 && !parsed.options.paths[name])
        parsed.options.paths[name] = [path.join(input.root, entries[0]!)];
    // In-memory source loading prevents import resolution from traversing outside the authorized root.
    const project = new Project({
      useInMemoryFileSystem: true,
      compilerOptions: {
        ...defaults,
        ...parsed.options,
        allowJs: true,
        noEmit: true,
      },
    });
    for (const [relative, content] of input.files)
      project.createSourceFile(path.join(input.root, relative), content, {
        overwrite: true,
      });
    project.resolveSourceFileDependencies();
    const nodes: CodeNode[] = [],
      relations: CodeRelation[] = [],
      diagnostics: string[] = [];
    const folders = new Map<string, string>(),
      fileIds = new Map<string, string>(),
      functions = new Map<Node, Extract<CodeNode, { kind: 'function' }>>();
    const ensureFolder = (relative: string): string => {
      if (folders.has(relative)) return folders.get(relative)!;
      const parent =
        relative === '.' ? null : ensureFolder(path.posix.dirname(relative));
      const id = identity('folder', relative);
      folders.set(relative, id);
      nodes.push({ id, kind: 'folder', path: relative, parentId: parent });
      return id;
    };
    for (const [relative] of input.files) {
      const id = identity('file', relative);
      fileIds.set(relative, id);
      nodes.push({
        id,
        kind: 'file',
        path: relative,
        parentId: ensureFolder(path.posix.dirname(relative)),
        contentHash: input.fileHashes[relative]!,
      });
    }
    const sourceFiles = project
      .getSourceFiles()
      .filter((sf) =>
        input.files.has(
          path.relative(input.root, sf.getFilePath()).split(path.sep).join('/'),
        ),
      );
    for (const sf of sourceFiles) {
      const relative = path
        .relative(input.root, sf.getFilePath())
        .split(path.sep)
        .join('/');
      const exports = [...sf.getExportedDeclarations().values()].flat();
      for (const node of sf.getDescendants().filter(isCallable)) {
        const owner = node
          .getAncestors()
          .find((ancestor) => functions.has(ancestor));
        const variable = node.getParentIfKind(SyntaxKind.VariableDeclaration);
        const property = node.getParentIfKind(SyntaxKind.PropertyAssignment);
        const classField = node.getParentIfKind(SyntaxKind.PropertyDeclaration);
        const named = 'getName' in node ? node.getName() : undefined;
        const assigned =
          variable?.getInitializer() === node
            ? variable.getName()
            : property?.getInitializer() === node
              ? property.getName()
              : classField?.getInitializer() === node
                ? classField.getName()
                : undefined;
        const classNode =
          node.getFirstAncestorByKind(SyntaxKind.ClassDeclaration) ??
          node.getFirstAncestorByKind(SyntaxKind.ClassExpression);
        const method =
          Node.isMethodDeclaration(node) || Node.isConstructorDeclaration(node);
        const name =
          assigned ??
          named ??
          (Node.isConstructorDeclaration(node)
            ? 'constructor'
            : `<callback:${structuralPath(node, owner)}>`);
        const prefix = owner
          ? functions.get(owner)!.qualifiedName
          : method || classField
            ? (classNode?.getName() ??
              classNode
                ?.getParentIfKind(SyntaxKind.VariableDeclaration)
                ?.getName() ??
              '<object>')
            : '';
        const qualifiedName = prefix ? prefix + '.' + name : name;
        const symbolKind = Node.isFunctionDeclaration(node)
          ? 'declaration'
          : Node.isMethodDeclaration(node)
            ? 'method'
            : Node.isConstructorDeclaration(node)
              ? 'constructor'
              : assigned
                ? Node.isArrowFunction(node)
                  ? 'arrow'
                  : 'expression'
                : named
                  ? 'expression'
                  : 'callback';
        const signature =
          '(' +
          node
            .getParameters()
            .map((parameter) => parameter.getText())
            .join(', ') +
          ') => ' +
          node.getReturnType().getText(node);
        const record: Extract<CodeNode, { kind: 'function' }> = {
          id: identity('fn', relative + '|' + qualifiedName + '|' + symbolKind),
          kind: 'function',
          name,
          qualifiedName,
          fileId: fileIds.get(relative)!,
          signature,
          range: range(node),
          exported: exports.some(
            (declaration) =>
              declaration === node ||
              declaration === variable ||
              declaration === classNode,
          ),
          symbolKind,
        };
        if (nodes.some((existing) => existing.id === record.id)) {
          record.id = identity(
            'fn',
            relative +
              '|' +
              qualifiedName +
              '|' +
              symbolKind +
              '|' +
              structuralPath(node),
          );
        }
        functions.set(node, record);
        nodes.push(record);
      }
    }
    let lock: Record<string, { version?: string }> = {};
    try {
      lock =
        JSON.parse(safeRead(path.join(input.root, 'package-lock.json')) ?? '{}')
          .packages ?? {};
    } catch {
      diagnostics.push(
        'package-lock.json could not be read for external versions',
      );
    }
    const externalNodes = new Map<string, string>();
    const external = (specifier: string): string => {
      const packageName = specifier.startsWith('node:')
        ? specifier
        : specifier.startsWith('@')
          ? specifier.split('/').slice(0, 2).join('/')
          : specifier.split('/')[0]!;
      if (externalNodes.has(packageName))
        return externalNodes.get(packageName)!;
      const id = identity('package', packageName);
      externalNodes.set(packageName, id);
      nodes.push({
        id,
        kind: 'external',
        packageName,
        version: lock['node_modules/' + packageName]?.version ?? null,
      });
      return id;
    };
    const add = (
      type: CodeRelation['type'],
      source: string,
      target: string | null,
      expression: string,
      evidence: CodeRelation['evidence'],
      key: string,
      reason: string | null = null,
    ) => {
      relations.push({
        id: identity('rel', type + '|' + source + '|' + key),
        source,
        target,
        type,
        sourceKind: 'code',
        resolution: target === null ? 'unresolved' : 'resolved',
        expression,
        reason,
        evidence,
      });
    };
    for (const node of nodes) {
      if (node.kind === 'file' || node.kind === 'folder') {
        if (node.parentId !== null)
          add(
            'contains',
            node.parentId,
            node.id,
            'physical containment',
            null,
            node.id,
          );
      } else if (node.kind === 'function')
        add(
          'contains',
          node.fileId,
          node.id,
          'function declaration',
          null,
          node.id,
        );
    }
    const findFunction = (
      declaration: Node,
      depth = 0,
    ): Extract<CodeNode, { kind: 'function' }> | undefined => {
      if (depth > 5) return undefined;
      if (functions.has(declaration)) return functions.get(declaration);
      if (
        Node.isClassDeclaration(declaration) ||
        Node.isClassExpression(declaration)
      )
        return declaration
          .getConstructors()
          .map((node) => functions.get(node))
          .find((node) => node !== undefined);
      if (
        Node.isVariableDeclaration(declaration) ||
        Node.isPropertyAssignment(declaration) ||
        Node.isPropertyDeclaration(declaration)
      ) {
        const initializer = declaration.getInitializer();
        if (initializer && functions.has(initializer))
          return functions.get(initializer);
        if (
          initializer &&
          (Node.isClassExpression(initializer) ||
            Node.isClassDeclaration(initializer))
        )
          return findFunction(initializer, depth + 1);
        if (
          initializer &&
          Node.isVariableDeclaration(declaration) &&
          declaration.getVariableStatement()?.getDeclarationKind() ===
            'const' &&
          (Node.isIdentifier(initializer) ||
            Node.isPropertyAccessExpression(initializer))
        ) {
          let symbol = initializer.getSymbol();
          if (symbol?.isAlias()) symbol = symbol.getAliasedSymbol();
          for (const node of symbol?.getDeclarations() ?? []) {
            const candidate = findFunction(node, depth + 1);
            if (candidate) return candidate;
          }
        }
      }
      return undefined;
    };
    for (const sf of sourceFiles) {
      const relative = path
          .relative(input.root, sf.getFilePath())
          .split(path.sep)
          .join('/'),
        fileId = fileIds.get(relative)!;
      const imported = new Map<string, string>();
      for (const declaration of [
        ...sf.getImportDeclarations(),
        ...sf.getExportDeclarations(),
      ]) {
        const specifier = declaration.getModuleSpecifierValue();
        if (!specifier) continue;
        const targetFile = declaration.getModuleSpecifierSourceFile();
        const targetRelative = targetFile
          ? path
              .relative(input.root, targetFile.getFilePath())
              .split(path.sep)
              .join('/')
          : '';
        const isLocal =
          specifier.startsWith('.') ||
          Object.keys(parsed.options.paths ?? {}).some((alias) =>
            specifier.startsWith(alias.split('*')[0]!),
          );
        const target =
          fileIds.get(targetRelative) ?? (isLocal ? null : external(specifier));
        add(
          'imports',
          fileId,
          target,
          specifier,
          { fileId, range: range(declaration) },
          structuralPath(declaration),
          target === null
            ? 'Local import could not be resolved within indexed scope'
            : null,
        );
        if (
          Node.isImportDeclaration(declaration) &&
          target !== null &&
          !isLocal
        ) {
          const defaultImport = declaration.getDefaultImport(),
            namespace = declaration.getNamespaceImport();
          if (defaultImport) imported.set(defaultImport.getText(), target);
          if (namespace) imported.set(namespace.getText(), target);
          for (const binding of declaration.getNamedImports())
            imported.set(
              binding.getAliasNode()?.getText() ?? binding.getName(),
              target,
            );
        }
      }
      for (const call of [
        ...sf.getDescendantsOfKind(SyntaxKind.CallExpression),
        ...sf.getDescendantsOfKind(SyntaxKind.NewExpression),
      ]) {
        const expression = call.getExpression();
        const owner = call
          .getAncestors()
          .find((ancestor) => functions.has(ancestor));
        const source = owner ? functions.get(owner)!.id : fileId;
        let target: string | null = null,
          reason: string | null = null;
        let symbol = expression.getSymbol();
        if (symbol?.isAlias()) symbol = symbol.getAliasedSymbol();
        const declarations = symbol?.getDeclarations() ?? [];
        const matches = declarations
          .map(findFunction)
          .filter(
            (item): item is Extract<CodeNode, { kind: 'function' }> =>
              item !== undefined,
          );
        if (matches.length === 1) target = matches[0]!.id;
        else {
          // A callable type can describe many runtime values. Only lexical
          // declarations or direct function literals provide target evidence.
          let literal: Node = expression;
          while (Node.isParenthesizedExpression(literal))
            literal = literal.getExpression();
          if (isCallable(literal)) target = functions.get(literal)?.id ?? null;
          if (target === null) {
            let base: Node = expression;
            let staticPath = true;
            while (
              Node.isPropertyAccessExpression(base) ||
              Node.isElementAccessExpression(base)
            ) {
              if (Node.isElementAccessExpression(base)) {
                const key = base.getArgumentExpression();
                if (
                  !key ||
                  (!Node.isStringLiteral(key) && !Node.isNumericLiteral(key))
                ) {
                  staticPath = false;
                  break;
                }
              }
              base = base.getExpression();
            }
            if (staticPath && Node.isIdentifier(base))
              target = imported.get(base.getText()) ?? null;
          }
          if (target === null)
            reason =
              matches.length > 1
                ? 'Ambiguous callable declarations'
                : 'Dynamic, framework, built-in, or unresolved call; no static target evidence';
        }
        add(
          'calls',
          source,
          target,
          expression.getText(),
          { fileId, range: range(call) },
          structuralPath(call, owner),
          reason,
        );
      }
      const syntaxDiagnostics = sf
        .getPreEmitDiagnostics()
        .filter((item) => item.getCategory() === ts.DiagnosticCategory.Error);
      if (syntaxDiagnostics.length)
        diagnostics.push(
          `${relative}: ${syntaxDiagnostics.length} compiler diagnostics; unresolved relationships retained`,
        );
    }
    return CodeSnapshotSchema.parse({
      id:
        'snapshot:' +
        digest(
          input.baselineDigest +
            '|' +
            JSON.stringify(nodes) +
            '|' +
            JSON.stringify(relations),
        ).slice(0, 24),
      repositoryId: input.repositoryId,
      createdAt: new Date().toISOString(),
      source: 'code',
      gitRevision: input.gitRevision,
      baselineDigest: input.baselineDigest,
      fileHashes: input.fileHashes,
      nodes,
      relations,
      scope: {
        included: [...input.files.keys()],
        configuration: input.configuration,
        excluded: input.excluded,
        limits: {
          maxFiles: input.maxFiles,
          maxBytes: input.maxBytes,
          maxEntries: 100000,
        },
        diagnostics,
      },
    });
  }
}
