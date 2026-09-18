import React from "react";

export interface StatusTagProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "rust" | "green" | "navy" | "neutral" | "error";
  size?: "sm" | "md";
  children: React.ReactNode;
}

const variantStyles: Record<NonNullable<StatusTagProps["variant"]>, React.CSSProperties> = {
  rust: {
    backgroundColor: "#fff7ed",
    color: "var(--color-tag-rust, #c2410c)",
    border: "1px solid #ffedd5",
  },
  green: {
    backgroundColor: "#f0fdf4",
    color: "var(--color-action-green, #15803d)",
    border: "1px solid #dcfce7",
  },
  navy: {
    backgroundColor: "#eff6ff",
    color: "var(--color-navy-dark, #002449)",
    border: "1px solid #dbeafe",
  },
  neutral: {
    backgroundColor: "var(--color-bg-subtle, #f3f6fb)",
    color: "var(--color-text-muted, #475569)",
    border: "1px solid var(--color-border-subtle, #e2e8f0)",
  },
  error: {
    backgroundColor: "#fef2f2",
    color: "var(--color-error, #dc2626)",
    border: "1px solid #fee2e2",
  },
};

export const StatusTag: React.FC<StatusTagProps> = ({
  variant = "neutral",
  size = "md",
  style,
  children,
  ...props
}) => {
  const isSm = size === "sm";
  const baseStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    fontWeight: 600,
    fontSize: isSm ? "11px" : "12px",
    padding: isSm ? "2px 6px" : "3px 8px",
    borderRadius: "4px",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    lineHeight: 1.2,
    ...variantStyles[variant],
    ...style,
  };

  return (
    <span style={baseStyle} {...props}>
      {children}
    </span>
  );
};
