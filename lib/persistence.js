/**
 * Персистентность состояния проекта между перезагрузками страницы.
 *
 * ВАЖНО про границы этого механизма: WebContainer — это виртуальная машина,
 * которая живёт только в памяти текущей вкладки. При настоящей перезагрузке
 * страницы (F5) JS-контекст уничтожается полностью, а вместе с ним —
 * установленные node_modules и запущенный dev-сервер. Это ограничение
 * платформы WebContainers, обойти его из кода нельзя: контейнер всегда
 * стартует заново и требует повторного npm install.
 *
 * Что МЫ можем и должны сохранить сами — это то, что находится в React/Zustand
 * состоянии и не восстанавливается автоматически:
 *  - содержимое файлов пользователя (fileContents)
 *  - пустые директории, которые пользователь создал, но ещё не положил
 *    в них файл (folders)
 *  - какие файлы открыты вкладками (openFiles)
 *  - какой файл активен (activeFile)
 *
 * useWebContainer.js при старте читает это состояние и, если оно есть,
 * монтирует в контейнер именно его вместо дефолтного стартового проекта,
 * а затем сам запускает npm install && npm run dev — так что после
 * перезагрузки страницы пользователь не теряет ни строчки кода, просто
 * ждёт заново установку зависимостей (что неизбежно, см. выше).
 *
 * Это сохраняется в IndexedDB (не localStorage — там ограничение ~5MB и
 * синхронный API, который блокирует поток на каждый keystroke).
 *
 * Путь: /lib/persistence.js
 */

const DB_NAME = 'wc-ide';
const STORE_NAME = 'kv';
const DB_VERSION = 1;
const PROJECT_KEY = 'project-state-v1';

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB недоступен (не браузерное окружение)'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadProjectState() {
  try {
    return await idbGet(PROJECT_KEY);
  } catch (err) {
    console.error('Не удалось загрузить сохранённое состояние проекта:', err);
    return null;
  }
}

export async function saveProjectState(state) {
  try {
    await idbSet(PROJECT_KEY, state);
  } catch (err) {
    console.error('Не удалось сохранить состояние проекта:', err);
  }
}

export async function clearProjectState() {
  try {
    await idbSet(PROJECT_KEY, null);
  } catch (err) {
    console.error('Не удалось очистить сохранённое состояние проекта:', err);
  }
}

// Дебаунс, чтобы не писать в IndexedDB на каждый keystroke/клик по вкладке —
// собираем изменения и пишем не чаще раза в 500мс.
let saveTimer = null;

export function schedulePersist(getState) {
  if (typeof window === 'undefined') return;
  if (saveTimer) clearTimeout(saveTimer);

  saveTimer = setTimeout(() => {
    const { fileContents, openFiles, activeFile, folders } = getState();
    saveProjectState({ fileContents, openFiles, activeFile, folders });
  }, 500);
}