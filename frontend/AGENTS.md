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
