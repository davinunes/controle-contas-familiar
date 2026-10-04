# Plano de Implementação: Máscara Monetária Automática e Cadastro com Valor em Despesa Avulsa

**Data:** 04/10/2026  
**Status:** Concluído  

---

## 1. Objetivos
1. Disponibilizar campos de valor e vencimento no cadastro de despesas avulsas (`single`).
2. Persistir e gerar a ocorrência inicial da despesa avulsa já com o valor preenchido e data correspondente no backend.
3. Criar utilitários e componente de input com máscara monetária dinâmica (estilo ATM/centavos), formatando automaticamente à medida que os dígitos são inseridos (ex: `9980` -> `99,80`).
4. Aplicar o novo componente em todos os pontos de entrada de valores:
   - Nova Despesa (Avulsa, Parcelada e Recorrente)
   - Detalhe e Edição de Despesa
   - Edição de Valor da Ocorrência

---

## 2. Arquivos Envolvidos
- `frontend/src/lib/money.ts` (Criado)
- `frontend/src/components/MoneyInput.tsx` (Criado)
- `frontend/src/app/(dashboard)/despesas/nova/page.tsx` (Modificado)
- `frontend/src/app/(dashboard)/despesas/[id]/page.tsx` (Modificado)
- `frontend/src/app/(dashboard)/despesas/[id]/[occurrenceId]/page.tsx` (Modificado)
- `backend/app/routers/expenses.py` (Modificado)

---

## 3. Etapas Executadas
1. **Utilitário de Moeda:** Implementação de `maskCurrency`, `formatCurrencyFromNumber` e `parseCurrency`.
2. **Componente Reutilizável:** Criação de `MoneyInput` com prefixo `R$` e comportamento de centavos automáticos.
3. **Nova Despesa Avulsa:**
   - Adicionados campos de Valor e Data de Vencimento para `type === "single"`.
   - Adotado `MoneyInput` em Parcelada e Recorrente.
   - Envio dos campos no payload.
4. **Backend:**
   - Em `create_expense`, despesas do tipo `single` criam a ocorrência com `value = expense.recurring_value or 0`.
   - Se informada data, gera a ocorrência com a data de vencimento e mês de referência da data.
   - Em `update_expense`, despesas do tipo `single` atualizam a ocorrência pendente correspondente.
5. **Detalhe e Ocorrência:**
   - Substituição dos inputs numéricos nativos por `MoneyInput` na edição de despesas e ocorrências.
