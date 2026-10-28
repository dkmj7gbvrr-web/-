// Minimal in-memory mock of the Firestore v9 modular SDK surface this app
// uses, for single-tab local testing only (no persistence, no real
// cross-tab sync -- just enough to exercise the app's own logic).

const store = new Map(); // full doc path -> data object
const listeners = new Map(); // path (doc or collection) -> Set of fire functions
const DELETE_FIELD = Symbol('deleteField');

function genId() {
  return 'id_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function stripDeletes(obj) {
  const next = Object.assign({}, obj);
  Object.keys(next).forEach(function (k) {
    if (next[k] === DELETE_FIELD) delete next[k];
  });
  return next;
}

function parentCollectionPath(docPath) {
  const parts = docPath.split('/');
  return parts.slice(0, -1).join('/');
}

function notify(docPath) {
  (listeners.get(docPath) || new Set()).forEach(function (fn) { fn(); });
  const parentPath = parentCollectionPath(docPath);
  (listeners.get(parentPath) || new Set()).forEach(function (fn) { fn(); });
}

export function getFirestore(app) {
  return { app: app };
}

export function doc(parent) {
  const extra = Array.prototype.slice.call(arguments, 1);
  if (parent && parent.__isCollection) {
    const id = extra[0] || genId();
    return { __isDoc: true, path: parent.path + '/' + id, id: id };
  }
  const path = extra.join('/');
  const id = extra[extra.length - 1];
  return { __isDoc: true, path: path, id: id };
}

export function collection(db) {
  const segments = Array.prototype.slice.call(arguments, 1);
  return { __isCollection: true, path: segments.join('/') };
}

export async function setDoc(ref, data, opts) {
  const existing = store.get(ref.path) || {};
  const merged = (opts && opts.merge) ? Object.assign({}, existing, data) : Object.assign({}, data);
  store.set(ref.path, stripDeletes(merged));
  notify(ref.path);
}

export async function updateDoc(ref, data) {
  const existing = store.get(ref.path) || {};
  const merged = Object.assign({}, existing, data);
  store.set(ref.path, stripDeletes(merged));
  notify(ref.path);
}

export async function deleteDoc(ref) {
  store.delete(ref.path);
  notify(ref.path);
}

export async function addDoc(colRef, data) {
  const id = genId();
  const path = colRef.path + '/' + id;
  store.set(path, Object.assign({}, data));
  notify(path);
  return { __isDoc: true, path: path, id: id };
}

export async function getDoc(ref) {
  const data = store.get(ref.path);
  return {
    exists: function () { return data !== undefined; },
    data: function () { return data; },
    id: ref.id
  };
}

function collectDocsUnder(colPath) {
  const prefix = colPath + '/';
  const docs = [];
  store.forEach(function (data, path) {
    if (path.indexOf(prefix) !== 0) return;
    const rest = path.slice(prefix.length);
    if (rest.indexOf('/') !== -1) return; // nested deeper, not a direct child
    docs.push({ id: rest, data: function () { return data; }, ref: { __isDoc: true, path: path, id: rest } });
  });
  return docs;
}

export async function getDocs(colRef) {
  const docs = collectDocsUnder(colRef.path);
  return { docs: docs, forEach: function (fn) { docs.forEach(fn); } };
}

export function onSnapshot(ref, onNext, onError) {
  const path = ref.path;
  const fire = function () {
    try {
      if (ref.__isCollection) {
        Promise.resolve(getDocs(ref)).then(onNext);
      } else {
        Promise.resolve(getDoc(ref)).then(onNext);
      }
    } catch (e) {
      if (onError) onError(e);
    }
  };
  if (!listeners.has(path)) listeners.set(path, new Set());
  listeners.get(path).add(fire);
  Promise.resolve().then(fire);
  return function () { listeners.get(path).delete(fire); };
}

export function writeBatch() {
  const ops = [];
  return {
    set: function (ref, data, opts) { ops.push(function () { return setDoc(ref, data, opts); }); },
    update: function (ref, data) { ops.push(function () { return updateDoc(ref, data); }); },
    delete: function (ref) { ops.push(function () { return deleteDoc(ref); }); },
    commit: async function () {
      for (let i = 0; i < ops.length; i++) await ops[i]();
    }
  };
}

export function deleteField() {
  return DELETE_FIELD;
}
