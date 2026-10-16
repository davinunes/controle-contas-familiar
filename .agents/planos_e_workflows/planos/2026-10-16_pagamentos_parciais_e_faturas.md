# Plano de Implementação: Pagamentos Parciais e Faturas de Cartão de Crédito

**Data:** 16/10/2026  
**Status:** Proposta / Em Validação  

---

## 1. Visão Geral e Objetivos

Permitir que despesas familiares não fiquem limitadas à lógica binária "pendente / pago integralmente" e suportem a realidade de:
1. **Pagamentos Parciais (Amortização/Abatimento):** Abater valores aos poucos de qualquer conta/ocorrência, preservando o valor nominal original, calculando o saldo devedor remanescente e registrando o histórico de cada pagamento feito.
2. **Tipo de Conta "Fatura de Cartão" (Agrupador de Compras):** Lançar compras individuais (com descrição, valor, data, pessoa responsável e categoria) que compõem a fatura do mês, mantendo todas as anotações sem poluir a lista de vencimentos principais e permitindo pagamentos parciais da fatura.

---

## 2. Modelagem de Dados

### 2.1. Tabela de Pagamentos (`occurrence_payments`)
Suporte a 1 ou N pagamentos por ocorrência:
- `id`: Integer (PK)
- `occurrence_id`: Integer (FK `expense_occurrences.id`, ON DELETE CASCADE)
- `tenant_id`: Integer (FK `tenants.id`, ON DELETE CASCADE)
- `amount`: Numeric(10, 2) NOT NULL (valor amortizado)
- `paid_at`: DateTime NOT NULL (data/hora da baixa)
- `payment_method`: String(50) (ex: "pix", "dinheiro", "ted")
- `notes`: Text (ex: "Pago R$ 400 por Fulano")
- `created_at`: DateTime

### 2.2. Atualização em `Occurrence` (`expense_occurrences`)
- Novo status: `partially_paid`
  - `pending`: `sum(payments) == 0`
  - `partially_paid`: `0 < sum(payments) < value`
  - `paid`: `sum(payments) >= value`
- Campos calculados retornados pela API:
  - `paid_amount`: soma dos pagamentos
  - `remaining_amount`: `value - paid_amount`

### 2.3. Tipo de Conta: Fatura de Cartão (`credit_card`)
No enum de `Expense`:
- `type`: `single` | `installment` | `recurring` | `credit_card`
- Campos específicos para despesas do tipo cartão:
  - `closing_day`: Dia de fechamento da fatura
  - `recurrence_day`: Dia de vencimento da fatura

### 2.4. Tabela de Itens/Compras da Fatura (`invoice_items` ou `credit_card_purchases`)
Cada compra individual registrada na fatura:
- `id`: Integer (PK)
- `occurrence_id`: Integer (FK `expense_occurrences.id` - aponta para a ocorrência da fatura do mês)
- `tenant_id`: Integer (FK `tenants.id`)
- `description`: String (ex: "Supermercado Carrefour")
- `amount`: Numeric(10, 2) (ex: 250.00)
- `purchase_date`: Date (data em que a compra ocorreu)
- `cost_center_id`: Integer (FK opcional - Categoria)
- `person_id`: Integer (FK opcional - Quem gastou)
- `notes`: Text

> *Nota:* O valor total (`value`) da `Occurrence` da fatura é recalculado automaticamente como a soma dos `invoice_items` vinculados a ela (ou itens + saldo anterior não pago).

---

## 3. Fluxo de Experiência do Usuário (UI/UX)

### Cenário A: Registrar Pagamento Parcial
1. O usuário abre uma conta de R$ 1.500,00.
2. Clica em **"Registrar Pagamento"** (ou "Dar Baixa").
3. Modal pergunta o valor (sugere o saldo restante, mas permite digitar ex: R$ 400,00) e a data.
4. Ao salvar, a ocorrência ganha o badge amarelo **"Parcialmente Paga"**, exibindo:
   `Pago: R$ 400,00 | Restante: R$ 1.100,00`.
5. Um painel exibe o histórico de baixas com opção de excluir se houve engano.

### Cenário B: Gestão da Fatura de Cartão
1. No dashboard ou lista de despesas, a fatura aparece consolidada (ex: *Fatura Cartão Black - Vencimento 10/11 - Total: R$ 1.500,00*).
2. Ao clicar na fatura, abre a visão de itens:
   - Tabela com todas as compras discriminadas (quem comprou, categoria, valor, data).
   - Botão rápido: `+ Adicionar Compra`.
3. Para pagar, usa o mesmo botão **"Registrar Pagamento"**:
   - Paga R$ 400,00 -> Fatura fica com saldo pendente de R$ 1.100,00 sem perder nenhum item da lista!

---

## 4. Próximos Passos
1. Validação do desenho da solução com o usuário.
2. Criação do script de migração do banco de dados para `occurrence_payments` e `invoice_items`.
3. Implementação dos endpoints no Backend (FastAPI).
4. Ajustes nos componentes e telas do Frontend (Next.js).
