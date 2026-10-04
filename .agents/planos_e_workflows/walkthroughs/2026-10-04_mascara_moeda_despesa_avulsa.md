# Walkthrough: Máscara Monetária Automática e Cadastro com Valor em Despesas Avulsas

**Data:** 04/10/2026  
**Status:** Implementado e Verificado  

---

## Modificações Efetuadas

### 1. Novo Utilitário e Componente de Moeda
- [`frontend/src/lib/money.ts`](file:///e:/DEV/controle-contas-familiar/frontend/src/lib/money.ts):
  - `maskCurrency(val)`: Converte números digitados dividindo por 100 para aplicar vírgula nos centavos (ex: `9980` vira `99,80`).
  - `formatCurrencyFromNumber(val)`: Converte floats/strings vindos do backend para o formato pt-BR (`"99,80"`).
  - `parseCurrency(val)`: Converte `"99,80"` de volta para `99.8` ao enviar para a API.
- [`frontend/src/components/MoneyInput.tsx`](file:///e:/DEV/controle-contas-familiar/frontend/src/components/MoneyInput.tsx):
  - Componente com input numérico mascarado em tempo real, prefixo fixo `R$`, e tratamento seguro para limpeza ao pressionar Backspace.

### 2. Cadastro de Nova Despesa Avulsa
- [`frontend/src/app/(dashboard)/despesas/nova/page.tsx`](file:///e:/DEV/controle-contas-familiar/frontend/src/app/%28dashboard%29/despesas/nova/page.tsx):
  - Adicionado campo **Valor (R$)** e **Data de Vencimento** (com default preenchido para a data de hoje).
  - Atualizados os campos de valor de despesas **Parceladas** e **Recorrentes** para utilizar o `MoneyInput`.

### 3. Backend - Criação e Sincronização
- [`backend/app/routers/expenses.py`](file:///e:/DEV/controle-contas-familiar/backend/app/routers/expenses.py):
  - Em `create_expense`: a ocorrência da despesa avulsa agora é criada com o valor real cadastrado (`expense.recurring_value`) e respeita a data de vencimento informada (em vez de gerar com `value=0`).
  - Em `update_expense`: ao alterar o valor de uma despesa avulsa, sincroniza a ocorrência pendente associada.

### 4. Edição de Ocorrência e Despesa
- [`frontend/src/app/(dashboard)/despesas/[id]/page.tsx`](file:///e:/DEV/controle-contas-familiar/frontend/src/app/%28dashboard%29/despesas/%5Bid%5D/page.tsx):
  - Modal de edição agora utiliza `MoneyInput` para despesas avulsas, recorrentes e parceladas.
  - Card da despesa avulsa agora exibe o valor caso cadastrado.
- [`frontend/src/app/(dashboard)/despesas/[id]/[occurrenceId]/page.tsx`](file:///e:/DEV/controle-contas-familiar/frontend/src/app/%28dashboard%29/despesas/%5Bid%5D/%5BoccurrenceId%5D/page.tsx):
  - Edição do valor da ocorrência atualizada com `MoneyInput`.

---

## Validação e Instruções de Uso
1. Acesse o menu **Despesas > Nova**.
2. Com o tipo **Avulsa** selecionado, observe os novos campos **Valor (R$)** e **Data de Vencimento**.
3. Digite `9980` no campo de valor: ele será automaticamente formatado para `99,80`.
4. Salve a despesa: a despesa e a ocorrência do mês já são geradas com o valor `R$ 99,80`.
5. Ao editar ocorrências ou despesas existentes, o mesmo comportamento de máscara monetária se aplica.
