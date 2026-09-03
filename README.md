# Checkout Velvet + Elite Pay

Checkout simples em uma única página, com:
- Nome + CPF
- Geração de PIX pela Elite Pay
- QR Code e Copia e Cola
- Webhook com validação HMAC SHA-256
- Atualização automática para "Pagamento confirmado"

## Como rodar

1. Instale o Node.js 18+.
2. Abra o terminal nesta pasta.
3. Rode:
   npm install
4. Copie `.env.example` para `.env`.
5. Preencha `.env` com seu Client ID e Client Secret da Elite Pay.
6. Rode:
   npm start
7. Abra:
   http://localhost:3000

## Webhook

Quando publicar a aplicação, cadastre na Elite Pay:

https://SEU-DOMINIO.com/api/webhook

## Importante

- Nunca coloque o Client Secret dentro do HTML.
- Nunca publique o arquivo `.env`.
- Antes de colocar em produção, teste uma cobrança de valor baixo.
- O exemplo mantém o status das transações em memória. Para uso em produção com maior volume, use banco de dados.
- Confirme com a Elite Pay se o seu tipo de produto é permitido pelos termos da plataforma.


## Modo de teste sem pagar PIX

No `.env`, use:

DEV_MODE=true

Com isso, após gerar um PIX, aparecerá o botão:
SIMULAR PAGAMENTO APROVADO

Ele marca a compra como paga apenas localmente e libera o botão do WhatsApp.
Antes de publicar em produção, troque para:

DEV_MODE=false
