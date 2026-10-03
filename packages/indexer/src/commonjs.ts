import { ts } from "ts-morph";

export type CommonJsMode = "commonjs" | "esm" | "unknown";
export type ModuleModeProvider = (sourcePath: string) => CommonJsMode;
export type CommonJsCallClassification = {
  targetId?: string;
  externalName?: string;
  reason?: string;
};
export type CommonJsModuleImport = {
  sourcePath: string;
  line: number;
  text: string;
  specifier: string;
  targetPath?: string;
  external: boolean;
  reason?: string;
};
const defaultExport = Symbol("module.exports");
type ExportKey = string | typeof defaultExport;
type Module = {
  source: ts.SourceFile;
  candidate: boolean;
  invalid: boolean;
  exports: Map<ExportKey, string | undefined>;
  rejected: Set<ExportKey>;
};
type Binding = {
  esmNamespace?: boolean;
  module?: Module;
  property?: string;
  reason?: string;
  externalName?: string;
};
const pathOf = (source: ts.SourceFile) => source.fileName.replace(/^\//, "");
function walk(node: ts.Node, visit: (node: ts.Node) => void) {
  visit(node);
  ts.forEachChild(node, (child) => walk(child, visit));
}
function unwrap(expression: ts.Expression): ts.Expression {
  while (
    ts.isParenthesizedExpression(expression) ||
    ts.isAsExpression(expression) ||
    ts.isNonNullExpression(expression) ||
    ts.isTypeAssertionExpression(expression)
  )
    expression = expression.expression;
  return expression;
}
function member(expression: ts.Expression) {
  expression = unwrap(expression);
  if (ts.isPropertyAccessExpression(expression))
    return { base: unwrap(expression.expression), key: expression.name.text };
  if (ts.isElementAccessExpression(expression)) {
    const key = expression.argumentExpression;
    return {
      base: unwrap(expression.expression),
      key:
        key && (ts.isStringLiteral(key) || ts.isNumericLiteral(key))
          ? key.text
          : undefined,
    };
  }
  return undefined;
}
function isName(node: ts.Node, name: string): node is ts.Identifier {
  return ts.isIdentifier(node) && node.text === name;
}
function isConst(node: ts.VariableDeclaration) {
  return (
    ts.isVariableDeclarationList(node.parent) &&
    !!(node.parent.flags & ts.NodeFlags.Const)
  );
}
function writeTarget(node: ts.Node): ts.Expression | undefined {
  if (
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
    node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
  )
    return node.left;
  if (ts.isDeleteExpression(node)) return node.expression;
  if (
    (ts.isPostfixUnaryExpression(node) || ts.isPrefixUnaryExpression(node)) &&
    (node.operator === ts.SyntaxKind.PlusPlusToken ||
      node.operator === ts.SyntaxKind.MinusMinusToken)
  )
    return node.operand;
  if (
    (ts.isForInStatement(node) || ts.isForOfStatement(node)) &&
    !ts.isVariableDeclarationList(node.initializer)
  )
    return node.initializer;
  return undefined;
}

function writeTargets(node: ts.Node): ts.Expression[] {
  const target = writeTarget(node);
  if (!target) return [];
  function leaves(expression: ts.Expression): ts.Expression[] {
    expression = unwrap(expression);
    if (ts.isObjectLiteralExpression(expression))
      return expression.properties.flatMap((prop) =>
        ts.isShorthandPropertyAssignment(prop)
          ? [prop.name]
          : ts.isPropertyAssignment(prop)
            ? leaves(prop.initializer)
            : ts.isSpreadAssignment(prop)
              ? leaves(prop.expression)
              : [],
      );
    if (ts.isArrayLiteralExpression(expression))
      return expression.elements.flatMap((element) =>
        ts.isOmittedExpression(element)
          ? []
          : leaves(ts.isSpreadElement(element) ? element.expression : element),
      );
    if (ts.isBinaryExpression(expression)) return leaves(expression.left);
    return [expression];
  }
  return leaves(target);
}

/** A captured-AST registry, deliberately limited to one-hop CommonJS bindings.
 * Build all rejection facts before exposing any entry or classifying any call.
 */
export function createCommonJsAnalyzer(
  checker: ts.TypeChecker,
  sources: readonly ts.SourceFile[],
  declarations: ReadonlyMap<ts.Node, string>,
  modeForPath: ModuleModeProvider = (path) =>
    path.endsWith(".cjs")
      ? "commonjs"
      : path.endsWith(".mjs")
        ? "esm"
        : "unknown",
  configuredAlias: (path: string, specifier: string) => boolean = () => false,
) {
  const modules = new Map<ts.SourceFile, Module>();
  const rewritten = new Set<ts.Symbol>();
  const globalWrites = new Map<ts.SourceFile, Set<string>>();
  const bindings = new Map<ts.Symbol, Binding>();
  const requires = new Map<ts.CallExpression, Binding>();
  const moduleImports: CommonJsModuleImport[] = [];
  const symbol = (node: ts.Node) => checker.getSymbolAtLocation(node);
  const mode = (source: ts.SourceFile) => {
    const path = pathOf(source);
    if (path.endsWith(".mjs")) return "esm";
    if (
      source.statements.some(
        (s) =>
          ts.isImportDeclaration(s) ||
          ts.isExportDeclaration(s) ||
          ts.isExportAssignment(s) ||
          (ts.canHaveModifiers(s) &&
            ts
              .getModifiers(s)
              ?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)),
      )
    )
      return "esm";
    return path.endsWith(".cjs") ? "commonjs" : modeForPath(path);
  };
  // Compiler-created CommonJS symbols can have assignment declarations. Only
  // authored lexical bindings shadow Node globals (parameters, imports, etc.).
  function shadowed(node: ts.Identifier) {
    const lexical = checker
      .getSymbolsInScope(node, ts.SymbolFlags.Value)
      .find((s) => s.name === node.text);
    return (
      lexical?.declarations?.some(
        (d) =>
          ts.isVariableDeclaration(d) ||
          ts.isParameter(d) ||
          ts.isBindingElement(d) ||
          ts.isFunctionDeclaration(d) ||
          ts.isClassDeclaration(d) ||
          ts.isImportClause(d) ||
          ts.isImportSpecifier(d) ||
          ts.isNamespaceImport(d) ||
          ts.isImportEqualsDeclaration(d),
      ) ?? false
    );
  }
  function exportRoot(expression: ts.Expression): ts.Identifier | undefined {
    expression = unwrap(expression);
    if (isName(expression, "exports")) return expression;
    const part = member(expression);
    if (part?.key === "exports" && isName(part.base, "module"))
      return part.base;
    return undefined;
  }
  function exportReference(
    expression: ts.Expression,
  ): { root: ts.Identifier; property?: string; whole: boolean } | undefined {
    expression = unwrap(expression);
    const root = exportRoot(expression);
    if (root) return { root, whole: true };
    const part = member(expression);
    if (!part) return undefined;
    const parent = exportReference(part.base);
    if (!parent) return undefined;
    return {
      root: parent.root,
      property: parent.whole ? part.key : parent.property,
      whole: false,
    };
  }
  function recordRewrites(expression: ts.Expression) {
    if (!ts.isIdentifier(expression)) return;
    const sym = ts.isShorthandPropertyAssignment(expression.parent)
      ? checker.getShorthandAssignmentValueSymbol(expression.parent)
      : symbol(expression);
    if (sym) rewritten.add(sym);
    else globalWrites.get(expression.getSourceFile())!.add(expression.text);
  }
  for (const source of sources) {
    modules.set(source, {
      source,
      candidate: source.fileName.endsWith(".cjs"),
      invalid: mode(source) !== "commonjs",
      exports: new Map(),
      rejected: new Set(),
    });
    globalWrites.set(source, new Set());
    walk(source, (node) => {
      for (const target of writeTargets(node)) recordRewrites(target);
      // Invalid JS redeclarations can have distinct compiler symbols even
      // though an initializer overwrites the same runtime lexical binding.
      if (
        ts.isVariableDeclaration(node) &&
        node.initializer &&
        ts.isIdentifier(node.name)
      ) {
        const lexical = checker
          .getSymbolsInScope(node, ts.SymbolFlags.Value)
          .find((s) => s.name === node.name.getText());
        if (lexical && lexical !== symbol(node.name)) rewritten.add(lexical);
      }
    });
  }
  function callable(expression: ts.Expression): string | undefined {
    expression = unwrap(expression);
    if (ts.isFunctionExpression(expression) || ts.isArrowFunction(expression))
      return declarations.get(expression);
    if (!ts.isIdentifier(expression)) return undefined;
    return callableSymbol(symbol(expression));
  }
  function valueDeclarations(sym: ts.Symbol) {
    // Signatures do not introduce another executable body. Export validation
    // and local-call guards must agree about duplicate runtime declarations.
    return (
      sym.declarations?.filter(
        (d) =>
          (ts.isFunctionDeclaration(d) && d.body) ||
          ts.isVariableDeclaration(d),
      ) ?? []
    );
  }
  function callableSymbol(sym: ts.Symbol | undefined): string | undefined {
    if (!sym || rewritten.has(sym)) return undefined;
    // No aliases, imported types, signatures, or recursive value propagation.
    const values = valueDeclarations(sym);
    if (values.length !== 1) return undefined;
    const declaration = values[0]!;
    if (ts.isFunctionDeclaration(declaration))
      return declarations.get(declaration);
    if (
      ts.isVariableDeclaration(declaration) &&
      isConst(declaration) &&
      declaration.initializer &&
      (ts.isFunctionExpression(unwrap(declaration.initializer)) ||
        ts.isArrowFunction(unwrap(declaration.initializer)))
    )
      return declarations.get(unwrap(declaration.initializer));
    return undefined;
  }
  function addExport(
    mod: Module,
    key: ExportKey,
    value: ts.Expression | undefined,
    valid: boolean,
  ) {
    if (mod.exports.has(key) || !valid) mod.rejected.add(key);
    mod.exports.set(key, value && valid ? callable(value) : undefined);
  }
  for (const mod of modules.values()) {
    let rootAssignment: ts.BinaryExpression | undefined;
    let canonical = false;
    const propertyAssignments: { root: ts.Identifier; node: ts.Node }[] = [];
    const inspectWrite = (node: ts.Node, target: ts.Expression) => {
      const ref = exportReference(target);
      if (!ref) return;
      mod.candidate = true;
      if (shadowed(ref.root)) mod.invalid = true;
      const assignment =
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken
          ? node
          : undefined;
      const topLevel =
        ts.isExpressionStatement(node.parent) &&
        ts.isSourceFile(node.parent.parent) &&
        assignment?.left === target;
      if (!ref.whole) {
        propertyAssignments.push({ root: ref.root, node });
        if (ref.property === undefined) mod.invalid = true;
        else
          addExport(
            mod,
            ref.property,
            assignment?.right,
            topLevel && !!assignment && !!exportRoot(member(target)!.base),
          );
        return;
      }
      // The only permitted exports-root replacement is the initial canonical
      // exports = module.exports = callable assignment.
      if (
        assignment &&
        isName(unwrap(target), "exports") &&
        topLevel &&
        ts.isBinaryExpression(assignment.right) &&
        assignment.right.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        exportRoot(assignment.right.left)?.text === "module"
      ) {
        canonical = true;
        return;
      }
      const isCanonicalInner =
        assignment &&
        ts.isBinaryExpression(node.parent) &&
        node.parent.right === node &&
        isName(node.parent.left, "exports") &&
        ts.isExpressionStatement(node.parent.parent) &&
        ts.isSourceFile(node.parent.parent.parent);
      if (
        !assignment ||
        ref.root.text !== "module" ||
        (!topLevel && !isCanonicalInner) ||
        rootAssignment
      ) {
        mod.invalid = true;
        return;
      }
      rootAssignment = assignment;
      const value = unwrap(assignment.right);
      if (ts.isObjectLiteralExpression(value)) {
        for (const prop of value.properties) {
          if (!prop.name) {
            mod.invalid = true;
            continue;
          }
          const name = ts.isComputedPropertyName(prop.name)
            ? prop.name.expression
            : prop.name;
          const key =
            (!ts.isComputedPropertyName(prop.name) && ts.isIdentifier(name)) ||
            ts.isStringLiteral(name) ||
            ts.isNumericLiteral(name)
              ? name.text
              : undefined;
          if (key === undefined) {
            mod.invalid = true;
            continue;
          }
          const expression = ts.isPropertyAssignment(prop)
            ? prop.initializer
            : ts.isShorthandPropertyAssignment(prop)
              ? prop.name
              : undefined;
          // Shorthand names have a property symbol; use the actual value symbol.
          if (ts.isShorthandPropertyAssignment(prop)) {
            const id = callableSymbol(
              checker.getShorthandAssignmentValueSymbol(prop),
            );
            if (mod.exports.has(key)) mod.rejected.add(key);
            mod.exports.set(key, id);
          } else addExport(mod, key, expression, true);
        }
      } else addExport(mod, defaultExport, value, true);
    };
    walk(mod.source, (node) => {
      for (const target of writeTargets(node)) inspectWrite(node, target);
    });
    if (
      rootAssignment &&
      propertyAssignments.some(
        (p) =>
          p.node.pos < rootAssignment!.pos ||
          (p.root.text === "exports" && !canonical),
      )
    )
      mod.invalid = true;
    // Using the namespace as a value can mutate it through an untracked alias.
    walk(mod.source, (node) => {
      if (!ts.isExpression(node)) return;
      const root = exportRoot(node);
      const bareModule = isName(node, "module");
      if (!root && !bareModule) return;
      const parent = node.parent;
      // Identifier property names/declarations are not namespace reads.
      if (
        ts.isIdentifier(node) &&
        ((ts.isPropertyAccessExpression(parent) && parent.name === node) ||
          ((ts.isVariableDeclaration(parent) ||
            ts.isParameter(parent) ||
            ts.isFunctionDeclaration(parent)) &&
            parent.name === node))
      )
        return;
      if (
        bareModule &&
        member(parent as ts.Expression)?.base === node &&
        member(parent as ts.Expression)?.key === "exports"
      )
        return;
      if (root && shadowed(root)) {
        mod.candidate = true;
        mod.invalid = true;
      }
      if (root && member(parent as ts.Expression)?.base === node) return;
      if (
        root &&
        ts.isBinaryExpression(parent) &&
        parent.left === node &&
        parent.operatorToken.kind === ts.SyntaxKind.EqualsToken
      )
        return;
      mod.candidate = true;
      mod.invalid = true;
    });
  }
  function moduleForLiteral(literal: ts.StringLiteralLike) {
    const source = symbol(literal)?.declarations?.find(ts.isSourceFile);
    return source && modules.get(source);
  }
  function requireBinding(call: ts.CallExpression): Binding {
    const callee = unwrap(call.expression) as ts.Identifier;
    if (shadowed(callee))
      return { reason: "CommonJS require is lexically shadowed" };
    if (
      mode(call.getSourceFile()) !== "commonjs" ||
      rewritten.has(symbol(callee)!) ||
      globalWrites.get(call.getSourceFile())!.has("require")
    )
      return {
        reason: "CommonJS require identity or module mode is not established",
      };
    if (
      call.arguments.length !== 1 ||
      !ts.isStringLiteralLike(call.arguments[0]!)
    )
      return { reason: "CommonJS require needs one literal module specifier" };
    const literal = call.arguments[0] as ts.StringLiteralLike;
    const mod = moduleForLiteral(literal);
    if (mod) return { module: mod };
    if (
      !literal.text.startsWith(".") &&
      !literal.text.startsWith("/") &&
      !configuredAlias(pathOf(call.getSourceFile()), literal.text)
    )
      return { externalName: literal.text };
    return {
      reason: `CommonJS module ${literal.text} has no target within captured sources`,
    };
  }
  for (const source of sources)
    walk(source, (node) => {
      if (
        !ts.isCallExpression(node) ||
        !isName(unwrap(node.expression), "require")
      )
        return;
      const binding = requireBinding(node);
      requires.set(node, binding);
      moduleImports.push({
        sourcePath: pathOf(source),
        line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
        text: node.getText(),
        specifier:
          node.arguments[0] && ts.isStringLiteralLike(node.arguments[0])
            ? node.arguments[0].text
            : "<dynamic>",
        ...(binding.module
          ? { targetPath: pathOf(binding.module.source) }
          : {}),
        external: !!binding.externalName,
        ...(binding.reason ? { reason: binding.reason } : {}),
      });
    });
  function select(binding: Binding, key: string | undefined): Binding {
    if (key === undefined || binding.property !== undefined)
      return {
        ...binding,
        property: "",
        reason: "CommonJS property selection is dynamic or nested",
      };
    if (binding.esmNamespace && key === "default")
      return { ...binding, esmNamespace: false };
    return { ...binding, property: key, esmNamespace: false };
  }
  function required(expression: ts.Expression): Binding | undefined {
    expression = unwrap(expression);
    if (ts.isCallExpression(expression)) return requires.get(expression);
    const part = member(expression);
    if (part) {
      const base = required(part.base);
      if (base) return select(base, part.key);
    }
    return undefined;
  }
  function setBinding(name: ts.Identifier, binding: Binding, valid = true) {
    const sym = symbol(name);
    if (sym)
      bindings.set(
        sym,
        valid && !rewritten.has(sym)
          ? binding
          : {
              ...binding,
              reason: "CommonJS importer binding is mutable or rewritten",
            },
      );
  }
  for (const source of sources)
    walk(source, (node) => {
      if (ts.isVariableDeclaration(node) && node.initializer) {
        const binding = required(node.initializer);
        if (!binding) return;
        if (ts.isIdentifier(node.name))
          setBinding(node.name, binding, isConst(node));
        else if (ts.isObjectBindingPattern(node.name))
          for (const element of node.name.elements) {
            if (!ts.isIdentifier(element.name)) continue;
            const name = element.propertyName ?? element.name;
            const key =
              ts.isIdentifier(name) || ts.isStringLiteral(name)
                ? name.text
                : undefined;
            setBinding(
              element.name,
              select(binding, key),
              isConst(node) && !element.dotDotDotToken && !element.initializer,
            );
          }
      }
      if (
        ts.isImportDeclaration(node) &&
        ts.isStringLiteral(node.moduleSpecifier) &&
        node.importClause
      ) {
        const mod = moduleForLiteral(node.moduleSpecifier);
        if (!mod?.candidate) return;
        const clause = node.importClause;
        if (clause.name)
          setBinding(clause.name, {
            module: mod,
            ...(clause.isTypeOnly
              ? { reason: "Type-only import has no runtime identity" }
              : {}),
          });
        if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings))
          setBinding(clause.namedBindings.name, {
            module: mod,
            esmNamespace: true,
            ...(clause.isTypeOnly
              ? { reason: "Type-only import has no runtime identity" }
              : {}),
          });
        if (clause.namedBindings && ts.isNamedImports(clause.namedBindings))
          for (const element of clause.namedBindings.elements)
            setBinding(element.name, {
              module: mod,
              ...((element.propertyName ?? element.name).text === "default"
                ? {}
                : { property: (element.propertyName ?? element.name).text }),
              ...(clause.isTypeOnly || element.isTypeOnly
                ? { reason: "Type-only import has no runtime identity" }
                : {}),
            });
      }
    });
  function reference(expression: ts.Expression): Binding | undefined {
    expression = unwrap(expression);
    const direct = required(expression);
    if (direct) return direct;
    if (ts.isIdentifier(expression)) {
      const sym = symbol(expression);
      return sym && bindings.get(sym);
    }
    const part = member(expression);
    if (part) {
      const base = reference(part.base);
      if (base) return select(base, part.key);
    }
    const ref = exportReference(expression);
    if (ref)
      return {
        module: modules.get(expression.getSourceFile()),
        ...(ref.whole
          ? {}
          : {
              property: ref.property ?? "",
              ...(ref.property === undefined
                ? { reason: "Dynamic CommonJS export property" }
                : {}),
            }),
      };
    return undefined;
  }
  // A captured consumer can mutate the shared namespace. This pass must finish
  // for every file before entries/calls are accepted in any other consumer.
  for (const source of sources)
    walk(source, (node) => {
      for (const target of writeTargets(node)) {
        const ref = reference(target);
        if (ref?.module && !exportReference(target)) {
          if (ref.property && !ref.reason)
            ref.module.rejected.add(ref.property);
          else if (member(target)) ref.module.invalid = true;
        }
      }
      if (!ts.isExpression(node)) return;
      const ref = reference(node);
      if (!ref?.module || ref.property !== undefined || exportReference(node))
        return;
      const parent = node.parent;
      if (member(parent as ts.Expression)?.base === node) return;
      if (ts.isCallExpression(parent) && parent.expression === node) return;
      if (
        ts.isVariableDeclaration(parent) &&
        parent.initializer === node &&
        required(node)
      )
        return;
      if (
        ts.isExpressionStatement(parent) ||
        (ts.isBinaryExpression(parent) && parent.left === node)
      )
        return;
      if (
        ts.isIdentifier(node) &&
        ((ts.isVariableDeclaration(parent) && parent.name === node) ||
          ts.isNamespaceImport(parent) ||
          ts.isImportClause(parent) ||
          ts.isImportSpecifier(parent))
      )
        return;
      ref.module.invalid = true;
    });
  const exportedDeclarationIds = new Set<string>();
  for (const mod of modules.values())
    if (!mod.invalid)
      for (const [key, id] of mod.exports)
        if (id && !mod.rejected.has(key)) exportedDeclarationIds.add(id);
  function classify(binding: Binding): CommonJsCallClassification {
    if (binding.reason) return { reason: binding.reason };
    if (binding.esmNamespace)
      return { reason: "ESM namespace objects are not callable" };
    if (binding.externalName)
      return {
        externalName: `${binding.externalName}:${binding.property ?? "default"}`,
      };
    const mod = binding.module;
    const key = binding.property ?? defaultExport;
    if (!mod || mod.invalid)
      return {
        reason:
          "CommonJS module mode, namespace identity, or export stability is not established",
      };
    const id = mod.exports.get(key);
    return id && !mod.rejected.has(key)
      ? { targetId: id }
      : {
          reason: `CommonJS export ${String(key)} has no unique stable captured implementation`,
        };
  }
  function classifyCall(
    expression: ts.Expression,
  ): CommonJsCallClassification | undefined {
    expression = unwrap(expression);
    if (isName(expression, "require") && !shadowed(expression))
      return { reason: "CommonJS loader is not an indexed implementation" };
    const binding = reference(expression);
    if (binding) return classify(binding);
    // Imported aliases/re-export chains must not recover a rejected CJS value
    // from the checker's declaration alone. We do not propagate barrel values.
    let sym = symbol(
      member(expression) && ts.isPropertyAccessExpression(expression)
        ? expression.name
        : expression,
    );
    if (sym?.flags && sym.flags & ts.SymbolFlags.Alias)
      sym = checker.getAliasedSymbol(sym);
    if (
      sym &&
      modules.get(expression.getSourceFile())?.candidate &&
      (rewritten.has(sym) || valueDeclarations(sym).length > 1)
    )
      return {
        reason:
          "CommonJS callable binding has visible rewriting or ambiguous executable declarations",
      };
    if (
      sym?.declarations?.some(
        (d) =>
          d.getSourceFile() !== expression.getSourceFile() &&
          modules.get(d.getSourceFile())?.candidate,
      )
    )
      return {
        reason: "CommonJS alias needs a verified direct export binding",
      };
    return undefined;
  }
  return { exportedDeclarationIds, classifyCall, moduleImports };
}
