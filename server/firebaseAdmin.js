
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "node:fs";

const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const credentialJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

let app;

if (getApps().length === 0) {
  if (credentialJson) {
    app = initializeApp({
      credential: cert(JSON.parse(credentialJson)),
    });
  } else if (credentialPath) {
    const serviceAccount = JSON.parse(
      fs.readFileSync(credentialPath, "utf8")
    );

    app = initializeApp({
      credential: cert(serviceAccount),
    });
  } else {
    app = initializeApp({
      credential: applicationDefault(),
    });
  }
} else {
  app = getApps()[0];
}

const db = getFirestore(app);

export { db };
