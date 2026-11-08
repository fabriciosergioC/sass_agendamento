/**
 * Imprime o QR code do link de agendamento no terminal.
 *
 * Uso:  node scripts/print-qr.cjs <url> [caminhoDoBackend]
 *
 * O frontend nao tem dependencia de QR, e a maquina e apertada de RAM/disso.
 * Entao reaproveitamos o pacote `qrcode-terminal` que JÁ existe no node_modules
 * do backend (sass barbearia). Se ele nao for encontrado, o script so avisa e
 * sai sem QR - o link continua funcionando, o QR e conveniencia.
 */
const path = require('node:path');
const fs = require('node:fs');

const url = process.argv[2];
const backendPath = process.argv[3];

if (!url) {
  console.error('uso: node print-qr.cjs <url> [caminhoDoBackend]');
  process.exit(0);
}

const candidatos = [
  backendPath && path.join(backendPath, 'node_modules', 'qrcode-terminal'),
  path.join(__dirname, '..', 'node_modules', 'qrcode-terminal'),
  'C:\\Users\\fabri\\OneDrive\\Documentos\\sass barbearia\\node_modules\\qrcode-terminal',
].filter(Boolean);

let qr = null;
for (const dir of candidatos) {
  try {
    if (!fs.existsSync(dir)) continue;
    qr = require(dir);
    if (typeof qr.generate === 'function') break;
    qr = null;
  } catch {
    /* tenta o proximo */
  }
}

if (!qr || typeof qr.generate !== 'function') {
  console.log('QR indisponivel (qrcode-terminal nao encontrado) - use o link acima.');
  process.exit(0);
}

qr.generate(url, { small: true, padding: 1 }, (out) => {
  console.log('Escaneie com a camera do celular:');
  console.log(out);
});
