"use client";
import React from "react";
import { maskCurrency } from "@/lib/money";

interface MoneyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: string;
  onChange: (value: string) => void;
  showPrefix?: boolean;
}

export default function MoneyInput({
  value,
  onChange,
  showPrefix = true,
  placeholder = "0,00",
  className = "",
  style = {},
  ...props
}: MoneyInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = maskCurrency(e.target.value);
    onChange(masked);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" || e.key === "Delete") {
      const digits = String(value || "").replace(/\D/g, "");
      if (digits === "" || parseInt(digits, 10) === 0) {
        onChange("");
        e.preventDefault();
      }
    }
  };

  if (!showPrefix) {
    return (
      <input
        type="text"
        inputMode="numeric"
        className={`form-input ${className}`}
        style={style}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        {...props}
      />
    );
  }

  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center", width: "100%" }}>
      <span
        style={{
          position: "absolute",
          left: "12px",
          color: "var(--text-muted)",
          fontSize: "0.85rem",
          fontWeight: 600,
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        R$
      </span>
      <input
        type="text"
        inputMode="numeric"
        className={`form-input ${className}`}
        style={{ paddingLeft: "38px", ...style }}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        {...props}
      />
    </div>
  );
}
