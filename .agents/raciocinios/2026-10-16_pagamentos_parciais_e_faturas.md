# Raciocínio: Suporte a Pagamentos Parciais e Faturas de Cartão

**Data:** 16/10/2026  
**Contexto:** O usuário levantou a necessidade de registrar compras detalhadas sem perder as anotações individuais quando houver amortização parcial ou fatura consolidada (ex: R$ 1.500 em compras com R$ 400 pagos e R$ 1.100 pendentes).

## Análise de Requisitos e Cenários
1. **Problema do modelo atual:**
   - O modelo `expense_occurrences` possui apenas `status` ("pending" ou "paid") e `paid_at`.
   - Se uma conta for paga parcialmente, hoje o usuário ou altera o valor original (perdendo a referência de quanto era a compra), ou não consegue marcar nada como pago.
2. **Solução Arquitetural Unificada:**
   - **Camada de Liquidação (Universal):** Criar `occurrence_payments`. Isso resolve de imediato pagamentos parciais para QUALQUER conta do sistema (aluguel, conta de luz, compras avulsas, etc.).
   - **Camada de Agrupamento (Faturas):** Permitir que uma conta seja do tipo `credit_card`. A ocorrência da fatura do mês passa a ser dona de uma coleção de itens (`invoice_items` / compras detalhadas). Cada compra mantém descrição, data, categoria e pessoa responsável.
   - **Sinergia:** O valor da fatura é a soma de suas compras. Ao pagar parcialmente a fatura (ex: pagando R$ 400), o sistema usa o mesmo motor de amortização (`occurrence_payments`).
3. **Decisão:**
   - Estrutura não destrutiva, 100% compatível com as despesas e ocorrências existentes no banco de dados.
