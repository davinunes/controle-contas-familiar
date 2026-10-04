/**
 * Utilitários para formatação e manipulação de valores monetários no padrão Real (BRL).
 */

/**
 * Aplica máscara de moeda a uma string ou número.
 * Ao digitar dígitos, insere a vírgula dos centavos (ex: "9980" -> "99,80", "123456" -> "1.234,56").
 */
export function maskCurrency(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";

  const str = String(value);
  const digits = str.replace(/\D/g, "").slice(0, 12);
  if (!digits) return "";

  const num = parseInt(digits, 10);
  if (num === 0) return "0,00";

  return (num / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Converte valor numérico decimal (ex: 99.8 ou "99.80" vindo da API/banco) para a string formatada pt-BR "99,80".
 */
export function formatCurrencyFromNumber(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === "") return "";
  const n = typeof val === "number" ? val : parseFloat(String(val));
  if (isNaN(n)) return "";
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Converte a string monetária mascarada ("99,80" ou "1.234,56") de volta para float (99.8 ou 1234.56).
 */
export function parseCurrency(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return isNaN(value) ? null : value;

  const digits = String(value).replace(/\D/g, "");
  if (!digits) return null;

  return parseInt(digits, 10) / 100;
}
