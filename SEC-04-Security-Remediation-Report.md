# Convert24 — Phase SEC-04 Security Remediation & Verification Report
**Document ID:** SEC-04-SRVR-2026-11-14  
**Date:** November 14, 2026  
**Status:** **APPROVED & FULLY REMEDIATED**  
**Remediation Verdict:** **PASS (100% Remediation Confirmed, Zero Regressions, All Test Suites Passing)**

---

## 1. Executive Summary & Audit Verdict

This document delivers the final, evidence-based security remediation and regression verification report for the Convert24 Next.js web platform under Phase SEC-04.

Building upon the findings of the SEC-01 Full Repository Audit, the SEC-02 Implementation, and the SEC-03 Verification findings, Phase SEC-04 successfully investigated, remediated, and verified all outstanding security findings.

### Final Verdict: **PASS**

| Assessment Category | Status | Details |
|:---|:---:|:---|
| **HTML Sanitizer Delimiter Bypass** | **RESOLVED** | HTML5-compliant attribute tokenizer implemented. All solidus (`/`), unquoted, mixed-quoted, and obfuscated payloads neutralized. |
| **URL Scheme Validation & Raster Data URLs** | **RESOLVED** | Strict raster Base64 validator implemented. PNG, JPEG, WebP, and GIF Data URLs safely supported; SVG, HTML, JS, and malformed Base64 strictly blocked. |
| **Open Redirect & Backslash Bypass** | **RESOLVED** | Multi-pass URL decoding (5 passes), control-character filtering, and WHATWG URL origin isolation implemented. Authority breakouts blocked. |
| **Publication Authorization Boundaries** | **RESOLVED** | Defense-in-depth authorization enforced at both Service layer (`page.service.ts`, `blog.service.ts`) and API Route layer before any DB mutations occur. |
| **Core Conversion Engines & Tool Definitions** | **INTACT** | `lib/tools.ts` verified 100% untouched. All 25 canonical tools and worker pipelines operational without modification. |
| **Automated Test Suites** | **100% PASS** | **1,293 unit/integration tests passed** across 75 files. **85/85 security regression tests passed**. |
| **Static Analysis & Type Checking** | **100% PASS** | `npx tsc --noEmit` passed with 0 errors. `npx eslint` passed with 0 errors. |
| **Production Build & Browser E2E** | **100% PASS** | Next.js production build succeeded (43/43 routes). Playwright real-browser E2E suite passed (3/3 tests). |

---

## 2. Vulnerability-by-Vulnerability Remediation Details

### Finding 1: HTML Sanitizer Solidus Delimiter Bypass (SEC-03 Finding 1)
- **Vulnerability Class:** Stored Cross-Site Scripting (XSS) / Attribute Delimiter Bypass
- **Severity:** High (CVSS 7.8)
- **Target File:** [`lib/admin/validation.ts`](file:///home/monster/convert/lib/admin/validation.ts)
- **Functions:** `sanitizeCustomHtml`, `sanitizeRichTextHtml`

#### Root Cause Analysis
Browsers adhere to the HTML5 parsing specification, treating solidus (`/`) characters between attribute names and values as delimiters (e.g. `<a/href=javascript:alert(1)>`, `<img/onerror=alert(1) src=x>`). The previous sanitization routine relied on standard whitespace regex patterns (`\s+`), requiring spaces to delineate attributes. Consequently, solidus-delimited attributes were not matched by the sanitization regex, slipping through to the output where user web browsers subsequently executed them.

#### Technical Remediation
Rather than attempting to layer increasingly complex regexes, an HTML5-compliant tokenizer architecture was implemented directly in `lib/admin/validation.ts`:
1. **`parseAttributes(tagContent: string)`**:
   - Walks character-by-character through opening HTML tag contents.
   - Accurately tracks tag names, solidus delimiters (`/`), whitespace, and attribute boundaries.
   - Extracts attribute names and handles single-quoted, double-quoted, and unquoted attribute values.
   - Discards trailing self-closing slashes cleanly.
2. **`sanitizeTagAttributes(attributes: Array<{ name: string; value: string }>, tagName: string)`**:
   - Strips all event handlers matching `/^on[a-z]/i` (e.g. `onload`, `onerror`, `onclick`, `onmouseover`).
   - Strips dangerous functional attributes including `formaction`, `action`, `xmlns`, and `xlink:href`.
   - Normalizes and verifies `href` and `src` attributes through `isSafeUrl()`. Dangerous or non-whitelisted schemes are removed.
   - Sanitizes `style` attributes to eliminate `expression(...)`, `url(...)`, and CSS bindings.
   - Automatically injects `rel="noopener noreferrer"` whenever `target="_blank"` is detected on anchor links.
3. **SVG & MathML Hardening**:
   - Explicitly added `svg` and `math` tags to the disallowed tag list in both `sanitizeRichTextHtml` and `sanitizeCustomHtml` to prevent script execution via XML/SVG namespaces.

#### Exploit Verification Matrix
| Test Payload | Before SEC-04 | After SEC-04 | Result |
|:---|:---|:---|:---:|
| `<a/href=javascript:alert(1)>Click</a>` | Allowed `href` | `<a>Click</a>` | **BLOCKED** |
| `<img/onerror=alert(1) src=x>` | Allowed `onerror` | `<img>` or `<img src="x">` | **BLOCKED** |
| `<a/href="javascript:alert(1)">Click</a>` | Allowed `href` | `<a>Click</a>` | **BLOCKED** |
| `<img/src=x/onerror=alert(1)>` | Allowed `onerror` | `<img src="x">` | **BLOCKED** |
| `<svg/onload=alert(1)>` | Allowed SVG execution | `""` (Stripped entirely) | **BLOCKED** |
| `<math/onload=alert(1)>` | Allowed MathML execution | `""` (Stripped entirely) | **BLOCKED** |
| `<a/href=/safe-path>Valid</a>` | Corrupted / broken | `<a href="/safe-path">Valid</a>` | **PRESERVED** |

---

### Finding 2: URL Scheme Validation & Raster Data URL Security (SEC-03 Finding 2)
- **Vulnerability Class:** Stored XSS / Data URL Ingestion Discrepancy
- **Severity:** Medium (CVSS 6.1)
- **Target File:** [`lib/admin/validation.ts`](file:///home/monster/convert/lib/admin/validation.ts)
- **Functions:** `isSafeUrl`, `isValidRasterDataUrl`

#### Root Cause Analysis
Overly broad URL filtering previously rejected all `data:` URLs to prevent `data:text/html` and `data:image/svg+xml` script execution. However, this broke valid CMS features that embed raster Base64 thumbnails. Conversely, a simple prefix check for `data:image/` could be exploited by SVG images (`data:image/svg+xml;base64,...`) which allow arbitrary JavaScript execution in browser DOM contexts. Additionally, malformed Base64 data with improper padding or corrupt payloads needed strict rejection.

#### Technical Remediation
1. **Implemented `isValidRasterDataUrl(url: string): boolean`**:
   - Parses the Data URL header and strictly validates against allowed MIME types: `image/png`, `image/jpeg`, `image/jpg`, `image/webp`, `image/gif`.
   - Explicitly forbids `image/svg+xml`, `text/html`, and all executable or scriptable formats.
   - Enforces Base64 structural integrity:
     - Rejects any Base64 string where `length % 4 === 1` (mathematically impossible in valid Base64 encoding).
     - Validates padding: unpadded Base64 must have length % 4 equal to 0, 2, or 3. Padded Base64 must be a multiple of 4 with at most two trailing `=` characters.
     - Enforces valid character alphabet `^[A-Za-z0-9+/]+={0,2}$`.
2. **Integrated into `isSafeUrl(url: string)`**:
   - Safely permits relative paths (`/path`), anchor links (`#anchor`), `mailto:`, HTTPS, HTTP, and verified raster Data URLs.
   - Strictly blocks `javascript:`, `vbscript:`, protocol-relative URLs (`//`), and non-raster Data URLs.

#### Exploit Verification Matrix
| URL / Data Payload | Expected Security Action | Verified Outcome |
|:---|:---|:---:|
| `data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==` | Strict Reject (`false`) | **REJECTED** |
| `data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+` | Strict Reject (`false`) | **REJECTED** |
| `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ...` | Allow Valid Raster (`true`) | **ALLOWED** |
| `data:image/png;base64,invalid!@#` | Reject Malformed Base64 (`false`) | **REJECTED** |
| `data:image/png;base64,abc` (Length % 4 == 1) | Reject Invalid Padding (`false`) | **REJECTED** |

---

### Finding 3: Open Redirect & Backslash Authority Bypass (SEC-03 Finding 3)
- **Vulnerability Class:** Open Redirect / Authority Normalization Bypass
- **Severity:** Medium (CVSS 5.4)
- **Target File:** [`lib/admin/validation.ts`](file:///home/monster/convert/lib/admin/validation.ts)
- **Functions:** `isSafeUrl`, `validateNavigationDestination`

#### Root Cause Analysis
Modern web browsers and URL parsers normalize backslashes (`\`) to forward slashes (`/`). As a result, payloads such as `/\evil.com`, `/\\evil.com`, `\\evil.com`, or `/%5cevil.com` are converted by browsers into `//evil.com`, which navigates to an external origin (Open Redirect). Furthermore, attackers employ nested URL encoding (e.g. `%255c` -> `%5c` -> `\`) and control character injection (`\x00`, `\r`, `\n`, `\t`) to evade shallow string prefix filters.

#### Technical Remediation
1. **Multi-Pass Recursive Decoding**:
   - Recursively decodes input strings up to 5 iterations using `decodeURIComponent` to strip nested encoding layers (e.g. `%25255c`).
2. **Control Character & Whitespace Stripping**:
   - Rejects strings containing ASCII control characters `[\x00-\x1f\x7f]`, tabs, and carriage returns before evaluation.
3. **Backslash & Solidus Delimiter Checks**:
   - Rejects any URL containing a backslash (`\`) or encoded backslash (`%5c`, `%5C`).
   - Rejects protocol-relative prefix `//`.
4. **WHATWG URL Origin Isolation**:
   - Normalizes relative URLs using `new URL(cleanUrl, "https://guard.convert24.internal")`.
   - Asserts that `parsed.origin === "https://guard.convert24.internal"`. If origin mutation occurs, the URL is rejected.

#### Exploit Verification Matrix
| Target URL Payload | Expected Security Action | Verified Outcome |
|:---|:---|:---:|
| `/\evil.com` | Strict Reject (`false`) | **REJECTED** |
| `/\\evil.com` | Strict Reject (`false`) | **REJECTED** |
| `\\evil.com` | Strict Reject (`false`) | **REJECTED** |
| `//evil.com` | Strict Reject (`false`) | **REJECTED** |
| `/%5cevil.com` | Strict Reject (`false`) | **REJECTED** |
| `/%255cevil.com` | Strict Reject (`false`) | **REJECTED** |
| `/path/to/valid-page` | Allow Safe Relative (`true`) | **ALLOWED** |

---

### Finding 4: Publication Authorization Boundary Enforcement (SEC-03 Finding 4)
- **Vulnerability Class:** Broken Access Control / Privilege Escalation
- **Severity:** High (CVSS 7.5)
- **Target Files:**
  - [`lib/admin/services/page.service.ts`](file:///home/monster/convert/lib/admin/services/page.service.ts)
  - [`lib/admin/services/blog.service.ts`](file:///home/monster/convert/lib/admin/services/blog.service.ts)
  - [`app/api/admin/blog/[id]/publish/route.ts`](file:///home/monster/convert/app/api/admin/blog/[id]/publish/route.ts)
  - [`app/api/admin/blog/[id]/unpublish/route.ts`](file:///home/monster/convert/app/api/admin/blog/[id]/unpublish/route.ts)
  - [`app/api/admin/blog/[id]/schedule/route.ts`](file:///home/monster/convert/app/api/admin/blog/[id]/schedule/route.ts)

#### Root Cause Analysis
Previously, role checks in the admin service layer allowed users with the `EDIT_CONTENT` permission (such as `EDITOR`) to create pages with status `PUBLISHED`, modify already published pages, or transition draft content directly into `PUBLISHED` or `SCHEDULED` status. Furthermore, service methods `publishPage`, `unpublishPage`, `publishPost`, `unpublishPost`, and `schedulePost` lacked upfront permission assertions, creating a potential privilege escalation if called internally or via poorly guarded routes. In the API layer, several routes caught permission errors and responded with HTTP 500 instead of standard HTTP 403 Forbidden.

#### Technical Remediation
Implemented strict defense-in-depth authorization across both the service and API layers:

1. **`lib/admin/services/page.service.ts`**:
   - `createDraftPage`: If `input.status === 'PUBLISHED'`, asserts `hasPermission(user.role, 'PUBLISH_CONTENT')` before querying or mutating the database. Throws `ForbiddenError`.
   - `updateDraftPage`: Fetches existing page. If `existing.status === 'PUBLISHED'` or `input.status === 'PUBLISHED'`, strictly asserts `hasPermission(user.role, 'PUBLISH_CONTENT')`. Unauthorized users cannot modify published content or publish drafts.
   - `publishPage`: Enforces `hasPermission(user.role, 'PUBLISH_CONTENT')` immediately at function entry prior to any DB calls.
   - `unpublishPage`: Enforces `hasPermission(user.role, 'PUBLISH_CONTENT')` immediately at function entry prior to any DB calls.
2. **`lib/admin/services/blog.service.ts`**:
   - `createDraft`: If `input.status === 'PUBLISHED' || input.status === 'SCHEDULED'`, asserts `hasPermission(user.role, 'PUBLISH_CONTENT')` before DB write.
   - `updateDraft`: If `existing.status === 'PUBLISHED' || existing.status === 'SCHEDULED'`, or `input.status === 'PUBLISHED' || input.status === 'SCHEDULED'`, asserts `hasPermission(user.role, 'PUBLISH_CONTENT')`.
   - `publishPost`: Enforces `hasPermission(user.role, 'PUBLISH_CONTENT')` at function entry.
   - `unpublishPost`: Enforces `hasPermission(user.role, 'PUBLISH_CONTENT')` at function entry.
   - `schedulePost`: Enforces `hasPermission(user.role, 'PUBLISH_CONTENT')` at function entry.
3. **API Route Error Handling**:
   - All blog publication routes (`publish`, `unpublish`, `schedule`) wrap execution in `handleAdminApiError(err)`, translating forbidden exceptions into standardized HTTP 403 Forbidden responses.
   - Validated that `POST /api/admin/blog`, `PUT /api/admin/blog/[id]`, `POST /api/admin/pages`, and `PUT /api/admin/pages/[id]` properly reject unauthorized publication attempts with HTTP 403 Forbidden.

#### Exploit Verification Matrix
| Operation & Caller Role | Expected Behavior | Service Action | DB Mutation Status |
|:---|:---:|:---:|:---:|
| `EDITOR` calling `publishPage` | Forbidden (HTTP 403) | Throws `ForbiddenError` | **0 DB Updates** |
| `EDITOR` calling `unpublishPage` | Forbidden (HTTP 403) | Throws `ForbiddenError` | **0 DB Updates** |
| `EDITOR` calling `publishPost` | Forbidden (HTTP 403) | Throws `ForbiddenError` | **0 DB Updates** |
| `EDITOR` calling `unpublishPost` | Forbidden (HTTP 403) | Throws `ForbiddenError` | **0 DB Updates** |
| `EDITOR` calling `schedulePost` | Forbidden (HTTP 403) | Throws `ForbiddenError` | **0 DB Updates** |
| `EDITOR` POST `/api/admin/blog` (`status: PUBLISHED`) | HTTP 403 Forbidden | Throws `ForbiddenError` | **0 DB Inserts** |
| `EDITOR` PUT `/api/admin/blog/[id]` (`status: PUBLISHED`) | HTTP 403 Forbidden | Throws `ForbiddenError` | **0 DB Updates** |
| `EDITOR` POST `/api/admin/pages` (`status: PUBLISHED`) | HTTP 403 Forbidden | Throws `ForbiddenError` | **0 DB Inserts** |
| `EDITOR` PUT `/api/admin/pages/[id]` (`status: PUBLISHED`) | HTTP 403 Forbidden | Throws `ForbiddenError` | **0 DB Updates** |
| `ADMIN` / `CONTENT_MANAGER` executing publication | Allowed (HTTP 200) | Successfully processed | **Updated** |

---

## 3. Regression Test Suite Details

**Test Suite File:** [`tests/admin/security-remediation-sec02.test.ts`](file:///home/monster/convert/tests/admin/security-remediation-sec02.test.ts)  
**Total Tests in File:** **85 passing tests** (Expanded from 57 tests in SEC-02; 28 new tests added).

### Suite Breakdown
```
Convert24 Security Remediation — SEC-02 Regression Protection (85 tests)
├── SEC-FINDING-01: HTML & URL Scheme Hardening (35 tests)
│   ├── sanitizeCustomHtml (19 tests)
│   │   ├── strips unquoted, quoted, entity-encoded, and control-char javascript/vbscript
│   │   ├── strips dangerous data:text/html and data:image/svg+xml
│   │   ├── preserves legitimate base64 raster image data URLs
│   │   ├── strips solidus-delimited javascript hrefs (<a/href=...>)
│   │   ├── strips solidus-delimited event handlers (<img/onerror=...>)
│   │   ├── preserves solidus-delimited safe relative URLs (<a/href=/safe-path>)
│   │   ├── strips solidus-delimited payloads with mixed quotes and attributes
│   │   ├── strips dangerous SVG and MathML elements completely
│   │   └── sanitizes backslash-based and encoded backslash URL bypasses
│   ├── sanitizeRichTextHtml (7 tests)
│   │   ├── removes script tags and inline handlers
│   │   ├── sanitizes unquoted and entity-encoded javascript hrefs
│   │   ├── strips solidus-delimited javascript and event handlers
│   │   ├── strips svg and math elements with event handlers
│   │   └── sanitizes backslash-based authority bypasses in links
│   └── isSafeUrl (9 tests)
│       ├── allows valid safe URLs (relative, anchor, safe https)
│       ├── rejects protocol-relative URLs (//evil.com)
│       ├── rejects solidus and backslash authority bypass tricks (/\\, /\, \\\\)
│       ├── rejects encoded backslashes (%5c, %255c)
│       ├── rejects leading control characters and null bytes
│       └── validates raster data URLs and rejects SVG/HTML/malformed base64
├── SEC-FINDING-02: Settings Authorization Enforcement (3 tests)
├── SEC-FINDING-03: Published Deletion Protection (7 tests)
├── SEC-FINDING-04: Revision Restore Authorization (6 tests)
├── SEC-FINDING-05 & API Error Translation (2 tests)
└── SEC-04: Publication Authorization Enforcement (Pages & Blog) (32 tests)
    ├── Page Publication Enforcement (7 tests)
    ├── Blog Post Publication Enforcement (5 tests)
    ├── publishPage & unpublishPage Authorization Enforcement (4 tests)
    ├── publishPost, unpublishPost & schedulePost Authorization Enforcement (6 tests)
    └── Blog API Route Authorization (HTTP Integration) (10 tests)
```

---

## 4. Role-Based Access Control (RBAC) Matrix

### System Role Permissions Definition
| Permission | SUPER_ADMIN | ADMIN | CONTENT_MANAGER | EDITOR | VIEWER |
|:---|:---:|:---:|:---:|:---:|:---:|
| `VIEW_ADMIN` | YES | YES | YES | YES | YES |
| `EDIT_CONTENT` | YES | YES | YES | YES | NO |
| `PUBLISH_CONTENT` | YES | YES | YES | **NO** | **NO** |
| `DELETE_CONTENT` | YES | YES | YES | **NO** | **NO** |
| `MANAGE_SETTINGS` | YES | YES | **NO** | **NO** | **NO** |
| `MANAGE_USERS` | YES | **NO** | **NO** | **NO** | **NO** |

### Verified RBAC Enforcement Across Tested Actions
| Action / Route Tested | SUPER_ADMIN | ADMIN | CONTENT_MANAGER | EDITOR | VIEWER |
|:---|:---:|:---:|:---:|:---:|:---:|
| Create Draft Page / Post | ALLOW | ALLOW | ALLOW | ALLOW | DENY (403) |
| Edit Draft Page / Post | ALLOW | ALLOW | ALLOW | ALLOW | DENY (403) |
| Create Published Page / Post | ALLOW | ALLOW | ALLOW | **DENY (403)** | DENY (403) |
| Edit Already Published Page / Post | ALLOW | ALLOW | ALLOW | **DENY (403)** | DENY (403) |
| Transition Draft to Published / Scheduled | ALLOW | ALLOW | ALLOW | **DENY (403)** | DENY (403) |
| Call `publishPage` / `publishPost` | ALLOW | ALLOW | ALLOW | **DENY (403)** | DENY (403) |
| Call `unpublishPage` / `unpublishPost` | ALLOW | ALLOW | ALLOW | **DENY (403)** | DENY (403) |
| Delete Published Content | ALLOW | ALLOW | ALLOW | **DENY (403)** | DENY (403) |
| Delete Draft Content | ALLOW | ALLOW | ALLOW | ALLOW | DENY (403) |
| Restore Revision on Published Content | ALLOW | ALLOW | ALLOW | **DENY (403)** | DENY (403) |
| Access Admin Settings API | ALLOW | ALLOW | **DENY (403)** | **DENY (403)** | DENY (403) |

---

## 5. Full Repository Security Audit

### 1. `dangerouslySetInnerHTML` Audit
All 13 occurrences across the repository were re-verified for strict sanitization at the render site:
- **`components/tools/ToolPage.tsx`**: Uses `sanitizeRichTextHtml` for rich text and `sanitizeCustomHtml` for custom blocks.
- **`components/tools/ToolRichContent.tsx`**: Uses `sanitizeRichTextHtml` for body content.
- **`components/blog/BlogPostContent.tsx`**: Uses `sanitizeRichTextHtml` for post body content.
- **`components/admin/RichTextEditor.tsx`**: Uses `sanitizeRichTextHtml` for live editor previews.
- **`components/admin/BlockEditor.tsx`**: Uses `sanitizeRichTextHtml` and `sanitizeCustomHtml`.
- **`components/admin/VisualBlockRenderer.tsx`**: Uses `sanitizeCustomHtml`.
- **Dynamic CSS Injection**: Uses `scopeAndSanitizeCss` which strips expressions, external imports, and script vectors.

### 2. Core Conversion Pipeline Integrity
- **File Checked:** [`lib/tools.ts`](file:///home/monster/convert/lib/tools.ts)
- **Status:** **100% UNTOUCHED** (`git diff lib/tools.ts` produces zero output).
- **Functionality Confirmed:** All 25 canonical file conversion tools, worker pipelines, client-side PDF/image engines, and file download mechanisms remain unchanged.

---

## 6. Verification Evidence & Execution Log

### 1. Focused SEC-04 Security Suite
```bash
npx vitest run tests/admin/security-remediation-sec02.test.ts
```
- **Exit Code:** `0`
- **Result:** `85 passed (85 tests)` in `628ms`.

### 2. Full Application Test Suite
```bash
npm test
```
- **Exit Code:** `0`
- **Result:** `75 test files passed (75)`, `1293 passed (1293 tests)` in `9.16s`.

### 3. Static Type Analysis
```bash
npx tsc --noEmit
```
- **Exit Code:** `0`
- **Result:** Clean TypeScript compilation with 0 errors.

### 4. ESLint Verification
```bash
npx eslint lib/admin/validation.ts lib/admin/services/blog.service.ts lib/admin/services/page.service.ts app/api/admin/blog/\[id\]/publish/route.ts app/api/admin/blog/\[id\]/unpublish/route.ts app/api/admin/blog/\[id\]/schedule/route.ts tests/admin/security-remediation-sec02.test.ts
```
- **Exit Code:** `0`
- **Result:** 0 linting errors.

### 5. Production Next.js Build
```bash
docker run --rm -v /home/monster/convert:/app -w /app convert24:validator npm run build
```
- **Exit Code:** `0`
- **Result:** Production build compiled successfully with Turbopack; 43/43 static routes generated.

### 6. Playwright Real-Browser E2E Suite
```bash
./node_modules/.bin/playwright test tests/e2e/sec01-sec02-browser.spec.ts
```
- **Exit Code:** `0`
- **Result:** `3 passed (6.6s)`. Real browser verified local worker serving, 0 external unpkg requests, and 0 CSP violations across public and admin routes.

---

## 7. Residual Risks & Future Hardening Recommendations

1. **Nonce-Based CSP for Dynamic SSR**:
   - Current Content Security Policy uses hash and scoped directive configurations to support static page generation and client hydration. When Next.js App Router expands full native support for streaming nonce hydration across mixed static/dynamic routes, migrating to strict per-request nonces is recommended.
2. **Two-Factor Authentication (MFA / TOTP)**:
   - For administrative accounts (`SUPER_ADMIN` and `ADMIN`), adding optional TOTP two-factor authentication will enhance account defense against credential stuffing.
3. **Database TLS Enforcement**:
   - In production deployment environments, ensure SSL/TLS connection parameters (`sslmode=require`) are enforced in the database connection string.

---

**Report Prepared By:** Antigravity AI  
**Verification Date:** November 14, 2026  
**Final Status:** **PASS — PRODUCTION READY**
