# Frontend Agent Guidelines

Write clean, readable, and simple frontend code. Optimize first for the next person who
must understand and safely change it; optimize for performance only when measurements or
clear product requirements justify the additional complexity.

## Core principles

- Prefer straightforward code over clever abstractions, compressed expressions, or
  premature micro-optimizations.
- Keep every change consistent with the broader application: reuse its terminology,
  interaction patterns, visual language, data shapes, and established conventions.
- Preserve existing behavior unless the task explicitly requires changing it.
- Keep changes focused. Make small nearby cleanups when they materially improve the
  requested work, but do not mix unrelated rewrites into a feature or fix.
- Avoid adding a new library, architectural pattern, or styling approach when the
  existing stack can solve the problem clearly.

## Components and responsibilities

- Give each component, hook, and helper one clear responsibility.
- Split a component when it combines unrelated concerns, becomes difficult to scan, or
  contains a substantial self-contained section with a meaningful name.
- Extract complex state transitions, effects, subscriptions, timers, and reusable data
  transformations into focused hooks or helpers.
- Keep data fetching and orchestration separate from presentation when that separation
  makes the behavior easier to understand and test.
- Prefer explicit props and small interfaces. Avoid long prop lists; when many props
  describe one concept, consider a well-named object or a better component boundary.
- Do not create abstractions solely to reduce line count. Extract code only when the new
  boundary represents a real concept or removes meaningful duplication.
- Avoid duplicating business rules. Give shared rules one well-named implementation.

## React and TypeScript

- Follow the Rules of Hooks and keep effect dependency arrays correct.
- Use effects only to synchronize with external systems. Derive values during rendering
  or handle state changes in event handlers when possible.
- Always clean up subscriptions, timers, event listeners, and in-flight requests.
- Model state so that contradictory states cannot easily coexist. Prefer a reducer or a
  small state machine when several booleans describe one workflow.
- Use precise TypeScript types. Avoid `any`, unsafe assertions, non-null assertions, and
  suppressed diagnostics unless there is a documented, unavoidable reason.
- Handle loading, empty, error, and success states deliberately.

## Markup, accessibility, and styling

- Format JSX as readable nested markup. Do not compress complex UI trees onto one line.
- Use semantic HTML and native controls before recreating behavior with generic elements.
- Ensure interactive controls are keyboard accessible and have an accessible name.
  Associate labels with inputs and preserve sensible heading structure and focus behavior.
- Reuse existing design tokens, classes, spacing, typography, and responsive conventions.
- Keep styles close to the feature they serve and use clear, consistently scoped class
  names. Avoid overly specific selectors, `!important`, and one-off overrides unless a
  documented constraint makes them necessary.
- Check new and modified UI at the app's relevant viewport sizes and interaction states.

## Client responsive-design standard

The customer-facing frontend is a multi-device product. Treat responsive design as a
first-class requirement for all client experiences: authentication, league discovery and
management, league views, and live broadcasts. The administration workspace is an
operator-facing, desktop/PC experience; it must remain usable and must not be regressed,
but it is not the target of this responsive-design initiative unless a task explicitly
says otherwise.

- Design for the available space and orientation, not for a named device or user-agent.
  Use responsive CSS, layout primitives, and content-aware sizing rather than device
  detection or separate mobile-only application flows.
- Every client-facing change must be considered at phone portrait, phone landscape,
  tablet, laptop/desktop, and large landscape TV/display sizes. Check both narrow width
  and short-height cases: a phone in landscape is not simply a smaller desktop.
- Treat phone portrait as the primary small-screen experience. In phone landscape,
  intentionally use the additional width while respecting the reduced height. Desktop
  and TV layouts may show richer simultaneous information, but must preserve clear
  reading distance, safe margins, and the core information hierarchy.
- Adapt composition and information density instead of only shrinking desktop UI. For a
  live broadcast, prioritise current score/status and the active event/commentary before
  secondary detail; use stacking, reordering, collapsing, or a deliberate compact view
  where the full desktop composition would become unreadable.
- Prefer fluid layouts (`minmax`, `auto-fit`, `clamp`, intrinsic sizing, flexible gaps)
  over fixed widths, fixed heights, and fixed-position assumptions. Remove or constrain
  minimum sizes that cause horizontal overflow. Use horizontal scrolling only for a
  clearly bounded, appropriate control such as a selector, and make its affordance clear.
- Account for safe areas and dynamic viewport height on mobile (`svh`/`dvh` where
  appropriate). Do not hide essential content behind browser UI, captions, floating
  controls, or decorative overlays.
- Maintain touch-friendly controls, readable type, keyboard operation, visible focus,
  text truncation/wrapping rules, and graceful handling of long club, league, player,
  and manager names at every layout mode. Respect reduced-motion preferences for
  non-essential broadcast animation.
- Keep responsive rules local to the feature where practical and document the intent of
  non-obvious breakpoints. Avoid a growing collection of one-off overrides; establish
  clear layout modes and reuse their spacing, type, and component rules.
- Validate responsive work with representative real viewport sizes and orientations,
  including narrow phones, wide phones in landscape, tablets, common laptops, desktop
  monitors, and 16:9 TVs. Also check loading, empty, error, overflowing-data, and active
  interaction states.

## Naming and documentation

- Use explicit names that express intent for components, props, state, handlers, and
  helpers. Use the same domain terms used by the UI and backend.
- Prefer small named functions over deeply nested callbacks and complex inline logic.
- Replace unexplained literals with named constants when the value represents a product,
  timing, layout, or interaction rule.
- Add comments only to explain non-obvious intent, constraints, or interaction rules.
  Do not narrate code that is already clear.

## Quality checks

- Add or update tests for non-trivial behavior, especially state transitions, data
  transformations, error handling, and regressions.
- Before finishing, run the relevant formatter, linter, type checker, tests, and build.
- Do not ignore failing checks. Fix failures caused by the change and clearly report any
  pre-existing or environment-related failures that remain.
- Review the final diff for accidental behavior changes, duplication, inconsistent UI,
  dead code, and unnecessary complexity.
