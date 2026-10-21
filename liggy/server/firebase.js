
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const firebaseApp = initializeApp({
  credential: applicationDefault(),
});

const db = getFirestore(firebaseApp);

export { db };
