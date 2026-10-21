
import admin from "firebase-admin";

const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (!admin.apps.length) {
  if (credentialPath) {
    const { default: serviceAccount } = await import(
      credentialPath.startsWith("file:")
        ? credentialPath
        : `file://${credentialPath.replace(/\\/g, "/")}`
    );

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  }
}

const db = admin.firestore();

export { db };
