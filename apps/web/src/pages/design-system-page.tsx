import { PageHeader, SectionHeader } from '@/design-system/headers';
import { Badge } from '@/design-system/badge';
import {
  ActionExamples,
  FieldExamples,
  SelectionExamples,
  OverlayExamples,
  FeedbackExamples,
} from '@/design-system/examples';

const swatches = [
  ['Background', 'background', '#0b0d10'],
  ['Surface', 'surface', '#15181d'],
  ['Elevated', 'elevated', '#1e2228'],
  ['Primary text', 'text', '#f5f7fa'],
  ['Secondary text', 'muted', '#9aa3ae'],
  ['Mint green', 'accent', '#5ef2b0'],
];
export function DesignSystemPage() {
  return (
    <>
      <PageHeader
        title="Considered, down to the details."
        description="The visual foundation of Flux. A working reference for the components and their states."
        actions={<Badge>Design system · 1.0</Badge>}
      />
      <section className="gallery-section">
        <SectionHeader
          title="Graphite + Mint Green"
          description="Quiet surfaces. Clear hierarchy. A purposeful signal."
        />
        <div className="token-swatches">
          {swatches.map(([name, token, hex]) => (
            <div className="token-swatch" key={token}>
              <span style={{ background: `var(--color-${token})` }} />
              <strong>{name}</strong>
              {hex}
            </div>
          ))}
        </div>
      </section>
      <section className="gallery-section">
        <SectionHeader
          title="Actions"
          description="One clear primary action, with quieter supporting controls. Tab through to inspect focus."
        />
        <ActionExamples />
      </section>
      <section className="gallery-section">
        <SectionHeader
          title="Inputs"
          description="Labels stay visible. Errors explain the next step. Financial values use tabular numerals."
        />
        <FieldExamples />
      </section>
      <section className="gallery-section">
        <SectionHeader
          title="Selection & identity"
          description="Use arrow keys between tabs and Space to change a switch."
        />
        <SelectionExamples />
      </section>
      <section className="gallery-section">
        <SectionHeader
          title="Overlays & feedback"
          description="Focus stays contained and returns on close. Escape dismisses dialogs; confirmations start on Cancel."
        />
        <OverlayExamples />
      </section>
      <section className="gallery-section">
        <SectionHeader
          title="Between states"
          description="Loading, empty, and error states keep the interface understandable."
        />
        <FeedbackExamples />
      </section>
    </>
  );
}
