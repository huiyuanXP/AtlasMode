"""Read JSON source bytes on stdin; parse ASTs only. Never import target modules."""
import ast
import base64
import builtins
import io
import json
import sys
import tokenize


class Scope:
    def __init__(self, path, qualified="", kind="module", parent=None):
        self.path, self.qualified, self.kind, self.parent = path, qualified, kind, parent
        self.bindings = {}
        self.children = {}


def main():
    files = json.load(sys.stdin)
    nodes, imports, calls, diagnostics = [], [], [], []
    modules, roots, texts = {}, {}, {}
    for file in files:
        path = file["path"]
        module = path[:-3].replace("/", ".")
        if module.startswith("src."):
            module = module[4:]
        if module.endswith(".__init__"):
            module = module[:-9]
        elif module == "__init__":
            module = ""
        scope = Scope(path)
        roots[path] = scope
        modules[module] = scope
        file["module"] = module

    def module_name(file, name, level):
        if not level:
            return name or ""
        current = file["module"] if file["path"].endswith("/__init__.py") else file["module"].rpartition(".")[0]
        parts = current.split(".") if current else []
        if level - 1 > len(parts):
            return "<invalid-relative>"
        parts = parts[:len(parts) - level + 1]
        return ".".join(parts + ([name] if name else []))

    def text(path, node):
        return ast.get_source_segment(texts[path], node) or ast.unparse(node)

    class Collector(ast.NodeVisitor):
        def __init__(self, file):
            self.file = file
            self.scope = roots[file["path"]]
            self.counts = {}

        def definition(self, node, kind):
            parent = self.scope
            base = parent.qualified + "." + node.name if parent.qualified else node.name
            count = self.counts.get(base, 0) + 1
            self.counts[base] = count
            qualified = base if count == 1 else base + "#" + str(count)
            scope = Scope(parent.path, qualified, kind, parent)
            parent.bindings[node.name] = ("node", scope)
            parent.children[node.name] = scope
            signature = "class " + node.name if kind == "class" else ("async " if isinstance(node, ast.AsyncFunctionDef) else "") + "def " + node.name + "(" + ast.unparse(node.args) + ")"
            nodes.append(dict(path=scope.path, qualified=qualified, kind=kind, name=node.name, parent=parent.qualified, startLine=node.lineno, endLine=node.end_lineno, signature=signature, exported=not node.name.startswith("_")))
            for decorator in node.decorator_list:
                self.visit(decorator)
            if kind == "class":
                for base_node in node.bases:
                    self.visit(base_node)
            else:
                for default in node.args.defaults + [v for v in node.args.kw_defaults if v is not None]:
                    self.visit(default)
                args = node.args.posonlyargs + node.args.args + node.args.kwonlyargs
                for arg in args:
                    scope.bindings[arg.arg] = None
                if node.args.vararg:
                    scope.bindings[node.args.vararg.arg] = None
                if node.args.kwarg:
                    scope.bindings[node.args.kwarg.arg] = None
                static = any(isinstance(d, ast.Name) and d.id == "staticmethod" for d in node.decorator_list)
                if not static and kind == "function" and parent.kind == "class" and args and args[0].arg in ("self", "cls"):
                    scope.bindings[args[0].arg] = ("self", parent)
            self.scope = scope
            for statement in node.body:
                self.visit(statement)
            self.scope = parent

        def visit_FunctionDef(self, node):
            self.definition(node, "function")

        visit_AsyncFunctionDef = visit_FunctionDef

        def visit_ClassDef(self, node):
            self.definition(node, "class")

        def visit_Import(self, node):
            for alias in node.names:
                name = alias.asname or alias.name.split(".")[0]
                module = alias.name if alias.asname else name
                self.scope.bindings[name] = ("import", module, "", False)
                imports.append(dict(path=self.scope.path, module=alias.name, relative=False, line=node.lineno, text=text(self.scope.path, node)))

        def visit_ImportFrom(self, node):
            module = module_name(self.file, node.module, node.level)
            for alias in node.names:
                if alias.name == "*":
                    diagnostics.append(dict(filePath=self.scope.path, line=node.lineno, message="Wildcard import is not statically resolved"))
                else:
                    self.scope.bindings[alias.asname or alias.name] = ("import", module, alias.name, bool(node.level))
                imports.append(dict(path=self.scope.path, module=module, member=alias.name, relative=bool(node.level), line=node.lineno, text=text(self.scope.path, node)))

        def visit_Name(self, node):
            if isinstance(node.ctx, (ast.Store, ast.Del)):
                self.scope.bindings[node.id] = None

        def visit_Call(self, node):
            calls.append((self.scope, node))
            self.generic_visit(node)

        def visit_Lambda(self, node):
            # Lambda arguments create their own lexical scope; unknown bodies
            # cannot accidentally bind to a same-named global function.
            old = self.scope
            self.scope = Scope(old.path, old.qualified, "lambda", old)
            for arg in node.args.posonlyargs + node.args.args + node.args.kwonlyargs:
                self.scope.bindings[arg.arg] = None
            self.visit(node.body)
            self.scope = old

    for file in files:
        try:
            raw = base64.b64decode(file["bytes"])
            encoding, _ = tokenize.detect_encoding(io.BytesIO(raw).readline)
            texts[file["path"]] = raw.decode(encoding)
            tree = ast.parse(raw, filename=file["path"])
            Collector(file).visit(tree)
        except (SyntaxError, UnicodeError, LookupError, ValueError) as error:
            diagnostics.append(dict(filePath=file["path"], message="Python syntax/encoding error: " + str(error), **({"line": error.lineno} if getattr(error, "lineno", None) else {})))

    def lookup(scope, name):
        while scope:
            if name in scope.bindings:
                return scope.bindings[name]
            parent = scope.parent
            if scope.kind in ("function", "lambda") and parent and parent.kind == "class":
                parent = parent.parent
            scope = parent
        return ("external", "builtins." + name) if name in dir(builtins) else None

    def resolve(binding, attributes, seen=None):
        if binding is None:
            return None
        seen = set() if seen is None else seen
        key = (str(binding), tuple(attributes))
        if key in seen:
            return None
        seen.add(key)
        kind = binding[0]
        if kind in ("node", "self"):
            scope = binding[1]
            if not attributes:
                return (scope.path, scope.qualified) if kind == "node" else None
            if scope.kind == "class" and len(attributes) == 1:
                return resolve(scope.bindings.get(attributes[0]), [], seen)
            return None
        if kind == "external":
            return ("external", binding[1] + ("." + ".".join(attributes) if attributes else ""))
        module, member, relative = binding[1:]
        parts = ([member] if member else []) + attributes
        if module not in modules:
            # A missing local/relative module must not masquerade as a package.
            if relative or module.startswith("<"):
                return None
            return ("external", module + ("." + ".".join(parts) if parts else ""))
        scope = modules[module]
        if not parts:
            return None
        first = parts[0]
        if first in scope.bindings:
            return resolve(scope.bindings[first], parts[1:], seen)
        submodule = module + "." + first if module else first
        if submodule in modules:
            return resolve(("import", submodule, "", relative), parts[1:], seen)
        return None

    output_calls = []
    for scope, node in calls:
        expr, attributes = node.func, []
        while isinstance(expr, ast.Attribute):
            attributes.insert(0, expr.attr)
            expr = expr.value
        target = resolve(lookup(scope, expr.id), attributes) if isinstance(expr, ast.Name) else None
        output_calls.append(dict(path=scope.path, source=scope.qualified, line=node.lineno, text=text(scope.path, node), target=target))
    for item in imports:
        scope = modules.get(item["module"])
        submodule = item["module"] + "." + item.get("member", "")
        if not scope and submodule in modules:
            scope = modules[submodule]
        item["target"] = scope.path if scope else None
    json.dump(dict(nodes=nodes, calls=output_calls, imports=imports, diagnostics=diagnostics), sys.stdout, ensure_ascii=True)


if __name__ == "__main__":
    main()
