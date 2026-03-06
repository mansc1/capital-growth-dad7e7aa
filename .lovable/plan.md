

## Plan: Move dev-tools check inside component using `useLocation()`

### Single file change: `src/pages/Settings.tsx`

1. **Remove line ~27** — the module-level constant `const SHOW_DEV_TOOLS = ...`

2. **Inside `SettingsPage` component body** — add after existing hooks:
```ts
const location = useLocation();
const SHOW_DEV_TOOLS =
  import.meta.env.VITE_ENABLE_DEV_TOOLS === "true" ||
  new URLSearchParams(location.search).has("devtools");
```

3. **Import** — `useLocation` is already available from `react-router-dom` (already imported for `useNavigate`). Just add `useLocation` to the existing import.

No other changes needed.

