/* BLADE//QUEUE shared Firebase layer
 * Firebase Web SDK 13.3.0 (modular CDN imports).
 * Add the exact Realtime Database URL from Firebase Console below.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js";
import {
  getDatabase,
  ref,
  onValue,
  runTransaction,
  push,
  get
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-database.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  setPersistence,
  browserLocalPersistence,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";

// Firebase web configuration supplied for project catttt-e9023.
// IMPORTANT: Paste your database URL from Realtime Database > Data.
const firebaseConfig = {
  apiKey: "AIzaSyAJqn3tg1k3ahuRJczPFNy-n-jkmmjkw74",
  authDomain: "catttt-e9023.firebaseapp.com",
  databaseURL: "https://catttt-e9023-default-rtdb.firebaseio.com/moderators",
  projectId: "catttt-e9023",
  storageBucket: "catttt-e9023.firebasestorage.app",
  messagingSenderId: "822367307634",
  appId: "1:822367307634:web:fd06ab6d87c6db9d513feb",
  measurementId: "G-88XB9XK1VQ"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const DATABASE_URL_CONFIGURED = /^https:\/\//i.test(firebaseConfig.databaseURL || "") && !firebaseConfig.databaseURL.includes("PASTE_");
export const db = DATABASE_URL_CONFIGURED ? getDatabase(app) : null;
export const queueRef = db ? ref(db, "queue") : null;

export const SDK_VERSION = "13.3.0";

export function ensureDatabaseConfigured() {
  if (!DATABASE_URL_CONFIGURED || !db) {
    throw new Error("Add your exact Firebase Realtime Database URL to shared.js first. Find it in Firebase Console → Realtime Database → Data.");
  }
}

export function listenToQueue(onData, onError = () => {}) {
  ensureDatabaseConfigured();
  return onValue(queueRef, snapshot => onData(normalizeQueue(snapshot.val())), onError);
}

export function listenToConnection(onStatus, onError = () => {}) {
  ensureDatabaseConfigured();
  return onValue(ref(db, ".info/connected"), snapshot => onStatus(snapshot.val() === true), onError);
}

export async function checkModerator(uid) {
  ensureDatabaseConfigured();
  if (!uid) return false;
  const snapshot = await get(ref(db, `moderators/${uid}`));
  return snapshot.val() === true;
}

export function watchAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export function keepModeratorSignedIn() {
  return setPersistence(auth, browserLocalPersistence);
}

export function moderatorSignIn(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function moderatorSignOut() {
  return signOut(auth);
}

export function sendModeratorPasswordReset(email) {
  return sendPasswordResetEmail(auth, email);
}

function cleanObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function normalizeQueue(raw) {
  const source = cleanObject(raw);
  const waiting = cleanObject(source.waiting);
  const completed = cleanObject(source.completed);
  const safeWaiting = {};
  const safeCompleted = {};

  for (const [id, request] of Object.entries(waiting)) {
    if (request && typeof request === "object" && !Array.isArray(request)) {
      safeWaiting[id] = { ...request, id };
    }
  }
  for (const [id, request] of Object.entries(completed)) {
    if (request && typeof request === "object" && !Array.isArray(request)) {
      safeCompleted[id] = { ...request, id };
    }
  }

  return {
    waiting: safeWaiting,
    completed: safeCompleted,
    updatedAt: Number(source.updatedAt) || 0
  };
}

export function orderedWaiting(queue) {
  return Object.values(normalizeQueue(queue).waiting).sort((a, b) => {
    const positionDifference = (Number(a.position) || 0) - (Number(b.position) || 0);
    if (positionDifference) return positionDifference;
    return (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0);
  });
}

export function orderedCompleted(queue) {
  return Object.values(normalizeQueue(queue).completed).sort((a, b) => {
    return (Number(b.completedAt) || 0) - (Number(a.completedAt) || 0);
  });
}

export function comboLabel(request) {
  const item = request || {};
  if (String(item.fullCombo || "").trim()) return String(item.fullCombo).trim();
  return [item.beyblade, item.ratchet, item.bit].filter(Boolean).join(" ") || "Combo details not supplied";
}

export function fingerprint(request) {
  return [request.blader, request.beyblade, request.ratchet, request.bit]
    .map(value => String(value || "").trim().toLocaleLowerCase().replace(/\s+/g, " "))
    .join("|");
}

function reindexWaiting(waitingObject) {
  const entries = Object.entries(waitingObject || {}).filter(([, value]) => value && typeof value === "object");
  entries.sort((a, b) => {
    const diff = (Number(a[1].position) || 0) - (Number(b[1].position) || 0);
    return diff || (Number(a[1].createdAt) || 0) - (Number(b[1].createdAt) || 0);
  });
  const result = {};
  entries.forEach(([id, request], index) => {
    result[id] = { ...request, position: index + 1 };
  });
  return result;
}

function trimCompleted(completedObject, maximum = 500) {
  const entries = Object.entries(completedObject || {}).filter(([, value]) => value && typeof value === "object");
  entries.sort((a, b) => (Number(b[1].completedAt) || 0) - (Number(a[1].completedAt) || 0));
  return Object.fromEntries(entries.slice(0, maximum));
}

function mutableQueue(raw) {
  const q = normalizeQueue(raw);
  return { waiting: { ...q.waiting }, completed: { ...q.completed }, updatedAt: q.updatedAt };
}

function validateRequestFields(fields) {
  const request = {
    blader: String(fields.blader || "").trim().slice(0, 45),
    beyblade: String(fields.beyblade || "").trim().slice(0, 55),
    ratchet: String(fields.ratchet || "").trim().slice(0, 24),
    bit: String(fields.bit || "").trim().slice(0, 30),
    fullCombo: String(fields.fullCombo || "").trim().slice(0, 100),
    note: String(fields.note || "").trim().slice(0, 220)
  };
  if (!request.blader || !request.beyblade) {
    throw new Error("Enter both the blader name and Beyblade name.");
  }
  if (!request.ratchet && !request.bit && !request.fullCombo) {
    throw new Error("Add at least a Ratchet, Bit, or full combo description.");
  }
  return request;
}

function requireTransactionCommit(result, errorMessage = "The queue changed before this action could finish. Please try again.") {
  if (!result.committed) throw new Error(errorMessage);
  return result.snapshot ? normalizeQueue(result.snapshot.val()) : null;
}

export async function addRequest(fields) {
  ensureDatabaseConfigured();
  const request = validateRequestFields(fields);
  const id = push(ref(db, "queue/waiting")).key;
  const key = fingerprint(request);

  const result = await runTransaction(queueRef, current => {
    const q = mutableQueue(current);
    const duplicate = Object.values(q.waiting).some(existing => fingerprint(existing) === key);
    if (duplicate) return;

    const nextPosition = Object.values(q.waiting).reduce((max, item) => Math.max(max, Number(item.position) || 0), 0) + 1;
    q.waiting[id] = { ...request, createdAt: Date.now(), position: nextPosition };
    q.waiting = reindexWaiting(q.waiting);
    q.updatedAt = Date.now();
    return q;
  }, { applyLocally: false });

  if (!result.committed) {
    const latest = normalizeQueue(result.snapshot?.val());
    const duplicate = Object.values(latest.waiting).some(existing => fingerprint(existing) === key);
    throw new Error(duplicate ? "DUPLICATE_REQUEST" : "The request was not added. Please try again.");
  }
  return id;
}

export async function updateRequest(id, fields) {
  ensureDatabaseConfigured();
  if (!id) throw new Error("Missing request ID.");
  const updatedFields = validateRequestFields(fields);
  const key = fingerprint(updatedFields);

  const result = await runTransaction(queueRef, current => {
    const q = mutableQueue(current);
    const existing = q.waiting[id];
    if (!existing) return;
    const duplicate = Object.entries(q.waiting).some(([otherId, item]) => otherId !== id && fingerprint(item) === key);
    if (duplicate) return;
    q.waiting[id] = { ...existing, ...updatedFields, position: Number(existing.position) || 1 };
    q.updatedAt = Date.now();
    return q;
  }, { applyLocally: false });

  if (!result.committed) {
    const latest = normalizeQueue(result.snapshot?.val());
    if (Object.values(latest.waiting).some(item => item.id !== id && fingerprint(item) === key)) {
      throw new Error("DUPLICATE_REQUEST");
    }
    throw new Error("This request may already have been removed. Refresh the queue and try again.");
  }
}

export async function reorderRequest(id, direction) {
  ensureDatabaseConfigured();
  const step = direction < 0 ? -1 : 1;
  const result = await runTransaction(queueRef, current => {
    const q = mutableQueue(current);
    const ids = Object.keys(q.waiting).sort((a, b) => {
      const diff = (Number(q.waiting[a].position) || 0) - (Number(q.waiting[b].position) || 0);
      return diff || (Number(q.waiting[a].createdAt) || 0) - (Number(q.waiting[b].createdAt) || 0);
    });
    const index = ids.indexOf(id);
    const nextIndex = index + step;
    if (index < 0 || nextIndex < 0 || nextIndex >= ids.length) return;
    [ids[index], ids[nextIndex]] = [ids[nextIndex], ids[index]];
    const reordered = {};
    ids.forEach((requestId, position) => {
      reordered[requestId] = { ...q.waiting[requestId], position: position + 1 };
    });
    q.waiting = reordered;
    q.updatedAt = Date.now();
    return q;
  }, { applyLocally: false });
  requireTransactionCommit(result, "The request could not be moved. Refresh and try again.");
}

async function archiveRequest(id, status) {
  ensureDatabaseConfigured();
  const result = await runTransaction(queueRef, current => {
    const q = mutableQueue(current);
    const request = q.waiting[id];
    if (!request) return;
    q.completed[id] = { ...request, status, completedAt: Date.now() };
    delete q.waiting[id];
    q.waiting = reindexWaiting(q.waiting);
    q.completed = trimCompleted(q.completed);
    q.updatedAt = Date.now();
    return q;
  }, { applyLocally: false });
  requireTransactionCommit(result, "This request is no longer waiting. Refresh the queue.");
}

export function completeRequest(id) {
  return archiveRequest(id, "completed");
}

export function skipRequest(id) {
  return archiveRequest(id, "skipped");
}

export async function deleteRequest(id) {
  ensureDatabaseConfigured();
  const result = await runTransaction(queueRef, current => {
    const q = mutableQueue(current);
    if (!q.waiting[id]) return;
    delete q.waiting[id];
    q.waiting = reindexWaiting(q.waiting);
    q.updatedAt = Date.now();
    return q;
  }, { applyLocally: false });
  requireTransactionCommit(result, "This request is no longer in the waiting queue.");
}

export async function clearCompletedHistory() {
  ensureDatabaseConfigured();
  const result = await runTransaction(queueRef, current => {
    const q = mutableQueue(current);
    q.completed = {};
    q.updatedAt = Date.now();
    return q;
  }, { applyLocally: false });
  requireTransactionCommit(result, "Could not clear completed history.");
}

export function firebaseErrorMessage(error) {
  const code = String(error?.code || "");
  const messages = {
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/invalid-login-credentials": "Email or password is incorrect.",
    "auth/user-not-found": "No moderator account exists for that email.",
    "auth/wrong-password": "Email or password is incorrect.",
    "auth/too-many-requests": "Too many attempts. Try again later.",
    "auth/network-request-failed": "Network error. Check the connection and try again.",
    "PERMISSION_DENIED": "Firebase denied this action. Check that this account is listed under moderators and that the database rules are published.",
    "permission_denied": "Firebase denied this action. Check that this account is listed under moderators and that the database rules are published."
  };
  if (error?.message === "DUPLICATE_REQUEST") return "That exact blader + combo is already waiting. Duplicate blocked.";
  if (messages[code]) return messages[code];
  if (error?.message) return error.message;
  return "Something went wrong. Please try again.";
}
