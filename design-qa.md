# Design QA — Documentation source links

- Source visual truth path: `/var/folders/xp/g2mvtxmj7b71nzh9d8pfmp_c0000gn/T/codex-clipboard-24b80baf-c40a-4b0c-b659-452f7cd652f1.png`
- Implementation screenshot path: `/Users/merill/github/microsoftx/design-qa-source-links.jpg`
- Focused implementation path: `/Users/merill/github/microsoftx/design-qa-source-links-focus.png`
- Side-by-side comparison path: `/Users/merill/github/microsoftx/design-qa-source-links-comparison.png`
- Desktop viewport: 1280 × 720 CSS pixels, device scale factor 1
- Source pixels: 320 × 320
- Implementation pixels: 1280 × 720
- Focused comparison pixels: two normalized 320 × 320 panels in one 660 × 320 image
- State: loaded Entra diff, light theme, documentation source links visible
- Additional state: 390 × 844 responsive viewport

## Full-view comparison evidence

The full implementation screenshot shows the source actions aligned at the upper-right of the article result header. The actions remain secondary to the article title while being immediately readable as links. The implementation contains exactly the two requested destinations: Microsoft Learn and GitHub. The History row shown in the visual reference is intentionally omitted because file-history navigation was previously removed from this area.

## Focused region evidence

The source and focused implementation are placed together in `design-qa-source-links-comparison.png`. Both use a compact vertical icon-and-label list with left-aligned icons, consistent label starts, generous whitespace, and no enclosing button border. The implementation now uses the official four-color Microsoft symbol shown in the reference together with the GitHub Octicon.

## Required fidelity surfaces

- Fonts and typography: Segoe UI/system typography matches the existing Microsoft Learn-familiar site. Labels use 1.05rem semibold text and remain readable without competing with the article title.
- Spacing and layout rhythm: the 200px desktop source list uses 44px rows, 24px icons, and a 0.75rem icon-label gap. At 390px it moves beneath the title as a 220px vertical list with no overflow.
- Colors and visual tokens: links inherit the established text color and Fluent hover surface. The locally vendored monochrome icons invert in dark mode.
- Image quality and asset fidelity: the Microsoft symbol is the official downloadable SVG from Microsoft Learn and the GitHub mark is the official Octicon. Both render sharply at 24px and loaded successfully in the browser. No custom SVG approximation or CSS drawing is used.
- Copy and content: the visible labels are exactly “Microsoft Learn” and “GitHub”; both links retain their correct dynamic destinations, accessible names, new-tab behavior, and safe `rel` attributes.

## Comparison history

1. The first implementation matched the requested vertical structure but used a narrower 180px list and smaller labels. The list was increased to 200px, rows to 44px, labels to 1.05rem, and icons to 24px.
2. The user requested the Microsoft logo specifically. The Fluent book icon was replaced with Microsoft's official four-color symbol and exempted from the dark-theme monochrome filter so its brand colors remain unchanged.
3. The revised desktop capture matches the reference's icon-and-label treatment. The 390 × 844 verification showed a stacked result header, a 220px source list, loaded icons, and zero horizontal overflow.
4. No actionable P0, P1, or P2 issues remain.

## Findings

No actionable P0, P1, or P2 findings remain. The Microsoft Learn row now uses the requested Microsoft symbol. The omitted History action remains intentional and follows the earlier product decision.

## Implementation checklist

- [x] Visible Microsoft Learn and GitHub labels
- [x] Compact vertical icon-and-label layout
- [x] Real locally vendored icon assets and licenses
- [x] Correct external destinations and accessibility labels
- [x] Light and dark theme support
- [x] Responsive mobile layout without horizontal overflow
- [x] Automated build and test suite

final result: passed
