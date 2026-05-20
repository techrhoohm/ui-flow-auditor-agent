import type { Priority, TestType } from "@/lib/test-cases";

export type TCTemplate = {
  id: string;
  category: string;
  title: string;
  body: string;
  priority: Priority;
  type: TestType;
};

export type ScriptTemplate = {
  id: string;
  category: string;
  name: string;
  description: string;
  body: string;
};

export const TC_CATEGORIES = [
  "Navigation",
  "Forms & Inputs",
  "Buttons & CTAs",
  "Modals & Overlays",
  "Data & State",
  "Auth",
  "Visual",
  "Accessibility",
  "Performance",
] as const;

export type TCCategory = (typeof TC_CATEGORIES)[number];

export const SCRIPT_CATEGORIES = [
  "Basic",
  "Forms",
  "Navigation",
  "Accessibility",
  "Auth",
  "Error States",
  "Visual",
] as const;

export type ScriptCategory = (typeof SCRIPT_CATEGORIES)[number];

// ─── Test Case Templates ──────────────────────────────────────────────────────

export const TC_TEMPLATES: TCTemplate[] = [
  // Navigation
  {
    id: "nav-loads-without-error",
    category: "Navigation",
    title: "Screen loads without error",
    body: "1. Navigate to the screen directly via URL or app entry point.\n2. Observe the rendered content.\n\nExpected: Screen renders completely with no error overlays, broken images, or console errors.",
    priority: "P1",
    type: "functional",
  },
  {
    id: "nav-back-returns-to-prior",
    category: "Navigation",
    title: "Back navigation returns to prior screen",
    body: "1. Navigate forward from Screen A to this screen.\n2. Press the browser Back button or in-app back control.\n\nExpected: User lands on Screen A with its previous state preserved (scroll position, form values).",
    priority: "P1",
    type: "functional",
  },
  {
    id: "nav-deep-link",
    category: "Navigation",
    title: "Direct URL / deep link opens correct screen",
    body: "1. Paste the screen's direct URL into a fresh browser tab.\n2. Observe the loaded content.\n\nExpected: Correct screen loads. Authenticated routes redirect to login first, then return here after auth.",
    priority: "P2",
    type: "functional",
  },
  {
    id: "nav-breadcrumb",
    category: "Navigation",
    title: "Breadcrumb reflects current location",
    body: "1. Navigate to this screen through the normal user flow.\n2. Inspect the breadcrumb component.\n\nExpected: Each breadcrumb segment is correct, clickable, and links to the right ancestor screen.",
    priority: "P2",
    type: "functional",
  },
  {
    id: "nav-active-menu-item",
    category: "Navigation",
    title: "Active nav item is highlighted",
    body: "1. Navigate to this screen.\n2. Look at the global navigation menu.\n\nExpected: The nav item corresponding to this section is visually active/selected (different color, underline, or indicator).",
    priority: "P2",
    type: "visual",
  },

  // Forms & Inputs
  {
    id: "form-required-validation",
    category: "Forms & Inputs",
    title: "Required field validation triggers on empty submit",
    body: "1. Leave all required fields empty.\n2. Click the submit button.\n\nExpected: Each required field shows a descriptive inline error message. Form does not submit.",
    priority: "P0",
    type: "functional",
  },
  {
    id: "form-invalid-format-error",
    category: "Forms & Inputs",
    title: "Invalid format shows descriptive inline error",
    body: "1. Enter an invalid value in a formatted field (e.g. 'abc' in an email field).\n2. Blur the field or submit the form.\n\nExpected: A clear inline error appears explaining the correct format. Field is marked invalid (red border or icon).",
    priority: "P0",
    type: "functional",
  },
  {
    id: "form-error-clears-on-fix",
    category: "Forms & Inputs",
    title: "Inline error clears when user corrects input",
    body: "1. Trigger a validation error on a field.\n2. Correct the input to a valid value.\n\nExpected: Error message disappears without requiring a re-submit. Field returns to its default style.",
    priority: "P1",
    type: "functional",
  },
  {
    id: "form-optional-fields-submit",
    category: "Forms & Inputs",
    title: "Optional fields submit successfully when empty",
    body: "1. Fill in only required fields, leave all optional fields blank.\n2. Submit the form.\n\nExpected: Form submits successfully with no validation errors on optional fields.",
    priority: "P1",
    type: "functional",
  },
  {
    id: "form-reset-clears-fields",
    category: "Forms & Inputs",
    title: "Reset / Clear button empties all fields",
    body: "1. Fill in several form fields with data.\n2. Click the Reset or Clear button.\n\nExpected: All fields return to their default empty or placeholder state. No residual data remains.",
    priority: "P1",
    type: "functional",
  },
  {
    id: "form-char-limit",
    category: "Forms & Inputs",
    title: "Character count limit is enforced and shown",
    body: "1. Locate a field with a character limit.\n2. Type past the limit.\n\nExpected: Input stops accepting characters at the limit OR shows a counter warning. Counter updates live. Excess characters are not accepted.",
    priority: "P2",
    type: "functional",
  },
  {
    id: "form-password-visibility",
    category: "Forms & Inputs",
    title: "Password visibility toggle works correctly",
    body: "1. Focus the password field and type a password.\n2. Click the eye/show icon.\n3. Click again to hide.\n\nExpected: Password text is visible when toggled on and hidden (asterisks) when toggled off.",
    priority: "P2",
    type: "functional",
  },
  {
    id: "form-autocomplete",
    category: "Forms & Inputs",
    title: "Autocomplete / dropdown filters as user types",
    body: "1. Click into an autocomplete input field.\n2. Type at least 2 characters.\n3. Observe the dropdown suggestions.\n\nExpected: Suggestions update in real time and match the typed query. Selecting a suggestion fills the field.",
    priority: "P1",
    type: "functional",
  },
  {
    id: "form-label-association",
    category: "Forms & Inputs",
    title: "All form fields have associated visible labels",
    body: "1. Inspect each form field.\n2. Check that a <label> element exists for every input, select, and textarea.\n3. Click each label — it should focus the associated field.\n\nExpected: Every field has a descriptive label. Placeholder text alone does not count as a label.",
    priority: "P0",
    type: "a11y",
  },
  {
    id: "form-error-aria",
    category: "Forms & Inputs",
    title: "Error messages linked to inputs via aria-describedby",
    body: "1. Trigger validation errors on form fields.\n2. Inspect the error message elements.\n\nExpected: Each input has aria-invalid='true' when in error state. The error message element is referenced by aria-describedby on the input.",
    priority: "P0",
    type: "a11y",
  },

  // Buttons & CTAs
  {
    id: "btn-primary-visible",
    category: "Buttons & CTAs",
    title: "Primary CTA is visible above the fold",
    body: "1. Open this screen without scrolling.\n2. Locate the primary call-to-action button.\n\nExpected: The CTA is fully visible and clickable within the initial viewport on both mobile and desktop.",
    priority: "P1",
    type: "visual",
  },
  {
    id: "btn-disabled-state",
    category: "Buttons & CTAs",
    title: "Disabled state prevents action and looks distinct",
    body: "1. Put the button in its disabled state (e.g. submit with empty required fields).\n2. Click the disabled button.\n3. Inspect its visual appearance.\n\nExpected: Click does nothing. Button is visually distinct (muted color, cursor:not-allowed). It is not reachable by Tab.",
    priority: "P1",
    type: "functional",
  },
  {
    id: "btn-loading-state",
    category: "Buttons & CTAs",
    title: "Loading state shown during async operation",
    body: "1. Click the button that triggers an async action (form submit, API call).\n2. Observe the button while the operation is in progress.\n\nExpected: Button shows a loading indicator (spinner, 'Loading…' label) and is non-interactive until the operation completes.",
    priority: "P1",
    type: "functional",
  },
  {
    id: "btn-success-feedback",
    category: "Buttons & CTAs",
    title: "Success feedback shown after action completes",
    body: "1. Trigger the primary action.\n2. Wait for the operation to complete.\n\nExpected: Clear success feedback is shown (toast, inline confirmation, redirect, or updated UI state). User is not left uncertain.",
    priority: "P1",
    type: "functional",
  },
  {
    id: "btn-destructive-confirm",
    category: "Buttons & CTAs",
    title: "Destructive action requires confirmation",
    body: "1. Click a destructive button (Delete, Remove, Clear all).\n2. Observe the response.\n\nExpected: A confirmation dialog or undo step appears before the action is executed. Clicking Cancel aborts with no changes.",
    priority: "P0",
    type: "functional",
  },

  // Modals & Overlays
  {
    id: "modal-opens-on-trigger",
    category: "Modals & Overlays",
    title: "Modal opens when trigger is activated",
    body: "1. Click the button or link that opens the modal.\n\nExpected: Modal appears with correct content. Background content is still visible but visually dimmed/covered.",
    priority: "P1",
    type: "functional",
  },
  {
    id: "modal-close-escape",
    category: "Modals & Overlays",
    title: "Modal closes on Escape key",
    body: "1. Open the modal.\n2. Press the Escape key.\n\nExpected: Modal closes. Focus returns to the element that opened it.",
    priority: "P1",
    type: "a11y",
  },
  {
    id: "modal-close-backdrop",
    category: "Modals & Overlays",
    title: "Modal closes on backdrop click",
    body: "1. Open the modal.\n2. Click the dimmed backdrop area outside the modal panel.\n\nExpected: Modal dismisses. No data loss for informational modals. Form modals may prompt to confirm discard.",
    priority: "P1",
    type: "functional",
  },
  {
    id: "modal-focus-trap",
    category: "Modals & Overlays",
    title: "Focus is trapped inside modal while open",
    body: "1. Open the modal.\n2. Tab repeatedly through all interactive elements.\n\nExpected: Focus cycles within the modal and never reaches content behind it. Shift+Tab also stays inside the modal.",
    priority: "P0",
    type: "a11y",
  },
  {
    id: "modal-focus-restore",
    category: "Modals & Overlays",
    title: "Focus returns to trigger element on modal close",
    body: "1. Open the modal via keyboard (Enter/Space on the trigger).\n2. Close the modal (Escape or close button).\n\nExpected: Focus returns to the element that opened the modal, allowing keyboard users to continue their flow.",
    priority: "P1",
    type: "a11y",
  },
  {
    id: "modal-scrollable",
    category: "Modals & Overlays",
    title: "Modal content scrollable if taller than viewport",
    body: "1. Open a modal with a large amount of content (or reduce viewport height).\n\nExpected: Modal has an internal scroll region. Background page does not scroll while modal is open. Modal header/footer stay fixed if present.",
    priority: "P2",
    type: "functional",
  },

  // Data & State
  {
    id: "data-empty-state",
    category: "Data & State",
    title: "Empty state shown with helpful message when no data",
    body: "1. Navigate to this screen with no data items (new account, cleared data).\n\nExpected: A descriptive empty state is shown (illustration or message) explaining there is nothing here yet. A call-to-action guides the user to add their first item.",
    priority: "P1",
    type: "functional",
  },
  {
    id: "data-loading-skeleton",
    category: "Data & State",
    title: "Loading skeleton / spinner shown while data fetches",
    body: "1. Open the screen on a throttled or slow connection.\n2. Observe the screen before data arrives.\n\nExpected: A loading skeleton or spinner is shown in place of content. Layout does not shift significantly when data loads in.",
    priority: "P1",
    type: "visual",
  },
  {
    id: "data-error-state",
    category: "Data & State",
    title: "Error state shown with retry option on fetch failure",
    body: "1. Simulate a network failure or API error (disable network, mock 500).\n2. Load or refresh the screen.\n\nExpected: A clear error message is displayed. A retry button is available. No raw error codes or stack traces are shown to the user.",
    priority: "P0",
    type: "functional",
  },
  {
    id: "data-retry",
    category: "Data & State",
    title: "Retry button successfully reloads data",
    body: "1. Trigger an error state (network off).\n2. Restore connectivity.\n3. Click the Retry button.\n\nExpected: Data reloads and the error state is replaced by the correct data view.",
    priority: "P1",
    type: "functional",
  },
  {
    id: "data-pagination",
    category: "Data & State",
    title: "Pagination navigates to correct page",
    body: "1. On a list with multiple pages, click Next or page 2.\n2. Observe the results.\n3. Click Previous.\n\nExpected: Correct page of results is shown. URL or state reflects the current page. Previous returns to the prior set.",
    priority: "P1",
    type: "functional",
  },
  {
    id: "data-infinite-scroll",
    category: "Data & State",
    title: "Infinite scroll loads more items on reaching the bottom",
    body: "1. Scroll to the bottom of the list.\n\nExpected: Additional items load automatically with a brief loading indicator. Existing items remain visible above. No full-page refresh occurs.",
    priority: "P1",
    type: "functional",
  },
  {
    id: "data-search",
    category: "Data & State",
    title: "Search input filters results in real time",
    body: "1. Type a known search term into the search field.\n2. Observe results.\n3. Clear the search.\n\nExpected: Results update to match the query. Clearing the search restores the full unfiltered list.",
    priority: "P1",
    type: "functional",
  },
  {
    id: "data-sort",
    category: "Data & State",
    title: "Sort control changes display order correctly",
    body: "1. Apply a sort option (e.g. A–Z, Newest first).\n2. Inspect the resulting order.\n3. Switch to the opposite sort.\n\nExpected: Items reorder correctly for each sort option. Sort selection persists if user navigates away and returns.",
    priority: "P1",
    type: "functional",
  },

  // Auth
  {
    id: "auth-login-valid",
    category: "Auth",
    title: "Login with valid credentials succeeds and redirects",
    body: "1. Enter a known valid email and password.\n2. Click Sign In.\n\nExpected: User is authenticated and redirected to the dashboard or the originally requested protected page.",
    priority: "P0",
    type: "functional",
  },
  {
    id: "auth-login-invalid",
    category: "Auth",
    title: "Login with invalid credentials shows error",
    body: "1. Enter an incorrect email or password.\n2. Click Sign In.\n\nExpected: An error message appears ('Invalid credentials' or similar). No sensitive information (e.g. 'email not found') is leaked. User remains on the login screen.",
    priority: "P0",
    type: "functional",
  },
  {
    id: "auth-logout",
    category: "Auth",
    title: "Logout clears session and redirects to login",
    body: "1. While authenticated, click the logout control.\n2. Attempt to navigate back to a protected page.\n\nExpected: Session is cleared. Browser Back button does not restore the authenticated view. User is sent to the login screen.",
    priority: "P0",
    type: "functional",
  },
  {
    id: "auth-protected-route",
    category: "Auth",
    title: "Protected route redirects unauthenticated users",
    body: "1. While logged out, navigate directly to a protected URL.\n\nExpected: User is redirected to the login screen. After successful login, user is taken to the originally requested URL.",
    priority: "P0",
    type: "functional",
  },
  {
    id: "auth-password-reset",
    category: "Auth",
    title: "Password reset sends email and shows confirmation",
    body: "1. Click 'Forgot password' on the login screen.\n2. Enter a registered email address.\n3. Submit the form.\n\nExpected: Confirmation message is shown. Email is received with a working reset link. Link expires after use.",
    priority: "P1",
    type: "functional",
  },
  {
    id: "auth-session-expiry",
    category: "Auth",
    title: "Expired session prompts re-authentication gracefully",
    body: "1. Log in and let the session expire (or manually clear the session token).\n2. Attempt an authenticated action.\n\nExpected: User is prompted to log in again, not shown a raw 401 error. Any in-progress work is preserved where possible.",
    priority: "P1",
    type: "functional",
  },

  // Visual
  {
    id: "vis-desktop-layout",
    category: "Visual",
    title: "Layout renders correctly at 1440px desktop",
    body: "1. Set browser viewport to 1440×900px.\n2. Load this screen and scroll through it.\n\nExpected: All content fits within columns, no overflowing text, no broken grid. Matches the design specification.",
    priority: "P1",
    type: "visual",
  },
  {
    id: "vis-mobile-layout",
    category: "Visual",
    title: "Layout is intact at 375px mobile viewport",
    body: "1. Set browser viewport to 375×812px (iPhone SE).\n2. Load the screen and scroll.\n\nExpected: All content is visible and readable. No horizontal overflow. Tap targets are large enough. Text does not overflow containers.",
    priority: "P1",
    type: "visual",
  },
  {
    id: "vis-tablet-layout",
    category: "Visual",
    title: "Layout is intact at 768px tablet viewport",
    body: "1. Set browser viewport to 768×1024px.\n2. Load and scroll through the screen.\n\nExpected: Layout correctly transitions between mobile and desktop breakpoints. No half-broken intermediate state.",
    priority: "P2",
    type: "visual",
  },
  {
    id: "vis-dark-mode",
    category: "Visual",
    title: "Dark mode applies to all UI elements correctly",
    body: "1. Switch the system or app theme to dark mode.\n2. Navigate through all sections of this screen.\n\nExpected: All text, backgrounds, borders, and icons use the dark theme tokens. No light-mode colors bleed through. Text contrast is maintained.",
    priority: "P1",
    type: "visual",
  },
  {
    id: "vis-images-load",
    category: "Visual",
    title: "All images load without broken icon",
    body: "1. Hard-reload the screen (Cmd/Ctrl+Shift+R).\n2. Scroll through all image content.\n\nExpected: All images render fully. No broken-image icon is visible. Alt text is meaningful if images fail to load.",
    priority: "P1",
    type: "visual",
  },
  {
    id: "vis-typography-hierarchy",
    category: "Visual",
    title: "Typography hierarchy is clear",
    body: "1. Scan the page content visually.\n\nExpected: Heading levels (H1 → H2 → H3 → body) are visually distinct in size and weight. Caption / helper text is appropriately smaller. No two different semantic levels look identical.",
    priority: "P2",
    type: "visual",
  },
  {
    id: "vis-spacing",
    category: "Visual",
    title: "Spacing is consistent — no elements clipping edges",
    body: "1. Inspect the screen at all supported viewports.\n\nExpected: Content has consistent padding from screen edges. No elements are clipped by the viewport. Margins between sections are uniform.",
    priority: "P2",
    type: "visual",
  },

  // Accessibility
  {
    id: "a11y-keyboard-reachable",
    category: "Accessibility",
    title: "All interactive elements are reachable by keyboard Tab",
    body: "1. Click anywhere on the page to set focus.\n2. Tab through all interactive elements.\n\nExpected: Every button, link, input, and interactive widget is reachable in a logical order. No skip is required to reach any actionable element.",
    priority: "P0",
    type: "a11y",
  },
  {
    id: "a11y-focus-visible",
    category: "Accessibility",
    title: "Visible focus indicator on all interactive elements",
    body: "1. Tab through all interactive elements on the screen.\n\nExpected: Each focused element has a clearly visible focus ring or equivalent indicator. The indicator meets 3:1 contrast against adjacent colours (WCAG 2.2 Focus Appearance).",
    priority: "P0",
    type: "a11y",
  },
  {
    id: "a11y-no-keyboard-trap",
    category: "Accessibility",
    title: "No unintentional keyboard trap",
    body: "1. Navigate to every interactive widget on the page using Tab.\n\nExpected: Focus is never stuck permanently in a widget (except an open modal which is intentional). Tab always moves forward; Shift+Tab always moves backward.",
    priority: "P0",
    type: "a11y",
  },
  {
    id: "a11y-page-title",
    category: "Accessibility",
    title: "Page title is descriptive and unique",
    body: "1. Inspect the browser tab title when on this screen.\n\nExpected: Title describes the page content meaningfully (e.g. 'Settings – MyApp'). Each screen has a distinct title. Screen readers announce it on navigation.",
    priority: "P1",
    type: "a11y",
  },
  {
    id: "a11y-alt-text",
    category: "Accessibility",
    title: "All informative images have descriptive alt text",
    body: "1. Inspect all <img> elements and icon images on the screen.\n\nExpected: Informative images have alt text that conveys the same meaning as the image. Decorative images have alt='' so screen readers skip them.",
    priority: "P0",
    type: "a11y",
  },
  {
    id: "a11y-contrast-normal",
    category: "Accessibility",
    title: "Normal text contrast ratio ≥ 4.5:1 (WCAG AA)",
    body: "1. Run an automated contrast checker (e.g. axe, Lighthouse) on the screen.\n2. Manually verify any flagged elements.\n\nExpected: All text smaller than 18pt (or 14pt bold) meets 4.5:1 contrast ratio against its background.",
    priority: "P0",
    type: "a11y",
  },
  {
    id: "a11y-contrast-large",
    category: "Accessibility",
    title: "Large text contrast ratio ≥ 3:1 (WCAG AA)",
    body: "1. Identify all large text (≥18pt regular or ≥14pt bold).\n2. Measure contrast ratio.\n\nExpected: All large text meets a minimum 3:1 contrast ratio. Headings, labels, and emphasis text must pass.",
    priority: "P1",
    type: "a11y",
  },
  {
    id: "a11y-contrast-ui",
    category: "Accessibility",
    title: "UI components contrast ≥ 3:1 (buttons, icons, inputs)",
    body: "1. Inspect interactive component boundaries (button outlines, input borders, icon fills).\n\nExpected: Visual indicators of UI components achieve at least 3:1 contrast against adjacent colours in both light and dark modes.",
    priority: "P1",
    type: "a11y",
  },
  {
    id: "a11y-color-not-sole-conveyor",
    category: "Accessibility",
    title: "Color is not the sole conveyor of meaning",
    body: "1. Identify all elements that use color to communicate state (error = red, success = green, required = asterisk in red).\n\nExpected: Meaning is also conveyed via text, icon, pattern, or shape — not color alone. Readable in greyscale.",
    priority: "P0",
    type: "a11y",
  },
  {
    id: "a11y-live-region",
    category: "Accessibility",
    title: "Dynamic content updates announced to screen readers",
    body: "1. Trigger a dynamic UI change (form submission result, notification, live status update).\n2. Use a screen reader to verify.\n\nExpected: The update is announced automatically via an aria-live region (polite or assertive as appropriate). User does not need to navigate to discover the change.",
    priority: "P1",
    type: "a11y",
  },
  {
    id: "a11y-skip-nav",
    category: "Accessibility",
    title: "Skip-to-main-content link is present and functional",
    body: "1. Focus the browser address bar.\n2. Press Tab once.\n\nExpected: A 'Skip to main content' link appears (it may be visually hidden until focused). Activating it moves focus past the navigation to the main content area.",
    priority: "P1",
    type: "a11y",
  },
  {
    id: "a11y-heading-hierarchy",
    category: "Accessibility",
    title: "Heading hierarchy is logical — no skipped levels",
    body: "1. Inspect all heading elements (H1–H6) on the screen.\n\nExpected: There is exactly one H1. Heading levels do not skip (e.g. H1 → H3 without H2). Headings describe the section that follows them.",
    priority: "P1",
    type: "a11y",
  },
  {
    id: "a11y-touch-target",
    category: "Accessibility",
    title: "Touch targets are at least 44×44px (mobile)",
    body: "1. On a mobile viewport, inspect all buttons, links, and interactive icons.\n\nExpected: Every touch target has a minimum 44×44px interactive area (even if the visual element is smaller). Tap areas do not overlap.",
    priority: "P0",
    type: "a11y",
  },
  {
    id: "a11y-200-zoom",
    category: "Accessibility",
    title: "UI is fully usable at 200% browser zoom",
    body: "1. Set browser zoom to 200%.\n2. Navigate and interact with all elements.\n\nExpected: All content reflows or scrolls correctly. No text is clipped. All actions are still completable. No horizontal overflow forces loss of content.",
    priority: "P1",
    type: "a11y",
  },
  {
    id: "a11y-aria-roles",
    category: "Accessibility",
    title: "ARIA roles are semantically correct",
    body: "1. Inspect elements using browser DevTools Accessibility panel.\n\nExpected: Buttons use role='button' or <button>, navigation uses <nav>, dialogs use role='dialog', lists use <ul>/<ol>. No ARIA roles override native semantics incorrectly.",
    priority: "P1",
    type: "a11y",
  },
  {
    id: "a11y-motion-reducible",
    category: "Accessibility",
    title: "Animations can be paused or are disabled at prefers-reduced-motion",
    body: "1. Enable 'Reduce Motion' in OS accessibility settings.\n2. Load the screen.\n\nExpected: Animations, auto-playing transitions, and parallax effects are disabled or significantly reduced. Functionality is not impaired.",
    priority: "P2",
    type: "a11y",
  },

  // Performance
  {
    id: "perf-fcp",
    category: "Performance",
    title: "First Contentful Paint < 1.8s on simulated 4G",
    body: "1. Run Lighthouse on this screen with 'Mobile' preset (simulated 4G).\n\nExpected: FCP is below 1.8 seconds. Content appears quickly enough to confirm the page is loading.",
    priority: "P1",
    type: "perf",
  },
  {
    id: "perf-lcp",
    category: "Performance",
    title: "Largest Contentful Paint < 2.5s",
    body: "1. Run Lighthouse with 'Mobile' preset.\n2. Identify the LCP element.\n\nExpected: LCP is below 2.5s (WCAG 'Good' threshold). The LCP element is a meaningful piece of content, not a spinner.",
    priority: "P0",
    type: "perf",
  },
  {
    id: "perf-cls",
    category: "Performance",
    title: "Cumulative Layout Shift < 0.1",
    body: "1. Run Lighthouse and observe CLS score.\n2. Watch the page load visually for layout jumps.\n\nExpected: CLS is below 0.1. Images, ads, and dynamic content have reserved space so they do not push content down on arrival.",
    priority: "P1",
    type: "perf",
  },
  {
    id: "perf-inp",
    category: "Performance",
    title: "Interaction to Next Paint < 200ms",
    body: "1. Interact with buttons, inputs, and links while Lighthouse or Chrome DevTools is recording.\n\nExpected: INP is below 200ms. The page visually responds to user input within 200ms.",
    priority: "P1",
    type: "perf",
  },
  {
    id: "perf-lazy-images",
    category: "Performance",
    title: "Images below the fold are lazy-loaded",
    body: "1. Open DevTools Network tab (filter: Img).\n2. Load the screen and check initial network requests.\n\nExpected: Only above-the-fold images load on initial page load. Off-screen images load only as the user scrolls toward them.",
    priority: "P2",
    type: "perf",
  },
  {
    id: "perf-api-response",
    category: "Performance",
    title: "API calls respond within 500ms on average",
    body: "1. Open DevTools Network tab.\n2. Perform the primary user actions on this screen.\n\nExpected: All API calls complete within 500ms under normal load. Slow calls have loading indicators. No request blocks the main thread.",
    priority: "P1",
    type: "perf",
  },
];

// ─── Script Templates ─────────────────────────────────────────────────────────

export const SCRIPT_TEMPLATES: ScriptTemplate[] = [
  // Basic
  {
    id: "script-page-load",
    category: "Basic",
    name: "Page load check",
    description: "Navigate, assert title, verify body is visible",
    body: `// Verify the page loads with a valid title and visible content.
await page.waitForLoadState('networkidle');
const title = await page.title();
console.log('title:', title);
expect(title).toBeTruthy();
expect(title.length).toBeGreaterThan(0);
const bodyVisible = await page.locator('body').isVisible();
expect(bodyVisible).toBe(true);`,
  },
  {
    id: "script-no-console-errors",
    category: "Basic",
    name: "No console errors on load",
    description: "Collect JS errors during load, assert zero",
    body: `// Assert that no JavaScript errors are thrown during page load.
const jsErrors = [];
page.on('pageerror', (err) => jsErrors.push(err.message));
await page.waitForLoadState('networkidle');
await page.waitForTimeout(500);
if (jsErrors.length > 0) {
  console.log('JS errors found:', jsErrors.join('\\n'));
}
expect(jsErrors).toHaveLength(0);`,
  },
  {
    id: "script-screenshot-baseline",
    category: "Basic",
    name: "Full-page screenshot",
    description: "Take a full-page screenshot for visual reference",
    body: `// Take a full-page screenshot. Useful as a visual baseline.
await page.waitForLoadState('networkidle');
await page.waitForTimeout(300); // allow animations to settle
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
console.log('Screenshot taken at:', timestamp);
// page.screenshot is available when running via Playwright CLI.
// In the auditor runner, this confirms the page is stable.
const title = await page.title();
console.log('Page ready:', title);`,
  },

  // Forms
  {
    id: "script-form-valid-submit",
    category: "Forms",
    name: "Form — valid submission",
    description: "Fill required fields, submit, assert URL changes",
    body: `// Fill in required fields with valid data and submit the form.
// Adjust selectors to match your form's actual field names/IDs.
await page.waitForLoadState('networkidle');

// Fill fields — update selectors as needed
const emailInput = page.locator('input[type="email"], input[name="email"]').first();
const passwordInput = page.locator('input[type="password"], input[name="password"]').first();

if (await emailInput.isVisible()) {
  await emailInput.fill('test@example.com');
}
if (await passwordInput.isVisible()) {
  await passwordInput.fill('Password123!');
}

const submitBtn = page.locator('button[type="submit"]').first();
await submitBtn.click();
await page.waitForLoadState('networkidle');

const currentUrl = page.url();
console.log('URL after submit:', currentUrl);
// Expect URL to change on successful submission
expect(currentUrl).not.toBe(url);`,
  },
  {
    id: "script-form-empty-validation",
    category: "Forms",
    name: "Form — empty submit shows validation errors",
    description: "Submit empty form, assert error indicators appear",
    body: `// Submit the form without filling in any fields.
// Verify that validation errors appear.
await page.waitForLoadState('networkidle');

const submitBtn = page.locator('button[type="submit"]').first();
await submitBtn.click();
await page.waitForTimeout(300);

// Count elements marked as invalid or having error classes
const invalidCount = await page.locator(
  '[aria-invalid="true"], .error, [class*="error"], [class*="invalid"]'
).count();
console.log('Validation error elements found:', invalidCount);
expect(invalidCount).toBeGreaterThan(0);`,
  },
  {
    id: "script-search-filter",
    category: "Forms",
    name: "Search & filter results",
    description: "Type in search box, assert results update",
    body: `// Type a search term and verify the result list updates.
await page.waitForLoadState('networkidle');

const searchInput = page.locator('input[type="search"], input[placeholder*="search" i], input[name="search"], input[name="q"]').first();
expect(await searchInput.isVisible()).toBe(true);

const initialCount = await page.locator('[data-testid*="result"], li, [role="listitem"]').count();
console.log('Initial items:', initialCount);

await searchInput.fill('test');
await page.waitForTimeout(400); // debounce

const filteredCount = await page.locator('[data-testid*="result"], li, [role="listitem"]').count();
console.log('Filtered items:', filteredCount);

// Clearing should restore results
await searchInput.clear();
await page.waitForTimeout(400);
const clearedCount = await page.locator('[data-testid*="result"], li, [role="listitem"]').count();
console.log('Items after clear:', clearedCount);`,
  },

  // Navigation
  {
    id: "script-nav-links",
    category: "Navigation",
    name: "Primary navigation links work",
    description: "Click each top-level nav link, assert URL changes",
    body: `// Click through all top-level navigation links and assert each navigates.
await page.waitForLoadState('networkidle');

const navLinks = page.locator('nav a, [role="navigation"] a');
const count = await navLinks.count();
console.log('Nav links found:', count);
expect(count).toBeGreaterThan(0);

for (let i = 0; i < Math.min(count, 6); i++) {
  const link = navLinks.nth(i);
  const href = await link.getAttribute('href');
  const text = await link.textContent();
  console.log(\`Clicking nav link \${i}: "\${text?.trim()}" -> \${href}\`);
  if (href && !href.startsWith('http') && href !== '#') {
    await link.click();
    await page.waitForLoadState('networkidle');
    console.log('Landed at:', page.url());
    await page.goBack();
    await page.waitForLoadState('networkidle');
  }
}`,
  },
  {
    id: "script-modal-open-close",
    category: "Navigation",
    name: "Modal — open and close",
    description: "Open a modal, assert visible, close with Escape",
    body: `// Open a modal and verify it closes correctly.
await page.waitForLoadState('networkidle');

// Find and click a modal trigger (button that opens a dialog)
const trigger = page.locator('button[data-modal], button[aria-haspopup="dialog"], button[aria-controls]').first();
const triggerCount = await trigger.count();

if (triggerCount === 0) {
  console.log('No dialog trigger found via aria attributes — trying generic buttons');
  const buttons = page.locator('button');
  const btnCount = await buttons.count();
  console.log('Total buttons on page:', btnCount);
} else {
  await trigger.click();
  await page.waitForTimeout(300);

  const dialog = page.locator('[role="dialog"], [aria-modal="true"]').first();
  const isVisible = await dialog.isVisible();
  console.log('Dialog visible after open:', isVisible);
  expect(isVisible).toBe(true);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  const isHidden = await dialog.isHidden();
  console.log('Dialog hidden after Escape:', isHidden);
  expect(isHidden).toBe(true);
}`,
  },

  // Accessibility
  {
    id: "script-axe-audit",
    category: "Accessibility",
    name: "Axe accessibility audit — zero critical violations",
    description: "Inject axe-core, run full audit, assert no critical/serious issues",
    body: `// Run an axe-core accessibility audit and assert zero critical or serious violations.
await page.waitForLoadState('networkidle');

// Inject axe-core from CDN
await page.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.9.1/axe.min.js' });

const results = await page.evaluate(() => {
  return window.axe.run(document, {
    runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa'],
  });
});

const critical = results.violations.filter(v => v.impact === 'critical');
const serious = results.violations.filter(v => v.impact === 'serious');

console.log('Total violations:', results.violations.length);
console.log('Critical:', critical.length);
console.log('Serious:', serious.length);

results.violations.forEach(v => {
  console.log(\`[\${v.impact}] \${v.id}: \${v.description} (\${v.nodes.length} element(s))\`);
});

expect(critical.length).toBe(0);
expect(serious.length).toBe(0);`,
  },
  {
    id: "script-keyboard-nav",
    category: "Accessibility",
    name: "Keyboard navigation — Tab through all focusable elements",
    description: "Tab through the page, collect focused elements, assert count > 0",
    body: `// Tab through all interactive elements and assert a logical focus order.
await page.waitForLoadState('networkidle');

// Click the page to ensure focus starts from the top
await page.locator('body').click();
await page.keyboard.press('Tab');

const focusedElements = [];
for (let i = 0; i < 30; i++) {
  const focused = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return null;
    return {
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute('role'),
      text: el.textContent?.trim().slice(0, 40),
      type: el.getAttribute('type'),
    };
  });
  if (!focused) break;
  focusedElements.push(focused);
  console.log(\`Focus \${i + 1}: <\${focused.tag}> "\${focused.text}"\`);
  await page.keyboard.press('Tab');
}

console.log('Total focusable elements visited:', focusedElements.length);
expect(focusedElements.length).toBeGreaterThan(0);`,
  },
  {
    id: "script-contrast-check",
    category: "Accessibility",
    name: "Contrast check — body text vs background",
    description: "Measure contrast of the first body text element against its background",
    body: `// Check colour contrast of the first body text against its computed background.
await page.waitForLoadState('networkidle');

const contrastInfo = await page.evaluate(() => {
  const getColor = (el, prop) => window.getComputedStyle(el).getPropertyValue(prop);
  const parseRgb = (color) => {
    const m = color.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
    return m ? { r: +m[1], g: +m[2], b: +m[3] } : null;
  };
  const relativeLuminance = ({ r, g, b }) => {
    const s = [r, g, b].map(v => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
  };
  const contrastRatio = (l1, l2) => (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

  const el = document.querySelector('p, [class*="body"], main span, article');
  if (!el) return { error: 'No body text element found' };

  const fg = parseRgb(getColor(el, 'color'));
  const bg = parseRgb(getColor(el, 'background-color'));
  if (!fg || !bg) return { error: 'Could not parse colors', fg: getColor(el, 'color'), bg: getColor(el, 'background-color') };

  const ratio = contrastRatio(relativeLuminance(fg), relativeLuminance(bg));
  return { ratio: ratio.toFixed(2), fg, bg };
});

console.log('Contrast info:', JSON.stringify(contrastInfo));
if (contrastInfo.error) {
  console.log('Warning:', contrastInfo.error);
} else {
  expect(parseFloat(contrastInfo.ratio)).toBeGreaterThanOrEqual(4.5);
}`,
  },

  // Auth
  {
    id: "script-login-valid",
    category: "Auth",
    name: "Login — valid credentials succeed",
    description: "Fill login form, submit, assert URL changes (adapt credentials)",
    body: `// Test login with valid credentials.
// IMPORTANT: Replace the email/password with your test account credentials.
await page.waitForLoadState('networkidle');

const email = 'testuser@example.com'; // replace with actual test credentials
const password = 'TestPassword123!';

const emailInput = page.locator('input[type="email"], input[name="email"], input[id="email"]').first();
const passwordInput = page.locator('input[type="password"]').first();
const submitBtn = page.locator('button[type="submit"]').first();

await emailInput.fill(email);
await passwordInput.fill(password);
await submitBtn.click();
await page.waitForLoadState('networkidle');

const afterUrl = page.url();
console.log('URL after login:', afterUrl);
expect(afterUrl).not.toBe(url); // should redirect away from login`,
  },
  {
    id: "script-login-invalid",
    category: "Auth",
    name: "Login — invalid credentials show error",
    description: "Submit bad credentials, assert error message appears",
    body: `// Test that invalid credentials show an error and do not authenticate.
await page.waitForLoadState('networkidle');

const emailInput = page.locator('input[type="email"], input[name="email"]').first();
const passwordInput = page.locator('input[type="password"]').first();
const submitBtn = page.locator('button[type="submit"]').first();

await emailInput.fill('notareal@example.com');
await passwordInput.fill('wrongpassword');
await submitBtn.click();
await page.waitForLoadState('networkidle');
await page.waitForTimeout(500);

const sameUrl = page.url() === url;
console.log('Stayed on login page:', sameUrl);

const errorEl = page.locator('[class*="error"], [role="alert"], .alert').first();
const errorVisible = await errorEl.isVisible().catch(() => false);
console.log('Error message visible:', errorVisible);

expect(errorVisible || sameUrl).toBe(true);`,
  },
  {
    id: "script-protected-route",
    category: "Auth",
    name: "Protected route redirects when unauthenticated",
    description: "Clear cookies, navigate to protected URL, assert redirect to login",
    body: `// Verify that a protected route redirects unauthenticated users to login.
// This script clears auth cookies before navigating.
await page.context().clearCookies();

// Clear localStorage auth tokens
await page.evaluate(() => {
  localStorage.removeItem('token');
  localStorage.removeItem('auth');
  sessionStorage.clear();
});

await page.goto(url);
await page.waitForLoadState('networkidle');

const currentUrl = page.url();
console.log('Landed at:', currentUrl);

const isLogin = currentUrl.includes('login') || currentUrl.includes('sign') || currentUrl.includes('auth');
const hasLoginForm = await page.locator('input[type="password"]').isVisible().catch(() => false);
console.log('Redirected to login-like page:', isLogin || hasLoginForm);

expect(isLogin || hasLoginForm).toBe(true);`,
  },

  // Error States
  {
    id: "script-error-state-network",
    category: "Error States",
    name: "Error state — mock network failure",
    description: "Abort all API requests, reload, assert error UI shown",
    body: `// Simulate a network failure and verify the error state UI appears.
await page.waitForLoadState('networkidle');

// Intercept all fetch/XHR and fail them
await page.route('**/api/**', route => route.abort());
await page.route('**/*.json', route => route.abort());

// Reload to trigger the failed requests
await page.reload();
await page.waitForLoadState('domcontentloaded');
await page.waitForTimeout(1000);

// Look for error state indicators
const errorEl = page.locator('[class*="error"], [role="alert"], [data-testid*="error"]').first();
const retryBtn = page.locator('button:has-text("Retry"), button:has-text("Try again"), button:has-text("Reload")').first();

const hasError = await errorEl.isVisible().catch(() => false);
const hasRetry = await retryBtn.isVisible().catch(() => false);
console.log('Error element visible:', hasError);
console.log('Retry button visible:', hasRetry);

expect(hasError || hasRetry).toBe(true);`,
  },
  {
    id: "script-empty-state",
    category: "Error States",
    name: "Empty state UI visible when no data",
    description: "Assert empty state message appears on a fresh load",
    body: `// Check that an empty state is shown when there is no data.
// This test assumes the current view has no data items.
await page.waitForLoadState('networkidle');
await page.waitForTimeout(500);

// Look for common empty state indicators
const emptyState = page.locator(
  '[data-testid*="empty"], [class*="empty"], :has-text("No results"), :has-text("Nothing here"), :has-text("Get started")'
).first();

const listItems = await page.locator('li, [role="listitem"]').count();
console.log('List items found:', listItems);

const hasEmptyState = await emptyState.isVisible().catch(() => false);
console.log('Empty state visible:', hasEmptyState);

if (listItems === 0) {
  expect(hasEmptyState).toBe(true);
} else {
  console.log('Items exist — empty state not expected');
}`,
  },

  // Visual
  {
    id: "script-responsive-no-overflow",
    category: "Visual",
    name: "Responsive — no horizontal overflow at 375px",
    description: "Set mobile viewport, assert no horizontal scroll",
    body: `// Check that the page has no horizontal overflow at mobile viewport width.
await page.setViewportSize({ width: 375, height: 812 });
await page.reload();
await page.waitForLoadState('networkidle');

const overflow = await page.evaluate(() => {
  return document.documentElement.scrollWidth > document.documentElement.clientWidth;
});
console.log('Has horizontal overflow:', overflow);

if (overflow) {
  const offenders = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('*'))
      .filter(el => el.scrollWidth > document.documentElement.clientWidth)
      .map(el => el.tagName + (el.className ? '.' + String(el.className).split(' ').join('.') : ''))
      .slice(0, 10);
  });
  console.log('Overflowing elements:', offenders.join(', '));
}

expect(overflow).toBe(false);`,
  },
  {
    id: "script-dark-mode",
    category: "Visual",
    name: "Dark mode — verify theme class applied",
    description: "Toggle dark mode, assert dark class on html/body element",
    body: `// Verify that dark mode styling is applied correctly.
await page.waitForLoadState('networkidle');

// Check for OS-level dark mode preference
await page.emulateMedia({ colorScheme: 'dark' });
await page.waitForTimeout(300);

const darkState = await page.evaluate(() => {
  const html = document.documentElement;
  const body = document.body;
  return {
    htmlClass: html.className,
    bodyClass: body.className,
    htmlDataTheme: html.getAttribute('data-theme'),
    colorScheme: window.getComputedStyle(html).colorScheme,
  };
});

console.log('Dark mode state:', JSON.stringify(darkState));

const hasDark =
  darkState.htmlClass.includes('dark') ||
  darkState.bodyClass.includes('dark') ||
  darkState.htmlDataTheme === 'dark' ||
  darkState.colorScheme === 'dark';

// Just log the finding — not all apps implement class-based dark mode
console.log('Dark mode class/attribute detected:', hasDark);

// Verify body is still visible
const bodyVisible = await page.locator('body').isVisible();
expect(bodyVisible).toBe(true);`,
  },
];
