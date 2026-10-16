# Walkthrough: Pagamentos Parciais e Faturas de Cartão de Crédito

**Data:** 16/10/2026  
**Status:** Concluído / Pronto para deploy  

---

## 1. Resumo das Alterações Efetuadas

Implementamos uma solução unificada para o problema de despesas familiares pagas em partes ou compras de cartão consolidadas:

### Backend (Python / FastAPI / SQLAlchemy)
1. **Modelos de Dados Criados:**
   - [`OccurrencePayment`](file:///e:/DEV/controle-contas-familiar/backend/app/models/payment.py): Tabela `occurrence_payments` para registrar cada baixa/amortização financeira (com valor, data, método e observações).
   - [`InvoiceItem`](file:///e:/DEV/controle-contas-familiar/backend/app/models/invoice_item.py): Tabela `invoice_items` para discriminar cada compra detalhada associada a uma fatura de cartão (descrição, valor, data, pessoa que comprou e categoria).
2. **Modelos Atualizados:**
   - [`Expense`](file:///e:/DEV/controle-contas-familiar/backend/app/models/expense.py): Adicionado tipo `credit_card` e coluna `card_closing_day`.
   - [`Occurrence`](file:///e:/DEV/controle-contas-familiar/backend/app/models/occurrence.py): Adicionado status `partially_paid`, relacionamentos com pagamentos e compras, e propriedades calculadas `paid_amount` e `remaining_amount`.
3. **Migrações Automáticas:**
   - Inclusão dos `ALTER TABLE` seguros no `lifespan` de [`main.py`](file:///e:/DEV/controle-contas-familiar/backend/app/main.py) para suportar as novas colunas e valores de ENUM.
4. **Endpoints Adicionados/Atualizados:**
   - [`occurrences.py`](file:///e:/DEV/controle-contas-familiar/backend/app/routers/occurrences.py):
     - `GET /occurrences/{id}/payments`
     - `POST /occurrences/{id}/payments` (registra pagamento e atualiza status para `partially_paid` ou `paid`)
     - `DELETE /occurrences/{id}/payments/{payment_id}`
     - `GET /occurrences/{id}/invoice-items`
     - `POST /occurrences/{id}/invoice-items` (adiciona item e recalcula o total da fatura)
     - `PATCH /occurrences/{id}/invoice-items/{item_id}`
     - `DELETE /occurrences/{id}/invoice-items/{item_id}`
   - [`dashboard.py`](file:///e:/DEV/controle-contas-familiar/backend/app/routers/dashboard.py): Resumo e texto formatado do WhatsApp consideram o saldo restante (`remaining_amount`) e identificam contas com pagamentos parciais.

### Frontend (Next.js / TypeScript)
1. **API Client (`api.ts`):** Métodos de CRUD para pagamentos parciais e lançamentos de fatura.
2. **Nova Despesa (`nova/page.tsx`):** Opção de criar conta do tipo `💳 Cartão` com dia de vencimento e dia de fechamento.
3. **Detalhes da Despesa (`[id]/page.tsx`):** Exibição das características do cartão e do status `Parcial` no histórico de vencimentos.
4. **Detalhes da Ocorrência (`[id]/[occurrenceId]/page.tsx`):**
   - Painel com progresso de quitação, total nominal, valor pago e saldo pendente.
   - Modal e botão **"Registrar Pagamento"** para amortizar qualquer conta.
   - Extrato do histórico de pagamentos com data, forma e notas.
   - Para contas de cartão: Seção completa de **Compras desta Fatura** com botão `+ Adicionar Compra`, exibição de quem gastou, categoria, data e recálculo automático do valor.
5. **Dashboard e Resumo (`resumo/page.tsx`):**
   - Contas parcialmente pagas permanecem visíveis na lista de a pagar com badge amarelo `Parcial`.
   - Exibição de quanto resta a pagar e quanto já foi pago.
   - Soma de totais pendentes baseada estritamente no saldo remanescente.

---

## 2. Como Usar e Validar

1. **Criar um Cartão de Crédito:**
   - Acesse **Nova Despesa** -> Escolha o tipo `💳 Cartão`.
   - Defina o dia de fechamento (ex: dia 3) e o dia de vencimento (ex: dia 10).
2. **Lançar Compras na Fatura:**
   - Abra a ocorrência do cartão.
   - Clique em `+ Adicionar Compra`. Lance:
     - *"Supermercado"* -> R$ 1.100,00 (Pessoa A, Alimentação)
     - *"Farmácia"* -> R$ 400,00 (Pessoa B, Saúde)
   - O total da fatura atualizará automaticamente para R$ 1.500,00.
3. **Registrar Pagamento Parcial:**
   - Na mesma ocorrência, clique em **Registrar Pagamento**.
   - Digite `R$ 400,00`, data de hoje e forma "Pix".
   - A conta mudará o status para `Parcialmente Paga`, indicando:
     `Pago: R$ 400,00 | Saldo Pendente: R$ 1.100,00`.
4. **Verificar no Resumo:**
   - Na tela de **Resumo do Mês**, a fatura aparecerá exibindo o saldo devedor de R$ 1.100,00 com badge amarelo e o texto do WhatsApp refletirá com precisão o saldo restante.
