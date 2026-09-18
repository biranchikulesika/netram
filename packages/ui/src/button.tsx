import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

const variantStyles: Record<NonNullable<ButtonProps["variant"]>, React.CSSProperties> = {
  primary: {
    backgroundColor: "var(--color-action-green, #15803d)",
    color: "#ffffff",
    border: "1px solid #0e7a34",
  },
  secondary: {
    backgroundColor: "#ffffff",
    color: "var(--color-text-primary, #0c2a52)",
    border: "1px solid var(--color-border-strong, #cbd5e1)",
  },
  danger: {
    backgroundColor: "var(--color-error, #dc2626)",
    color: "#ffffff",
    border: "1px solid #b91c1c",
  },
  ghost: {
    backgroundColor: "transparent",
    color: "var(--color-text-primary, #0c2a52)",
    border: "1px solid transparent",
  },
};

const sizeStyles: Record<NonNullable<ButtonProps["size"]>, React.CSSProperties> = {
  sm: {
    padding: "4px 10px",
    fontSize: "12px",
    fontWeight: 600,
    borderRadius: "4px",
  },
  md: {
    padding: "8px 16px",
    fontSize: "14px",
    fontWeight: 600,
    borderRadius: "6px",
  },
  lg: {
    padding: "12px 24px",
    fontSize: "16px",
    fontWeight: 600,
    borderRadius: "6px",
  },
};

export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  size = "md",
  style,
  children,
  disabled,
  ...props
}) => {
  const baseStyle: React.CSSProperties = {
    fontFamily: "inherit",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
    transition: "background-color 150ms ease, border-color 150ms ease",
    lineHeight: 1.5,
    outline: "none",
    ...sizeStyles[size],
    ...variantStyles[variant],
    ...style,
  };

  return (
    <button style={baseStyle} disabled={disabled} {...props}>
      {children}
    </button>
  );
};
