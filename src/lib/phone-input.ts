/**
 * Confere um WhatsApp digitado e devolve o número no formato que a clínica usa
 * (DDD + número, sem o DDI 55). `error` sai preenchido com a mensagem que deve
 * aparecer embaixo do campo.
 *
 * Fica no bundle do cliente: não importa nada de servidor.
 */
export function checkPhone(raw: string, emptyMessage: string) {
  const digits = raw.replace(/\D/g, "").replace(/^0+/, "");
  if (!digits) return { value: "", error: emptyMessage };

  // Muita gente cola o número do WhatsApp com o código do país (55).
  const national =
    digits.length > 11 && digits.startsWith("55") ? digits.slice(2) : digits;

  if (national.length < 10) {
    return {
      value: "",
      error: "Número incompleto. Inclua o DDD (ex.: 31 99999-9999).",
    };
  }
  if (national.length > 11) {
    return {
      value: "",
      error: "Número inválido. Use DDD + número, com 10 ou 11 dígitos.",
    };
  }
  return { value: national, error: "" };
}
