const express = require('express');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const ELITEPAY_API_URL = process.env.ELITEPAY_API_URL || 'https://api.elitepaybr.com';
const CLIENT_ID = process.env.ELITEPAY_CLIENT_ID;
const CLIENT_SECRET = process.env.ELITEPAY_CLIENT_SECRET;

const transactions = new Map();

// Precisamos do corpo bruto no webhook para validar o HMAC.
app.use('/api/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use(express.static('public'));

app.post('/api/create-pix', async (req, res) => {
  try {
    const payerName = String(req.body?.payerName || '').trim();
    const payerDocument = String(req.body?.payerDocument || '').replace(/\D/g, '');

    if (!payerName || payerDocument.length !== 11) {
      return res.status(400).json({ success: false, error: 'Informe nome e CPF válidos.' });
    }

    if (!CLIENT_ID || !CLIENT_SECRET) {
      return res.status(500).json({ success: false, error: 'Credenciais da Elite Pay não configuradas.' });
    }

    const response = await fetch(`${ELITEPAY_API_URL}/api/v1/deposit`, {
      method: 'POST',
      headers: {
        'x-client-id': CLIENT_ID,
        'x-client-secret': CLIENT_SECRET,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: 19,
        description: 'Coleção Velvet - Acesso Digital 18+',
        payerName,
        payerDocument
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      console.error('Elite Pay:', data);
      return res.status(response.status || 500).json({
        success: false,
        error: data.message || 'Falha ao gerar a cobrança PIX.'
      });
    }

    transactions.set(data.transactionId, 'PENDENTE');

    return res.json({
      success: true,
      transactionId: data.transactionId,
      qrcodeUrl: data.qrcodeUrl,
      copyPaste: data.copyPaste,
      status: data.status || 'PENDENTE'
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: 'Erro interno ao gerar PIX.' });
  }
});

app.get('/api/status/:id', async (req, res) => {
  const transactionId = req.params.id;

  try {
    const response = await fetch(`${ELITEPAY_API_URL}/api/transactions/check`, {
      method: 'POST',
      headers: {
        'x-client-id': CLIENT_ID,
        'x-client-secret': CLIENT_SECRET,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ transactionId })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Elite Pay status:', data);
      return res.status(response.status || 500).json({
        status: transactions.get(transactionId) || 'PENDENTE',
        error: data.message || data.error || 'Não foi possível consultar o pagamento.'
      });
    }

    const state =
      data?.transaction?.transactionState ||
      data?.transactionState ||
      data?.status ||
      transactions.get(transactionId) ||
      'PENDENTE';

    transactions.set(transactionId, state);

    return res.json({
      status: state,
      transaction: data?.transaction || null
    });
  } catch (err) {
    console.error('Erro ao consultar status:', err);
    return res.status(500).json({
      status: transactions.get(transactionId) || 'PENDENTE',
      error: 'Erro interno ao consultar o pagamento.'
    });
  }
});

app.get('/api/config', (req, res) => {
  res.json({
    whatsappUrl: process.env.WHATSAPP_URL || '',
    devMode: String(process.env.DEV_MODE || '').toLowerCase() === 'true'
  });
});

app.post('/api/dev/simulate-paid', (req, res) => {
  const devMode = String(process.env.DEV_MODE || '').toLowerCase() === 'true';
  if (!devMode) {
    return res.status(403).json({ success: false, error: 'Modo de teste desativado.' });
  }
  const transactionId = String(req.body?.transactionId || 'teste-local');
  transactions.set(transactionId, 'COMPLETO');
  return res.json({ success: true, status: 'COMPLETO', transactionId });
});

app.post('/api/webhook', (req, res) => {
  try {
    const timestamp = req.headers['x-elite-timestamp'];
    const signature = req.headers['x-elite-signature'];

    if (!timestamp || !signature || !CLIENT_SECRET) {
      return res.status(401).end();
    }

    const rawBody = req.body.toString('utf8');
    const base = `${timestamp}.${rawBody}`;

    const expected = 'sha256=' + crypto
      .createHmac('sha256', CLIENT_SECRET)
      .update(base)
      .digest('hex');

    const sigBuf = Buffer.from(String(signature));
    const expBuf = Buffer.from(expected);

    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return res.status(401).end();
    }

    const payload = JSON.parse(rawBody);

    if (
      payload.transactionType === 'deposito' &&
      payload.transactionState === 'COMPLETO' &&
      payload.transactionId
    ) {
      transactions.set(payload.transactionId, 'COMPLETO');
      console.log('Pagamento confirmado:', payload.transactionId);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(400).end();
  }
});

app.listen(PORT, () => {
  console.log(`Checkout rodando em http://localhost:${PORT}`);
});
