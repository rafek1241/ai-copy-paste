# HTML/Tailwind CSS Style Guide

This document defines the coding standards for HTML and CSS within this project, with a strict focus on **Tailwind CSS v4**.

## 1. General Rules
- **Protocol:** Use HTTPS for all embedded resources.
- **Indentation:** Indent by 2 spaces. Do not use tabs.
- **Capitalization:** Use only lowercase for all element names and attributes.
- **Encoding:** Use UTF-8 (without a BOM).

## 2. HTML Style Rules
- **Semantics:** Use HTML elements according to their intended purpose (e.g., `<button>` for actions, `<a>` for links).
- **Accessibility:** 
  - Provide `alt` text for images.
  - Use `aria-*` attributes only when semantic HTML is insufficient.
  - Ensure interactive elements are keyboard accessible.
- **Separation of Concerns:** Avoid inline `style="..."` attributes. Use Tailwind utility classes.

## 3. Tailwind CSS (v4) Rules

### Core Principles
- **Utility-First:** Use utility classes directly in HTML. Avoid creating custom CSS classes unless absolutely necessary for complex animations or reusable components that cannot be handled by React/Component logic.
- **Mobile-First:** Style for mobile screens first, then use `sm:`, `md:`, `lg:`, `xl:` prefixes for larger screens.
  - **Bad:** `<div class="w-1/2 sm:w-full">` (Desktop first mental model)
  - **Good:** `<div class="w-full sm:w-1/2">` (Mobile first)

### Configuration (v4)
- **CSS-First Configuration:** Use the CSS file for theme configuration using the `@theme` directive, rather than a JS config file.
- **Imports:** Use the new import syntax: `@import "tailwindcss";`

### Class Ordering & Formatting
- **Ordering:** Follow the recommended logical order (Layout -> Box Model -> Typography -> Visuals -> Misc).
  - *Recommendation:* Use `prettier-plugin-tailwindcss` to enforce this automatically.
- **Arbitrary Values:** Use arbitrary values `[...]` sparingly. If a value is used more than twice, define it as a CSS variable or theme extension.

### Best Practices
- **No `@apply`:** Avoid using `@apply` in CSS files. It breaks the utility-first workflow and increases bundle size.
- **Spacing:** Use standard Tailwind spacing scale (`p-4`, `m-2`) instead of hardcoded pixels (`p-[16px]`).
- **Colors:** Use semantic color names from the palette (e.g., `text-primary`, `bg-destructive`) rather than raw hex values if defined, or standard Tailwind colors (`text-red-500`) if not.
- **Variables:** Leverage CSS variables for dynamic values, compatible with Tailwind v4's native variable support.

## 4. CSS Files
- **Structure:** Keep custom CSS to a minimum.
- **Directives:** Use standard CSS syntax. Tailwind v4 parses standard CSS.

**BE CONSISTENT.** Match the existing style and prefer standard utilities over custom CSS.