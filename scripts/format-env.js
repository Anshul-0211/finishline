const fs = require('fs');
const path = require('path');

try {
  const jsonPath = path.join(__dirname, '../firebase-admin-key.json');
  if (!fs.existsSync(jsonPath)) {
    console.error('Error: firebase-admin-key.json not found in the project root.');
    console.log('Please download your Firebase Admin private key JSON and save it as "firebase-admin-key.json" in the finishline directory.');
    process.exit(1);
  }
  const keyContent = fs.readFileSync(jsonPath, 'utf8');
  // Parse to ensure it is valid JSON, then convert back to single-line JSON string
  const parsed = JSON.parse(keyContent);
  const singleLineJson = JSON.stringify(parsed);
  
  const envPath = path.join(__dirname, '../.env.local');
  let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  
  // Filter out any existing FIREBASE_SERVICE_ACCOUNT_KEY lines
  envContent = envContent
    .split('\n')
    .filter(line => !line.trim().startsWith('FIREBASE_SERVICE_ACCOUNT_KEY='))
    .join('\n');
  
  // Append key
  envContent += `\nFIREBASE_SERVICE_ACCOUNT_KEY=${singleLineJson}\n`;
  fs.writeFileSync(envPath, envContent);
  console.log('Successfully formatted and added FIREBASE_SERVICE_ACCOUNT_KEY to .env.local!');
} catch (e) {
  console.error('Failed to process key:', e);
}
