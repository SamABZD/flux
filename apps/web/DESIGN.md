# Design system

The interface uses a graphite base with mint accents. Most surfaces remain dark gray, white, and neutral gray; mint is reserved for primary actions, focus, and selection.

## Tokens

| Role             | Value     |
| ---------------- | --------- |
| Background       | `#0b0d10` |
| Surface          | `#15181d` |
| Elevated surface | `#1e2228` |
| Divider          | `#2a3038` |
| Primary text     | `#f5f7fa` |
| Secondary text   | `#9aa3ae` |
| Accent           | `#5ef2b0` |
| Success          | `#39d98a` |
| Error            | `#ff6262` |
| Warning          | `#f6c453` |
| Information      | `#63a7ff` |

Geist Variable is self-hosted. Financial values use tabular numerals. Spacing follows a 4, 8, 12, 16, 24, 32, 48, and 64 pixel scale. Controls use a 10 pixel radius, panels 12 pixels, and dialogs 20 pixels.

## Layout

Desktop uses a compact primary navigation and a secondary workspace row. Mobile uses a bottom navigation with an additional-pages sheet. Tables, cards, filters, and dialogs reflow without horizontal scrolling.

The login page is independent of the application shell. The application shell owns global navigation, search, profile controls, notifications, route loading, and error recovery.

## Components

| Family    | Components                                         |
| --------- | -------------------------------------------------- |
| Actions   | Button, icon button                                |
| Fields    | Input, password input, search, select, money input |
| Selection | Tabs, toggle                                       |
| Identity  | Badge, avatar                                      |
| Overlays  | Modal, bottom sheet, confirmation dialog           |
| Feedback  | Toast, tooltip, skeleton, empty state, error state |
| Structure | Page header, section header                        |

Interactive components expose visible focus, meaningful labels, pending and disabled states, and focus restoration. Feedback includes text and icons in addition to color.

## Financial surfaces

Account and transaction pages favor readable lists over dense dashboards. Analytics uses one highlighted series and a table for exact values. Card artwork is code-drawn and always displays masked credentials. Budget progress and subscription schedules use text labels alongside visual indicators.

`/design-system` provides an in-application component gallery. Storybook uses the same examples for isolated review.
