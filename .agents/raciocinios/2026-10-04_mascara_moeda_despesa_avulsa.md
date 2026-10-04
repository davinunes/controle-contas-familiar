# Raciocínio: Máscara Monetária Automática e Cadastro com Valor em Despesa Avulsa

**Data:** 04/10/2026  
**Contexto:** Solicitação do usuário para permitir o cadastro da despesa avulsa já com o valor e aplicar formatação de máscara monetária dinâmica (onde a digitação de números insere automaticamente a vírgula de centavos, por exemplo `9980` -> `99,80`).

---

## 1. Análise do Problema

### 1.1 Despesa Avulsa sem Campo de Valor
- **Frontend (`despesas/nova/page.tsx`):** Ao selecionar o tipo de despesa `single` ("Avulsa"), o formulário exibia apenas o campo "Dia de Vencimento". Não existia campo de valor.
- **Backend (`expenses.py`):** Na rota `POST /expenses`, ao processar `single`, o sistema gerava a ocorrência com valor fixo `value=0`.
- **Impacto:** O usuário precisava cadastrar a despesa avulsa com valor zero e só depois navegar até a ocorrência para editar e atribuir o valor real, gerando retrabalho desnecessário.

### 1.2 Formatação de Valores Monetários (Cálculo Automático da Vírgula)
- Os inputs usavam `type="number"` e `step="0.01"`, o que em navegadores web e dispositivos móveis:
  - Não formata centavos enquanto o usuário digita;
  - Exige digitar ponto/vírgula manualmente;
  - Não aceita formatação pt-BR com vírgula e separador de milhar.
- O padrão financeiro desejado pelo usuário: os dígitos entram da direita para a esquerda dividindo por 100 (ex: `9` -> `0,09`, `99` -> `0,99`, `998` -> `9,98`, `9980` -> `99,80`).

---

## 2. Decisões Arquiteturais

1. **Utilitário Dedicado (`frontend/src/lib/money.ts`):**
   - `maskCurrency`: limpa caracteres não numéricos, divide por 100 e formata para `pt-BR` com 2 casas decimais.
   - `formatCurrencyFromNumber`: formata valores vindos da API / backend (ex: `99.8` -> `"99,80"`).
   - `parseCurrency`: converte a string formatada (`"99,80"`) em `number` float (`99.80`) para os payloads JSON.

2. **Componente Reutilizável (`frontend/src/components/MoneyInput.tsx`):**
   - Usa `type="text"` e `inputMode="numeric"` (ativando o teclado numérico em celulares).
   - Exibe o prefixo visual elegante `R$` integrado.
   - Trata o `Backspace` / `Delete` para que, ao zerar os dígitos, o campo não fique preso em `"0,00"`, permitindo limpar o campo.

3. **Backend (`backend/app/routers/expenses.py`):**
   - `create_expense`: Se `expense.type == "single"`, agora aproveita `expense.recurring_value` (se informado) e `expense.first_due_date` (se informada) para criar a ocorrência já com o valor real e a data de vencimento correta.
   - `update_expense`: Se uma despesa avulsa for editada e tiver ocorrência pendente, sincroniza o valor e vencimento na ocorrência.
