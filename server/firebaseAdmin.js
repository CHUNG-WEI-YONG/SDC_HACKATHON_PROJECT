
  import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
  import { getFirestore } from "firebase-admin/firestore";
  import fs from "node:fs";

  const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const configuredProjectId = process.env.GOOGLE_CLOUD_PROJECT;

  let app;

  if (getApps().length === 0) {
    console.info(`[Firebase/Node] STEP 1/4: configuration loaded (project=${configuredProjectId || "from credentials"}, service-account=${credentialPath ? "configured" : "Application Default Credentials"}).`);
    if (credentialPath) {
      const serviceAccount = JSON.parse(
        fs.readFileSync(credentialPath, "utf8")
      );
      console.info(`[Firebase/Node] STEP 2/4: service-account file read (project=${serviceAccount.project_id || "missing project_id"}).`);

      if (configuredProjectId && serviceAccount.project_id && configuredProjectId !== serviceAccount.project_id) {
        throw new Error(
          `Firebase project mismatch: GOOGLE_CLOUD_PROJECT is "${configuredProjectId}", but the configured service-account key belongs to "${serviceAccount.project_id}". Use the service-account JSON from the selected Firebase project, or set GOOGLE_CLOUD_PROJECT to that key's project.`
        );
      }

      app = initializeApp({
        credential: cert(serviceAccount),
        projectId: configuredProjectId || serviceAccount.project_id,
      });
    } else {
      app = initializeApp({
        credential: applicationDefault(),
        ...(configuredProjectId ? { projectId: configuredProjectId } : {}),
      });
    }
    console.info("[Firebase/Node] STEP 3/4: Firebase Admin initialized.");
  } else {
    app = getApps()[0];
  }

  const db = getFirestore(app);
  console.info("[Firebase/Node] STEP 4/4: Firestore client ready (network access is verified by the Python bridge startup check).");

  export { db };