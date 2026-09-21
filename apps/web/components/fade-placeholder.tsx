/**
 * Animated placeholder overlay. Render inside a `reg-fade-wrap` wrapper and
 * keep the input's native `placeholder` transparent (styled globally) so the
 * two don't overlap.
 */
export function FadePlaceholder({
  ph,
  className = "",
}: {
  ph: { text: string; visible: boolean };
  className?: string;
}) {
  return (
    <span
      className={`fade-placeholder ${ph.visible ? "fade-placeholder-in" : "fade-placeholder-out"} ${className}`.trim()}
      aria-hidden="true"
    >
      {ph.text}
    </span>
  );
}
