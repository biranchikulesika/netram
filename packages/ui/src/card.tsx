import React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ style, children, ...props }) => {
  return (
    <div
      style={{
        backgroundColor: "var(--color-bg-surface, #ffffff)",
        border: "1px solid var(--color-border-subtle, #e2e8f0)",
        borderRadius: "6px",
        boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.05)",
        overflow: "hidden",
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  style,
  children,
  ...props
}) => {
  return (
    <div
      style={{
        padding: "16px 20px",
        borderBottom: "1px solid var(--color-border-subtle, #e2e8f0)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  style,
  children,
  ...props
}) => {
  return (
    <h3
      style={{
        margin: 0,
        fontSize: "16px",
        fontWeight: 700,
        color: "var(--color-text-primary, #0c2a52)",
        letterSpacing: "-0.01em",
        ...style,
      }}
      {...props}
    >
      {children}
    </h3>
  );
};

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  style,
  children,
  ...props
}) => {
  return (
    <div
      style={{
        padding: "20px",
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  style,
  children,
  ...props
}) => {
  return (
    <div
      style={{
        padding: "12px 20px",
        backgroundColor: "var(--color-bg-subtle, #f3f6fb)",
        borderTop: "1px solid var(--color-border-subtle, #e2e8f0)",
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: "12px",
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
};
