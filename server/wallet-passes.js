// ─── Wallet Passes: Google Wallet + Apple Wallet ─────────────────────────────
// Genera pases para la tarjeta de puntos (/tarjeta) para añadirla al teléfono.
//
// Ambas integraciones se activan SOLO si sus credenciales están en el .env.
// Si faltan, isGoogleWalletEnabled()/isAppleWalletEnabled() devuelven false y
// los botones no se muestran en la página de la tarjeta.
//
// ── Variables de entorno ──
//  Google Wallet (Android):
//    GOOGLE_WALLET_ISSUER_ID   = ID de emisor de la Google Pay & Wallet Console
//    GOOGLE_WALLET_SA_EMAIL    = email de la service account de Google Cloud
//    GOOGLE_WALLET_SA_KEY      = private key PEM de la service account
//                                (con \n literales o el PEM completo en una línea)
//  Apple Wallet (iPhone):
//    APPLE_WALLET_PASS_TYPE_ID = ej. pass.com.srservi.loyalty
//    APPLE_WALLET_TEAM_ID      = Team ID de Apple Developer
//    APPLE_WALLET_SIGNER_CERT  = certificado del Pass Type ID (PEM)
//    APPLE_WALLET_SIGNER_KEY   = private key del certificado (PEM)
//    APPLE_WALLET_SIGNER_KEY_PASSPHRASE = passphrase del key (si tiene)
//    APPLE_WALLET_WWDR         = Apple WWDR intermediate certificate (PEM)

import jwt from 'jsonwebtoken';
import { PKPass } from 'passkit-generator';
import sharp from 'sharp';

const BASE_URL = process.env.BASE_URL || 'https://srservi2.srautomatic.com';

// Normaliza un PEM que en el .env puede venir con "\n" literales.
function pem(v) {
  if (!v) return '';
  return v.includes('\\n') ? v.replace(/\\n/g, '\n') : v;
}

const cardUrlOf = (card) => `${BASE_URL}/tarjeta/${card.token}`;
const pointsOf = (card) => Number(card.points) || 0;
const moneyOf = (card) => {
  const mpp = Number(card?.config?.money_per_point) || 0;
  return mpp > 0 ? Math.round(pointsOf(card) * mpp) : 0;
};

// ═══════════════════════ Google Wallet ═══════════════════════

export function isGoogleWalletEnabled() {
  return !!(process.env.GOOGLE_WALLET_ISSUER_ID &&
            process.env.GOOGLE_WALLET_SA_EMAIL &&
            process.env.GOOGLE_WALLET_SA_KEY);
}

// Construye el enlace "Añadir a Google Wallet" (JWT firmado, clase incrustada).
export function buildGoogleWalletSaveUrl(card) {
  if (!isGoogleWalletEnabled()) throw new Error('Google Wallet no está configurado');

  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID;
  const saEmail = process.env.GOOGLE_WALLET_SA_EMAIL;
  const saKey = pem(process.env.GOOGLE_WALLET_SA_KEY);

  const classId = `${issuerId}.srservi_points`;
  const objectId = `${issuerId}.card_${card.token}`;
  const storeName = card.store_name || 'SRServi';
  const points = pointsOf(card);
  const money = moneyOf(card);
  // Google exige una URL http(s) para el logo (no acepta data URLs base64).
  const logoUri = (card.store_logo && /^https?:\/\//.test(card.store_logo))
    ? card.store_logo
    : `${BASE_URL}/wallet-logo.png`;

  const loyaltyClass = {
    id: classId,
    issuerName: 'SRServi',
    reviewStatus: 'UNDER_REVIEW',
    programName: 'Tarjeta de Puntos',
    programLogo: { sourceUri: { uri: `${BASE_URL}/wallet-logo.png` } },
    hexBackgroundColor: '#111111',
  };

  const loyaltyObject = {
    id: objectId,
    classId,
    state: 'ACTIVE',
    accountName: card.name || 'Cliente',
    accountId: card.code,
    loyaltyPoints: {
      label: 'Puntos',
      balance: { int: points },
    },
    ...(money > 0 ? {
      secondaryLoyaltyPoints: {
        label: 'Equivale a',
        balance: { string: `$${money.toLocaleString('es-CL')}` },
      },
    } : {}),
    barcode: { type: 'QR_CODE', value: cardUrlOf(card), alternateText: card.code },
    hexBackgroundColor: '#111111',
    logo: { sourceUri: { uri: logoUri } },
    cardTitle: { defaultValue: { language: 'es', value: storeName } },
    header: { defaultValue: { language: 'es', value: 'Tarjeta de Puntos' } },
  };

  const claims = {
    iss: saEmail,
    aud: 'google',
    typ: 'savetowallet',
    origins: [BASE_URL],
    payload: {
      loyaltyClasses: [loyaltyClass],
      loyaltyObjects: [loyaltyObject],
    },
  };

  const token = jwt.sign(claims, saKey, { algorithm: 'RS256' });
  return `https://pay.google.com/gp/v/save/${token}`;
}

// ═══════════════════════ Apple Wallet ═══════════════════════

export function isAppleWalletEnabled() {
  return !!(process.env.APPLE_WALLET_PASS_TYPE_ID &&
            process.env.APPLE_WALLET_TEAM_ID &&
            process.env.APPLE_WALLET_SIGNER_CERT &&
            process.env.APPLE_WALLET_SIGNER_KEY &&
            process.env.APPLE_WALLET_WWDR);
}

// Genera un ícono PNG cuadrado con la inicial de la tienda (Apple exige icon.png).
async function makeIcon(text, size) {
  const letter = (text || 'S').trim().charAt(0).toUpperCase() || 'S';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <rect width="${size}" height="${size}" rx="${Math.round(size * 0.18)}" fill="#111111"/>
    <text x="50%" y="50%" font-family="Helvetica, Arial, sans-serif" font-size="${Math.round(size * 0.55)}"
      font-weight="bold" fill="#ffffff" text-anchor="middle" dominant-baseline="central">${letter}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// Construye el buffer del archivo .pkpass firmado.
export async function buildApplePkpass(card) {
  if (!isAppleWalletEnabled()) throw new Error('Apple Wallet no está configurado');

  const points = pointsOf(card);
  const money = moneyOf(card);
  const storeName = card.store_name || 'SRServi';

  const passJson = {
    formatVersion: 1,
    passTypeIdentifier: process.env.APPLE_WALLET_PASS_TYPE_ID,
    teamIdentifier: process.env.APPLE_WALLET_TEAM_ID,
    organizationName: 'SRServi',
    serialNumber: card.token,
    description: `Tarjeta de puntos - ${storeName}`,
    logoText: storeName,
    foregroundColor: 'rgb(255,255,255)',
    backgroundColor: 'rgb(17,17,17)',
    labelColor: 'rgb(212,175,55)',
    barcodes: [{
      format: 'PKBarcodeFormatQR',
      message: cardUrlOf(card),
      messageEncoding: 'iso-8859-1',
      altText: card.code,
    }],
    storeCard: {
      headerFields: [{ key: 'points', label: 'PUNTOS', value: points }],
      primaryFields: [{ key: 'balance', label: 'Saldo', value: `${points} pts` }],
      secondaryFields: [
        { key: 'holder', label: 'Titular', value: card.name || 'Cliente' },
        ...(money > 0 ? [{ key: 'money', label: 'Equivale a', value: `$${money.toLocaleString('es-CL')}` }] : []),
      ],
      auxiliaryFields: [{ key: 'code', label: 'Clave', value: card.code }],
      backFields: [
        { key: 'store', label: 'Tienda', value: storeName },
        { key: 'link', label: 'Ver tarjeta', value: cardUrlOf(card) },
      ],
    },
  };

  const [icon, icon2x, icon3x, logo, logo2x] = await Promise.all([
    makeIcon(storeName, 29), makeIcon(storeName, 58), makeIcon(storeName, 87),
    makeIcon(storeName, 50), makeIcon(storeName, 100),
  ]);

  const pass = new PKPass({
    'pass.json': Buffer.from(JSON.stringify(passJson)),
    'icon.png': icon,
    'icon@2x.png': icon2x,
    'icon@3x.png': icon3x,
    'logo.png': logo,
    'logo@2x.png': logo2x,
  }, {
    wwdr: pem(process.env.APPLE_WALLET_WWDR),
    signerCert: pem(process.env.APPLE_WALLET_SIGNER_CERT),
    signerKey: pem(process.env.APPLE_WALLET_SIGNER_KEY),
    signerKeyPassphrase: process.env.APPLE_WALLET_SIGNER_KEY_PASSPHRASE || undefined,
  });

  return pass.getAsBuffer();
}

export function walletStatus() {
  return { google: isGoogleWalletEnabled(), apple: isAppleWalletEnabled() };
}
