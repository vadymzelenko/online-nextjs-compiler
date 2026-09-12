import { create } from 'zustand';
import { schedulePersist } from '/lib/persistence';

/**
 * Статусы жизненного цикла контейнера.
 * idle       -> ничего не происходило
 * booting    -> идёт webcontainerInstance.boot()
 * mounting   -> идёт монтирование файлов
 * installing -> в интерактивный шелл отправлена команда
 *               npm install && npm run dev, ждём либо server-ready
 *               (-> ready), либо ошибку
 * ready      -> сервер поднят, preview доступен
 * error      -> что-то упало
 */
export const useWebContainerStore = create((set, get) => ({
    // --- singleton-инстанс контейнера ---
    instance: null,
    status: 'idle',
    error: null,

    // --- превью ---
    previewUrl: null,

    containerTree: null,
    isScanning: false,
    setContainerTree: (tree) => set({ containerTree: tree }),
    setIsScanning: (isScanning) => set({ isScanning }),

    // --- файловая система (для редактора/эксплорера) ---
    // плоская карта: { '/app/page.js': 'contents...' }
    fileContents: {},
    // пустые директории (созданы пользователем, но в них ещё нет файлов —
    // такие папки не отражены в fileContents, поэтому храним их отдельно)
    folders: [],
    // какие файлы открыты вкладками в редакторе
    openFiles: ['/app/page.js'],
    activeFile: '/app/page.js',

    // --- терминал / интерактивный шелл ---
    // ссылка на write-функцию терминала (вывод шелла -> xterm)
    terminalWriter: null,
    // ссылка на write-функцию stdin шелла (ввод пользователя -> jsh)
    shellInputWriter: null,
    // сам процесс шелла — нужен, чтобы дергать .resize() при ресайзе панели
    shellProcess: null,



    terminals: [{
        id: 'term-1',
        name: 'bash',
        initialCommand: 'npm install && npm run dev\r'
    }],
    activeTerminalId: 'term-1',

    createTerminal: () => set((state) => {
        const newId = `term-${Date.now()}`;
        return {
            terminals: [
                ...state.terminals,
                { id: newId, name: 'bash', initialCommand: '' }
            ],
            activeTerminalId: newId
        };
    }),

    closeTerminal: (id) => set((state) => {
        const newTerminals = state.terminals.filter(t => t.id !== id);
        let nextActive = state.activeTerminalId;
        if (state.activeTerminalId === id) {
            nextActive = newTerminals[newTerminals.length - 1]?.id || null;
        }
        return { terminals: newTerminals, activeTerminalId: nextActive };
    }),

    setActiveTerminal: (id) => set({ activeTerminalId: id }),

    // ==== экшены ====

    setInstance: (instance) => set({ instance }),

    setStatus: (status) => set({ status }),

    setError: (error) => set({ error, status: 'error' }),

    setPreviewUrl: (previewUrl) => set({ previewUrl, status: 'ready' }),

    setTerminalWriter: (fn) => set({ terminalWriter: fn }),

    writeToTerminal: (data) => {
        const writer = get().terminalWriter;
        if (writer) writer(data);
    },

    setShellProcess: (proc) => set({ shellProcess: proc }),

    setShellInputWriter: (fn) => set({ shellInputWriter: fn }),

    // Отправить данные (нажатия клавиш из xterm) в stdin реального шелла —
    // это то, что делает терминал по-настоящему интерактивным: можно набрать
    // "npm install lodash" и это выполнится внутри контейнера.
    sendShellInput: (data) => {
        const writer = get().shellInputWriter;
        if (writer) writer(data);
    },

    resizeShell: (cols, rows) => {
        const proc = get().shellProcess;
        if (proc) {
            try {
                proc.resize({ cols, rows });
            } catch {
                // процесс мог ещё не быть готов к ресайзу — не критично
            }
        }
    },

    // Открыть файл вкладкой (если уже открыт — просто делаем активным)
    openFile: async (path) => {
        const { instance } = get();

        // 1. Мгновенно переключаем UI на нужную вкладку
        set((state) => ({
            openFiles: state.openFiles.includes(path)
                ? state.openFiles
                : [...state.openFiles, path],
            activeFile: path,
        }));

        // 2. Тихо подтягиваем самую свежую версию из реальной ФС WebContainer
        // Это обновит package.json после npm install
        if (instance) {
            try {
                const freshContent = await instance.fs.readFile(path, 'utf-8');
                set((state) => ({
                    fileContents: {
                        ...state.fileContents,
                        [path]: freshContent,
                    },
                }));
            } catch (err) {
                console.warn('Не удалось прочитать файл из ФС:', err);
            }
        }

        schedulePersist(get);
    },

    setActiveFile: (path) => {
        set({ activeFile: path });
        schedulePersist(get);
    },

    closeFile: (path) => {
        set((state) => {
            const openFiles = state.openFiles.filter((p) => p !== path);
            let activeFile = state.activeFile;

            if (activeFile === path) {
                const closedIndex = state.openFiles.indexOf(path);
                // При закрытии активной вкладки переключаемся на соседнюю справа,
                // а если её нет — на предыдущую слева
                activeFile =
                    openFiles[closedIndex] ?? openFiles[closedIndex - 1] ?? null;
            }

            return { openFiles, activeFile };
        });
        schedulePersist(get);
    },

    setOpenFiles: (openFiles) => set({ openFiles }),

    setFolders: (folders) => set({ folders }),

    updateFileContent: (path, content) => {
        set((state) => ({
            fileContents: {
                ...state.fileContents,
                [path]: content,
            },
        }));
        schedulePersist(get);
    },

    setInitialFileContents: (map) => set({ fileContents: map }),

    // Полный рескан реальной ФС контейнера (см. useWebContainer.js) не должен
    // затирать файл, который прямо сейчас редактируется в Monaco: его
    // актуальное содержимое лежит в React-стейте и ещё не долетело до
    // реальной ФС (см. дебаунс записи в Editor.jsx).
    syncFileContentsFromContainer: (scannedFiles, scannedFolders) => {
        set((state) => {
            const merged = { ...scannedFiles };
            if (state.activeFile && state.fileContents[state.activeFile] !== undefined) {
                merged[state.activeFile] = state.fileContents[state.activeFile];
            }
            return { fileContents: merged, folders: scannedFolders };
        });
    },

    // --- CRUD по файлам/папкам, инициируется из FileExplorer ---
    // Каждое действие сразу обновляет локальный стор (UI реагирует мгновенно)
    // и параллельно применяет изменение к реальной ФС контейнера через
    // instance.fs — иначе Next.js внутри контейнера не увидит новый/
    // переименованный/удалённый файл и не пересоберёт превью.

    createFile: (path, content = '') => {
        const { instance } = get();
        set((state) => ({
            fileContents: { ...state.fileContents, [path]: content },
        }));
        if (instance) {
            instance.fs.writeFile(path, content).catch((err) => {
                console.error('Не удалось создать файл в контейнере:', err);
            });
        }
        schedulePersist(get);
    },

    createFolder: (path) => {
        const { instance } = get();
        set((state) => ({
            folders: state.folders.includes(path) ? state.folders : [...state.folders, path],
        }));
        if (instance) {
            instance.fs.mkdir(path, { recursive: true }).catch((err) => {
                console.error('Не удалось создать папку в контейнере:', err);
            });
        }
        schedulePersist(get);
    },

    deletePath: (path, isDirectory) => {
        const { instance } = get();
        set((state) => {
            if (isDirectory) {
                const prefix = `${path}/`;
                const fileContents = Object.fromEntries(
                    Object.entries(state.fileContents).filter(
                        ([p]) => p !== path && !p.startsWith(prefix)
                    )
                );
                const folders = state.folders.filter((p) => p !== path && !p.startsWith(prefix));
                const openFiles = state.openFiles.filter(
                    (p) => p !== path && !p.startsWith(prefix)
                );
                let activeFile = state.activeFile;
                if (activeFile && (activeFile === path || activeFile.startsWith(prefix))) {
                    activeFile = openFiles[0] ?? null;
                }
                return { fileContents, folders, openFiles, activeFile };
            }

            const { [path]: _removed, ...fileContents } = state.fileContents;
            const openFiles = state.openFiles.filter((p) => p !== path);
            let activeFile = state.activeFile;
            if (activeFile === path) activeFile = openFiles[0] ?? null;
            return { fileContents, openFiles, activeFile };
        });
        if (instance) {
            instance.fs.rm(path, { recursive: true, force: true }).catch((err) => {
                console.error('Не удалось удалить из контейнера:', err);
            });
        }
        schedulePersist(get);
    },

    // Используется и для переименования, и для перетаскивания (drag & drop) —
    // и то, и другое — это просто смена пути с сохранением содержимого.
    renamePath: (oldPath, newPath, isDirectory) => {
        const { instance } = get();
        set((state) => {
            if (isDirectory) {
                const prefix = `${oldPath}/`;
                const fileContents = {};
                for (const [p, c] of Object.entries(state.fileContents)) {
                    if (p === oldPath) continue;
                    fileContents[p.startsWith(prefix) ? newPath + p.slice(oldPath.length) : p] = c;
                }
                const remap = (p) =>
                    p === oldPath
                        ? newPath
                        : p.startsWith(prefix)
                            ? newPath + p.slice(oldPath.length)
                            : p;
                return {
                    fileContents,
                    folders: state.folders.map(remap),
                    openFiles: state.openFiles.map(remap),
                    activeFile: state.activeFile ? remap(state.activeFile) : state.activeFile,
                };
            }

            const { [oldPath]: content, ...rest } = state.fileContents;
            const fileContents =
                content !== undefined ? { ...rest, [newPath]: content } : state.fileContents;
            return {
                fileContents,
                openFiles: state.openFiles.map((p) => (p === oldPath ? newPath : p)),
                activeFile: state.activeFile === oldPath ? newPath : state.activeFile,
            };
        });
        if (instance) {
            instance.fs.rename(oldPath, newPath).catch((err) => {
                console.error('Не удалось переименовать в контейнере:', err);
            });
        }
        schedulePersist(get);
    },

    reset: () =>
        set({
            instance: null,
            status: 'idle',
            error: null,
            previewUrl: null,
            fileContents: {},
            folders: [],
            openFiles: ['/app/page.js'],
            activeFile: '/app/page.js',
            terminalWriter: null,
            shellInputWriter: null,
            shellProcess: null,
        }),
}));