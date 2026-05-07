/**
 * typedoc-plugin-events
 *
 * Reads the EventMap type argument from classes that extend EventEmitter<EventMap>
 * and synthesises an "Events" section on the class page, documenting each event
 * as a method whose parameters are taken from the tuple values of the map.
 */

import {
  Converter,
  DeclarationReflection,
  SignatureReflection,
  ParameterReflection,
  ReflectionGroup,
  ReflectionKind,
  ReflectionFlag,
  Comment,
  IntrinsicType,
  UnknownType,
  ReferenceType,
  UnionType,
  IntersectionType,
  ArrayType,
  TupleType,
  NamedTupleMember,
  LiteralType,
  OptionalType,
  RestType,
  TypeScript as ts,
} from "typedoc";

// ---------------------------------------------------------------------------
// Helpers – TypeScript type → TypeDoc type
// ---------------------------------------------------------------------------

/**
 * Convert a TypeScript `ts.Type` to a TypeDoc `Type` object.
 *
 * @param {import("typescript").TypeChecker} checker
 * @param {import("typescript").Type} type
 * @param {import("typedoc").ProjectReflection} project
 * @param {Map<import("typescript").Symbol, import("typedoc").DeclarationReflection>} symbolToRefl
 * @param {number} depth  recursion guard
 * @returns {import("typedoc").Type}
 */
function convertTsType(checker, type, project, symbolToRefl, depth = 0) {
  if (depth > 8) return new UnknownType("...");

  const tf = ts.TypeFlags;
  const of = ts.ObjectFlags;

  // ── type alias (e.g. MessagePayload, EventPayload) ───────────────────────
  // Check this before expanding unions/intersections so that named aliases
  // are rendered as a single linked reference rather than their expanded form.
  if (type.aliasSymbol) {
    const sym = type.aliasSymbol;
    const name = checker.symbolToString(sym);
    const refl = symbolToRefl.get(sym);
    const typeArgs = type.aliasTypeArguments;
    const tdTypeArgs =
      typeArgs && typeArgs.length > 0 ?
        typeArgs.map((a) => convertTsType(checker, a, project, symbolToRefl, depth + 1))
      : undefined;
    const ref =
      refl ?
        ReferenceType.createResolvedReference(name, refl, project)
      : ReferenceType.createBrokenReference(name, project);
    if (tdTypeArgs) ref.typeArguments = tdTypeArgs;
    return ref;
  }

  // ── intrinsics ──────────────────────────────────────────────────────────
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

  // ── boolean literal ─────────────────────────────────────────────────────
  if (type.flags & tf.BooleanLiteral) {
    return new LiteralType(type.intrinsicName === "true");
  }

  // ── string literal ──────────────────────────────────────────────────────
  if (type.flags & tf.StringLiteral) {
    return new LiteralType(type.value);
  }

  // ── number literal ──────────────────────────────────────────────────────
  if (type.flags & tf.NumberLiteral) {
    return new LiteralType(type.value);
  }

  // ── bigint literal ──────────────────────────────────────────────────────
  if (type.flags & tf.BigIntLiteral) {
    const { negative, base10Value } = type.value;
    return new LiteralType({ negative, value: base10Value });
  }

  // ── union ────────────────────────────────────────────────────────────────
  if (type.flags & tf.Union) {
    const types = type.types.map((t) => convertTsType(checker, t, project, symbolToRefl, depth + 1));
    return new UnionType(types);
  }

  // ── intersection ─────────────────────────────────────────────────────────
  if (type.flags & tf.Intersection) {
    const types = type.types.map((t) => convertTsType(checker, t, project, symbolToRefl, depth + 1));
    return new IntersectionType(types);
  }

  // ── object types (arrays, tuples, references, anonymous) ─────────────────
  if (type.flags & tf.Object) {
    const objFlags = type.objectFlags ?? 0;

    // Array<T>  /  T[]
    if (checker.isArrayType(type)) {
      const elemType = checker.getTypeArguments(type)[0];
      if (elemType) {
        return new ArrayType(convertTsType(checker, elemType, project, symbolToRefl, depth + 1));
      }
      return new ArrayType(new IntrinsicType("unknown"));
    }

    // Tuple: a Reference type whose target has the Tuple flag
    if (objFlags & of.Reference && (type.target?.objectFlags ?? 0) & of.Tuple) {
      const target = type.target; // TupleType target
      const elementFlags = target?.elementFlags ?? [];
      const labeledNames = target?.labeledElementDeclarations ?? [];
      // Cap by elementFlags.length to avoid TS-internal extra type args
      const elements = checker.getTypeArguments(type).slice(0, elementFlags.length);

      const tdElements = elements.map((elem, i) => {
        const flags = elementFlags[i] ?? ts.ElementFlags.Required;
        const labelDecl = labeledNames[i];
        const label = labelDecl?.name?.getText?.() ?? null;
        const isOptional = !!(flags & ts.ElementFlags.Optional);
        const isRest = !!(flags & ts.ElementFlags.Rest);

        let inner = convertTsType(checker, elem, project, symbolToRefl, depth + 1);

        if (isRest) inner = new RestType(inner);
        else if (isOptional) inner = new OptionalType(inner);

        if (label) return new NamedTupleMember(label, isOptional, inner);
        return inner;
      });

      return new TupleType(tdElements);
    }

    // Named reference: Interface (e.g. ReadyPayload) or generic Reference (e.g. Queue<T>)
    if (objFlags & of.Reference || objFlags & of.Interface || objFlags & of.Class) {
      const sym = type.symbol ?? type.aliasSymbol;
      const name = sym ? checker.symbolToString(sym) : checker.typeToString(type);

      // Try to resolve to an existing TypeDoc reflection
      const refl = sym ? symbolToRefl.get(sym) : undefined;

      const typeArgs = checker.getTypeArguments(type);
      const tdTypeArgs =
        typeArgs.length > 0 ?
          typeArgs.map((a) => convertTsType(checker, a, project, symbolToRefl, depth + 1))
        : undefined;

      if (refl) {
        const ref = ReferenceType.createResolvedReference(name, refl, project);
        if (tdTypeArgs) ref.typeArguments = tdTypeArgs;
        return ref;
      }

      // Unresolved reference (external / built-in)
      const ref = ReferenceType.createBrokenReference(name, project);
      if (tdTypeArgs) ref.typeArguments = tdTypeArgs;
      return ref;
    }
  }

  // ── type parameter ────────────────────────────────────────────────────────
  if (type.flags & tf.TypeParameter) {
    const name = checker.typeToString(type);
    return new UnknownType(name);
  }

  // ── fallback ──────────────────────────────────────────────────────────────
  return new UnknownType(checker.typeToString(type));
}

// ---------------------------------------------------------------------------
// Collect event data while the TypeScript program is still active
// ---------------------------------------------------------------------------

/**
 * Describes a single event parameter collected during conversion.
 * @typedef {{ name: string; isOptional: boolean; isRest: boolean; tsType: import("typescript").Type }} EventParam
 */

/**
 * Describes a single event collected during conversion.
 * @typedef {{ eventName: string; params: EventParam[]; comment: string }} EventData
 */

/**
 * Given a class symbol, find the EventMap type argument passed to
 * EventEmitter<EventMap> in the heritage chain.
 *
 * @param {import("typescript").TypeChecker} checker
 * @param {import("typescript").Symbol} classSym
 * @returns {import("typescript").Type | null}
 */
function findEventMapType(checker, classSym) {
  const decls = classSym.getDeclarations() ?? [];

  for (const decl of decls) {
    if (!ts.isClassDeclaration(decl) && !ts.isClassExpression(decl)) continue;

    for (const clause of decl.heritageClauses ?? []) {
      if (clause.token !== ts.SyntaxKind.ExtendsKeyword) continue;

      for (const expr of clause.types) {
        const baseType = checker.getTypeAtLocation(expr);
        if (!baseType) continue;

        const baseSym = baseType.symbol ?? baseType.aliasSymbol;
        if (!baseSym) continue;

        const baseName = checker.symbolToString(baseSym);

        // Match any class/interface whose name ends with "EventEmitter"
        if (!baseName.endsWith("EventEmitter")) continue;

        const typeArgs = checker.getTypeArguments(baseType);
        if (typeArgs.length > 0) return typeArgs[0] ?? null;
      }
    }
  }

  return null;
}

/**
 * Collect raw event data from a class reflection while the TS program is active.
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

  const props = checker.getPropertiesOfType(eventMapType);
  if (props.length === 0) return null;

  /** @type {EventData[]} */
  const events = [];

  for (const prop of props) {
    const eventName = prop.getName();
    const propType = checker.getTypeOfSymbol(prop);

    // propType should be a tuple (or empty tuple []).
    // Tuple types in TS are represented as a Reference type whose target has the Tuple flag.
    // For mapped/conditional types (e.g. ConstrainEventMap<T>), resolve via getApparentType first.
    const resolvedType = propType.flags & ts.TypeFlags.Conditional ? checker.getApparentType(propType) : propType;

    /** @type {EventParam[]} */
    const params = [];

    const propObjFlags = resolvedType.objectFlags ?? 0;
    const isTupleRef =
      resolvedType.flags & ts.TypeFlags.Object
      && propObjFlags & ts.ObjectFlags.Reference
      && (resolvedType.target?.objectFlags ?? 0) & ts.ObjectFlags.Tuple;

    if (isTupleRef) {
      const tupleTarget = resolvedType.target;
      const elementFlags = tupleTarget?.elementFlags ?? [];
      const labeledDecls = tupleTarget?.labeledElementDeclarations ?? [];
      // Use elementFlags.length to avoid TS-internal extra type args
      const paramTypes = checker.getTypeArguments(resolvedType).slice(0, elementFlags.length);

      for (let i = 0; i < paramTypes.length; i++) {
        const flags = elementFlags[i] ?? ts.ElementFlags.Required;
        const labelDecl = labeledDecls[i];
        const paramName = labelDecl?.name?.getText?.() ?? `arg${i}`;
        const isOptional = !!(flags & ts.ElementFlags.Optional);
        const isRest = !!(flags & ts.ElementFlags.Rest);

        params.push({
          name: paramName,
          isOptional,
          isRest,
          tsType: paramTypes[i],
        });
      }
    }

    // Extract JSDoc comment from the property declaration
    let comment = "";
    const propDecls = prop.getDeclarations() ?? [];
    if (propDecls.length > 0) {
      const jsDocs = propDecls.flatMap((d) => ts.getJSDocCommentsAndTags(d));
      comment = jsDocs
        .filter((n) => ts.isJSDoc(n) && n.comment)
        .map((n) => {
          const c = n.comment;
          return typeof c === "string" ? c : c.map((p) => p.text ?? "").join("");
        })
        .join("\n\n")
        .trim();
    }

    events.push({ eventName, params, comment });
  }

  return events.length > 0 ? events : null;
}

// ---------------------------------------------------------------------------
// Apply collected data after conversion (no active program needed)
// ---------------------------------------------------------------------------

/**
 * Build a map from ts.Symbol → DeclarationReflection for all reflections in
 * the project so we can resolve cross-references.
 *
 * @param {import("typedoc").ProjectReflection} project
 * @param {import("typedoc").Context} context
 * @returns {Map<import("typescript").Symbol, import("typedoc").DeclarationReflection>}
 */
function buildSymbolMap(project, context) {
  const map = new Map();
  const all = project.getReflectionsByKind(ReflectionKind.All);
  for (const refl of all) {
    if (!(refl instanceof DeclarationReflection)) continue;
    const sym = context.getSymbolFromReflection(refl);
    if (sym) map.set(sym, refl);
  }
  return map;
}

/**
 * Apply previously collected event data to a class reflection.
 *
 * @param {import("typedoc").ProjectReflection} project
 * @param {import("typedoc").DeclarationReflection} classRefl
 * @param {EventData[]} events
 * @param {import("typescript").TypeChecker} checker  stored checker from conversion time
 * @param {Map<import("typescript").Symbol, import("typedoc").DeclarationReflection>} symbolMap
 */
function applyEventData(project, classRefl, events, checker, symbolMap) {
  const eventReflections = [];

  for (const { eventName, params, comment } of events) {
    // ── Create the method reflection ──────────────────────────────────────
    const methodRefl = new DeclarationReflection(eventName, ReflectionKind.Method, classRefl);
    methodRefl.flags.setFlag(ReflectionFlag.Public, true);

    if (comment) {
      methodRefl.comment = new Comment([{ kind: "text", text: comment }]);
    }

    // ── Create the call signature ─────────────────────────────────────────
    const sig = new SignatureReflection(eventName, ReflectionKind.CallSignature, methodRefl);
    sig.type = new IntrinsicType("void");

    // ── Build parameters ──────────────────────────────────────────────────
    if (params.length > 0) {
      sig.parameters = params.map(({ name, isOptional, isRest, tsType }) => {
        const param = new ParameterReflection(name, ReflectionKind.Parameter, sig);
        param.flags.setFlag(ReflectionFlag.Optional, isOptional);
        param.flags.setFlag(ReflectionFlag.Rest, isRest);

        let tdType = convertTsType(checker, tsType, project, symbolMap);
        // Rest parameters are rendered as T[] in TypeDoc
        if (isRest) tdType = new ArrayType(tdType);
        param.type = tdType;

        return param;
      });
    }

    methodRefl.signatures = [sig];
    eventReflections.push(methodRefl);
  }

  if (eventReflections.length === 0) return;

  // ── Attach to the class and create the "Events" group ────────────────────
  classRefl.children ??= [];
  for (const evRefl of eventReflections) {
    classRefl.children.push(evRefl);
    project.registerReflection(evRefl);
  }

  const group = new ReflectionGroup("Events", classRefl);
  group.children = eventReflections;

  classRefl.groups ??= [];
  classRefl.groups.push(group);
}

// ---------------------------------------------------------------------------
// Plugin entry point
// ---------------------------------------------------------------------------

/**
 * @param {import("typedoc").Application} app
 */
export function load(app) {
  /**
   * Stores collected event data per reflection id.
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
        // Store the checker alongside the events so we can use it later
        // for type conversion (checker is still valid after conversion ends)
        pending.set(reflection.id, { events, checker: context.checker });
      }
    } catch {
      // Silently skip – class may not have a symbol yet at this point
    }
  });

  // ── Phase 2: apply after all reflections are resolved ────────────────────
  // Priority -200 ensures we run after TypeDoc's GroupPlugin (priority -100),
  // which unconditionally skips group-building when reflection.groups is already set.
  // By running after it, we can safely push our "Events" group onto the existing array.
  app.converter.on(
    Converter.EVENT_RESOLVE_END,
    (context) => {
      if (pending.size === 0) return;

      const project = context.project;
      const symbolMap = buildSymbolMap(project, context);
      for (const [reflId, { events, checker }] of pending) {
        const refl = project.getReflectionById(reflId);
        if (!(refl instanceof DeclarationReflection)) continue;

        try {
          applyEventData(project, refl, events, checker, symbolMap);
        } catch (err) {
          app.logger.warn(`[typedoc-plugin-events] Failed to apply events for class '${refl.name}': ${err.message}`);
        }
      }

      pending.clear();
    },
    -200
  );
}
