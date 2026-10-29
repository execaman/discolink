/**
 * typedoc-plugin-events
 *
 * For classes extending EventEmitter<EventMap>, synthesises an "Events"
 * section on the class page; each map entry becomes a method whose
 * parameters come from the tuple values of the map.
 */
import {
  ArrayType,
  Comment,
  Converter,
  DeclarationReflection,
  IntersectionType,
  IntrinsicType,
  LiteralType,
  NamedTupleMember,
  OptionalType,
  ParameterReflection,
  ReferenceType,
  ReflectionFlag,
  ReflectionGroup,
  ReflectionKind,
  RestType,
  SignatureReflection,
  TupleType,
  UnionType,
  UnknownType,
  TypeScript as ts,
} from "typedoc";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Name of the synthesized reflection group. */
const EVENTS_GROUP_NAME = "Events";

/** Priority of TypeDoc's built-in GroupPlugin; we run after it. */
const GROUP_PLUGIN_PRIORITY = -100;

/** Plugin priority: one hundred below GroupPlugin so we append to groups. */
const PLUGIN_PRIORITY = GROUP_PLUGIN_PRIORITY - 100;

// ---------------------------------------------------------------------------
// TS compiler type -> TypeDoc type
// ---------------------------------------------------------------------------

/** One event parameter: name, optionality, rest flag, raw ts.Type. */
/** @typedef {{ name: string; isOptional: boolean; isRest: boolean; tsType: import("typescript").Type }} EventParam */

/** One raw comment part before link resolution. */
/** @typedef {{ kind: "text" | "inline-tag", text: string, target?: string | null }} RawCommentPart */

/** One synthesized event: name, params, raw JSDoc comment parts. */
/** @typedef {{ eventName: string; params: EventParam[]; comment: RawCommentPart[] }} EventData */

/**
 * Convert a ts.Type into a TypeDoc Type.
 * Failures fall back to UnknownType so one bad type cannot break the docs build.
 * Note: reads compiler internals (aliases, tuple flags, ...), so a TS major
 * bump may need this mapping reviewed.
 *
 * @param {import("typescript").TypeChecker} checker
 * @param {import("typescript").Type} type
 * @param {import("typedoc").ProjectReflection} project
 * @param {Map<import("typescript").Symbol, import("typedoc").DeclarationReflection>} symbolToRefl
 * @param {number} [depth] recursion guard
 * @returns {import("typedoc").Type}
 */
function convertTsType(checker, type, project, symbolToRefl, depth = 0) {
  if (depth > 8) return new UnknownType("...");

  try {
    const tf = ts.TypeFlags;
    const of = ts.ObjectFlags;

    // type alias -> single linked reference (broken if undocumented)
    if (type.aliasSymbol) {
      const sym = type.aliasSymbol;
      const name = checker.symbolToString(sym);
      const refl = symbolToRefl.get(sym);
      const ref =
        refl ?
          ReferenceType.createResolvedReference(name, refl, project)
        : ReferenceType.createBrokenReference(name, project);
      const typeArgs = type.aliasTypeArguments ?? [];
      if (typeArgs.length) {
        ref.typeArguments = typeArgs.map((a) => convertTsType(checker, a, project, symbolToRefl, depth + 1));
      }
      return ref;
    }

    // intrinsics
    if (type.flags & tf.Any) return new IntrinsicType("any");
    if (type.flags & tf.Unknown) return new IntrinsicType("unknown");
    if (type.flags & tf.Never) return new IntrinsicType("never");
    if (type.flags & tf.Void) return new IntrinsicType("void");
    if (type.flags & tf.Undefined) return new IntrinsicType("undefined");
    if (type.flags & tf.Null) return new IntrinsicType("null");
    if (type.flags & tf.String) return new IntrinsicType("string");
    if (type.flags & tf.Number) return new IntrinsicType("number");
    if (type.flags & tf.BigInt) return new IntrinsicType("bigint");
    if (type.flags & tf.Boolean) return new IntrinsicType("boolean");
    if (type.flags & tf.ESSymbol) return new IntrinsicType("symbol");

    // literals
    if (type.flags & tf.BooleanLiteral) return new LiteralType(type.intrinsicName === "true");
    if (type.flags & tf.StringLiteral) return new LiteralType(type.value);
    if (type.flags & tf.NumberLiteral) return new LiteralType(type.value);
    if (type.flags & tf.BigIntLiteral) {
      const { negative, base10Value } = type.value;
      return new LiteralType({ negative, value: base10Value });
    }

    // unions / intersections
    if (type.flags & tf.Union) {
      return new UnionType((type.types ?? []).map((t) => convertTsType(checker, t, project, symbolToRefl, depth + 1)));
    }
    if (type.flags & tf.Intersection) {
      return new IntersectionType(
        (type.types ?? []).map((t) => convertTsType(checker, t, project, symbolToRefl, depth + 1))
      );
    }

    // object types (arrays, tuples, references)
    if (type.flags & tf.Object) {
      const objFlags = type.objectFlags ?? 0;

      // Array<T> / T[]
      if (checker.isArrayType(type)) {
        const elems = checker.getTypeArguments(type) ?? [];
        const elem = elems[0];
        return new ArrayType(
          elem ? convertTsType(checker, elem, project, symbolToRefl, depth + 1) : new IntrinsicType("unknown")
        );
      }

      // tuple: Reference whose target carries the Tuple flag
      if (objFlags & of.Reference && (type.target?.objectFlags ?? 0) & of.Tuple) {
        const target = type.target;
        const elementFlags = target?.elementFlags ?? [];
        const labeled = target?.labeledElementDeclarations ?? [];
        const args = (checker.getTypeArguments(type) ?? []).slice(0, elementFlags.length);

        const elements = args.map((tsType, i) => {
          if (!tsType) return new UnknownType("...");
          const flags = elementFlags[i] ?? ts.ElementFlags.Required;
          const labelDecl = labeled[i];
          const label = labelDecl?.name?.getText?.() ?? null;
          const isOptional = !!(flags & ts.ElementFlags.Optional);
          const isRest = !!(flags & ts.ElementFlags.Rest);

          let inner = convertTsType(checker, tsType, project, symbolToRefl, depth + 1);
          if (isRest) inner = new RestType(inner);
          else if (isOptional) inner = new OptionalType(inner);
          return label ? new NamedTupleMember(label, isOptional, inner) : inner;
        });

        return new TupleType(elements);
      }

      // named reference: interface / class / generic type
      if (objFlags & (of.Reference | of.Interface | of.Class)) {
        const sym = type.symbol ?? type.aliasSymbol;
        const name = sym ? checker.symbolToString(sym) : checker.typeToString(type);
        const refl = sym ? symbolToRefl.get(sym) : undefined;
        const typeArgs = checker.getTypeArguments(type) ?? [];

        const ref =
          refl ?
            ReferenceType.createResolvedReference(name, refl, project)
          : ReferenceType.createBrokenReference(name, project);
        if (typeArgs.length) {
          ref.typeArguments = typeArgs.map((a) => convertTsType(checker, a, project, symbolToRefl, depth + 1));
        }
        return ref;
      }
    }

    // type parameter / anything else
    if (type.flags & tf.TypeParameter) return new UnknownType(checker.typeToString(type));
    return new UnknownType(checker.typeToString(type));
  } catch {
    return new UnknownType(checker.typeToString(type));
  }
}

/**
 * Convert a TypeScript JSDoc comment into raw comment parts.
 * Preserves inline tags ({@linkcode}, {@link}, {@linkplain}) with string
 * targets that are resolved to TypeDoc reflections later (in phase 2).
 *
 * @param {string | import("typescript").NodeArray<import("typescript").JSDocComment> | undefined} comment
 * @returns {RawCommentPart[]}
 */
function jsDocToRawParts(comment) {
  if (!comment) return [{ kind: "text", text: "" }];
  if (typeof comment === "string") return [{ kind: "text", text: comment }];

  /** @type {RawCommentPart[]} */
  const parts = [];
  for (const c of comment) {
    switch (c.kind) {
      case ts.SyntaxKind.JSDocText:
        parts.push({ kind: "text", text: c.text });
        break;
      case ts.SyntaxKind.JSDocLinkCode:
      case ts.SyntaxKind.JSDocLinkPlain:
      case ts.SyntaxKind.JSDocLink: {
        const tagName =
          c.kind === ts.SyntaxKind.JSDocLinkCode ? "@linkcode"
          : c.kind === ts.SyntaxKind.JSDocLinkPlain ? "@linkplain"
          : "@link";

        const targetName = c.name?.getText?.() ?? c.text ?? "";
        const displayText = c.text || targetName;
        parts.push({
          kind: "inline-tag",
          tag: tagName,
          text: displayText,
          target: targetName || null,
        });
        break;
      }
    }
  }
  return parts.length > 0 ? parts : [{ kind: "text", text: "" }];
}

/**
 * Resolve raw comment part link targets to TypeDoc reflections using a
 * complete name -> reflection map (built once all reflections exist).
 *
 * @param {RawCommentPart[]} parts
 * @param {Map<string, import("typedoc").DeclarationReflection>} nameMap
 * @returns {import("typedoc").CommentDisplayPart[]}
 */
function resolveCommentParts(parts, nameMap) {
  return parts.map((part) => {
    if (part.kind === "inline-tag" && part.target) {
      const refl = nameMap.get(part.target);
      if (refl) {
        return { ...part, target: refl };
      }
    }
    return part;
  });
}

// ---------------------------------------------------------------------------
// Collect event data while the TS program is active (checker available)
// ---------------------------------------------------------------------------

/**
 * Find the EventMap type argument in the class's extends chain.
 * Matches any base class whose name ends with "EventEmitter".
 *
 * @param {import("typescript").TypeChecker} checker
 * @param {import("typescript").Symbol} classSym
 * @returns {import("typescript").Type | null}
 */
function findEventMapType(checker, classSym) {
  for (const decl of classSym.getDeclarations() ?? []) {
    if (!ts.isClassDeclaration(decl) && !ts.isClassExpression(decl)) continue;

    for (const clause of decl.heritageClauses ?? []) {
      if (clause.token !== ts.SyntaxKind.ExtendsKeyword) continue;

      for (const expr of clause.types) {
        const baseType = checker.getTypeAtLocation(expr);
        const baseSym = baseType?.symbol ?? baseType?.aliasSymbol;
        if (!baseSym) continue;
        if (!checker.symbolToString(baseSym).endsWith("EventEmitter")) continue;

        const typeArgs = checker.getTypeArguments(baseType);
        if (typeArgs.length > 0) return typeArgs[0] ?? null;
      }
    }
  }

  return null;
}

/**
 * Read raw event data (name, param flags/types, JSDoc) from a class reflection.
 * ts.Types are stored unconverted; conversion happens at resolve time.
 * Link targets in JSDoc are left as strings for phase-2 resolution.
 *
 * @param {import("typedoc").Context} context
 * @param {import("typedoc").DeclarationReflection} classRefl
 * @returns {EventData[] | null}
 */
function collectEventData(context, classRefl) {
  const checker = context.checker;
  const classSym = context.getSymbolFromReflection(classRefl);
  if (!classSym) return null;

  const eventMapType = findEventMapType(checker, classSym);
  if (!eventMapType) return null;

  const events = [];
  for (const prop of checker.getPropertiesOfType(eventMapType)) {
    const eventName = prop.getName();

    // conditional types (e.g. ConstrainEventMap<T>): resolve via apparent type
    const propType = checker.getTypeOfSymbol(prop);
    const resolved = propType.flags & ts.TypeFlags.Conditional ? checker.getApparentType(propType) : propType;

    const params = [];
    const objFlags = resolved.objectFlags ?? 0;
    if (
      resolved.flags & ts.TypeFlags.Object
      && objFlags & ts.ObjectFlags.Reference
      && (resolved.target?.objectFlags ?? 0) & ts.ObjectFlags.Tuple
    ) {
      const target = resolved.target;
      const elementFlags = target?.elementFlags ?? [];
      const labeled = target?.labeledElementDeclarations ?? [];
      const args = (checker.getTypeArguments(resolved) ?? []).slice(0, elementFlags.length);

      for (let i = 0; i < args.length; i++) {
        const tsType = args[i];
        if (!tsType) continue;
        const flags = elementFlags[i] ?? ts.ElementFlags.Required;
        params.push({
          name: labeled[i]?.name?.getText?.() ?? `arg${i}`,
          isOptional: !!(flags & ts.ElementFlags.Optional),
          isRest: !!(flags & ts.ElementFlags.Rest),
          tsType,
        });
      }
    }

    // JSDoc comment of the map property (raw parts, links resolved later)
    /** @type {RawCommentPart[]} */
    let comment = [];
    for (const decl of prop.getDeclarations() ?? []) {
      for (const doc of ts.getJSDocCommentsAndTags(decl)) {
        if (!ts.isJSDoc(doc) || !doc.comment) continue;
        const parts = jsDocToRawParts(doc.comment);
        if (parts.length > 0) {
          if (comment.length > 0) comment.push({ kind: "text", text: "\n\n" });
          comment.push(...parts);
        }
      }
    }

    events.push({ eventName, params, comment });
  }

  return events.length ? events : null;
}

// ---------------------------------------------------------------------------
// Symbol -> reflection lookup for the whole project (built once, phase 2)
// ---------------------------------------------------------------------------

/**
 * Build maps from ts.Symbol -> DeclarationReflection and reflection name ->
 * DeclarationReflection for every reflection in the project.
 *
 * @param {import("typedoc").ProjectReflection} project
 * @param {import("typedoc").Context} context
 * @returns {{ symbolMap: Map<import("typescript").Symbol, import("typedoc").DeclarationReflection>, nameMap: Map<string, import("typedoc").DeclarationReflection> }}
 */
function buildSymbolMaps(project, context) {
  const symbolMap = new Map();
  const nameMap = new Map();
  for (const refl of project.getReflectionsByKind(ReflectionKind.All)) {
    if (!(refl instanceof DeclarationReflection)) continue;
    const sym = context.getSymbolFromReflection(refl);
    if (sym) symbolMap.set(sym, refl);
    if (!nameMap.has(refl.name)) nameMap.set(refl.name, refl);
  }
  return { symbolMap, nameMap };
}

// ---------------------------------------------------------------------------
// Apply collected event data to the class reflection (checker still valid)
// ---------------------------------------------------------------------------

/**
 * Wrap resolved comment parts in a TypeDoc Comment instance.
 *
 * @param {import("typedoc").CommentDisplayPart[]} comment fully resolved comment parts
 * @returns {import("typedoc").Comment}
 */
function applyEventComment(comment) {
  const c = new Comment();
  c.summary = comment;
  return c;
}

/**
 * Apply previously collected event data to a class reflection.
 *
 * @param {import("typedoc").ProjectReflection} project
 * @param {import("typedoc").DeclarationReflection} classRefl
 * @param {EventData[]} events
 * @param {import("typescript").TypeChecker} checker stored checker from conversion time
 * @param {Map<import("typescript").Symbol, import("typedoc").DeclarationReflection>} symbolMap
 * @param {Map<string, import("typedoc").DeclarationReflection>} nameMap
 */
function applyEventData(project, classRefl, events, checker, symbolMap, nameMap) {
  const eventReflections = [];

  for (const { eventName, params, comment } of events) {
    // Resolve raw link targets to reflections now that all exist
    const resolvedComment = resolveCommentParts(comment, nameMap);

    const methodRefl = new DeclarationReflection(eventName, ReflectionKind.Method, classRefl);
    methodRefl.flags.setFlag(ReflectionFlag.Public, true);

    const sig = new SignatureReflection(eventName, ReflectionKind.CallSignature, methodRefl);
    sig.type = new IntrinsicType("void");

    if (resolvedComment.length > 0) {
      const c = applyEventComment(resolvedComment);
      methodRefl.comment = c;
      sig.comment = c;
    }

    if (params.length > 0) {
      sig.parameters = params.map(({ name, isOptional, isRest, tsType }) => {
        const param = new ParameterReflection(name, ReflectionKind.Parameter, sig);
        param.flags.setFlag(ReflectionFlag.Optional, isOptional);
        param.flags.setFlag(ReflectionFlag.Rest, isRest);

        // rest params render as T[] in TypeDoc
        let tdType = convertTsType(checker, tsType, project, symbolMap);
        if (isRest) tdType = new ArrayType(tdType);
        param.type = tdType;

        return param;
      });
    }

    methodRefl.signatures = [sig];
    eventReflections.push(methodRefl);
  }

  if (eventReflections.length === 0) return;

  classRefl.children ??= [];
  for (const evRefl of eventReflections) {
    classRefl.children.push(evRefl);
    project.registerReflection(evRefl);
  }

  const group = new ReflectionGroup(EVENTS_GROUP_NAME, classRefl);
  group.children = eventReflections;
  classRefl.groups ??= [];
  classRefl.groups.push(group);
}

// ---------------------------------------------------------------------------
// Plugin entry point
// ---------------------------------------------------------------------------

/** @param {import("typedoc").Application} app */
export function load(app) {
  const logger = app.logger;

  /**
   * Event data captured while converting each class.
   * Keyed by reflection.id → { events, checker }
   * @type {Map<number, { events: EventData[]; checker: import("typescript").TypeChecker }>}
   */
  const pending = new Map();

  // ── Phase 1: collect while the TS program is active ──────────────────────
  app.converter.on(Converter.EVENT_CREATE_DECLARATION, (context, reflection) => {
    if (!(reflection instanceof DeclarationReflection)) return;
    if (reflection.kind !== ReflectionKind.Class) return;

    try {
      const events = collectEventData(context, reflection);
      if (events) {
        // Capture the checker now: it is unavailable at resolve end in TypeDoc v0.28+.
        pending.set(reflection.id, { events, checker: context.checker });
      }
    } catch (err) {
      logger.debug(`[typedoc-plugin-events] Failed to collect events for class '${reflection.name}': ${err.message}`);
    }
  });

  // ── Phase 2: apply after all reflections are resolved ────────────────────
  // Runs after GroupPlugin (priority -100) so we append to reflection.groups.
  app.converter.on(
    Converter.EVENT_RESOLVE_END,
    (context) => {
      if (pending.size === 0) return;

      const project = context.project;
      const { symbolMap, nameMap } = buildSymbolMaps(project, context);

      for (const [reflId, { events, checker }] of pending) {
        const refl = project.getReflectionById(reflId);
        if (!(refl instanceof DeclarationReflection)) continue;

        try {
          applyEventData(project, refl, events, checker, symbolMap, nameMap);
        } catch (err) {
          logger.warn(`[typedoc-plugin-events] Failed to document events for class '${refl.name}': ${err.message}`);
        }
      }

      pending.clear();
    },
    PLUGIN_PRIORITY
  );
}
