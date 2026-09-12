'use client';

import { useCallback, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import MonacoEditor from '@monaco-editor/react';
import { useWebContainerStore } from '/store/useWebContainerStore';

// Простое сопоставление расширения файла -> язык для подсветки синтаксиса
function getLanguageFromPath(path) {
    if (path.endsWith('.css')) return 'css';
    if (path.endsWith('.json')) return 'json';
    if (path.endsWith('.md')) return 'markdown';
    if (path.endsWith('.tsx') || path.endsWith('.ts')) return 'typescript';
    // .js / .jsx / по умолчанию — трактуем как JS с JSX
    return 'javascript';
}

function TabBar({ openFiles, activeFile, onSelect, onClose }) {
    return (
        <div className="flex h-10 items-end overflow-x-auto border-b border-white/5 bg-[#0a0a0a] px-2 pt-2 scrollbar-hide">
            {openFiles.map((path) => {
                const isActive = path === activeFile;
                const label = path.replace(/^\//, '').split('/').pop();
                return (
                    <div
                        key={path}
                        onClick={() => onSelect(path)}
                        title={path}
                        className={`group relative flex shrink-0 cursor-pointer items-center gap-2 rounded-t-lg border border-b-0 px-4 py-2 text-xs transition-all ${
                            isActive
                                ? 'border-white/10 bg-[#121212] text-zinc-100'
                                : 'border-transparent text-zinc-500 hover:bg-white/[0.02] hover:text-zinc-300'
                        }`}
                    >
                        {/* Акцентная линия сверху активной вкладки */}
                        {isActive && (
                            <div className="absolute inset-x-0 -top-px h-[2px] rounded-t-full bg-blue-500/80 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                        )}

                        <span className="max-w-[120px] truncate font-medium tracking-wide">
                            {label}
                        </span>

                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onClose(path);
                            }}
                            className={`rounded-md p-0.5 transition-all ${
                                isActive
                                    ? 'opacity-100 hover:bg-white/10'
                                    : 'opacity-0 group-hover:opacity-100 hover:bg-white/10'
                            }`}
                        >
                            <X size={13} />
                        </button>
                    </div>
                );
            })}
        </div>
    );
}


export default function Editor() {
    const instance = useWebContainerStore((s) => s.instance);
    const activeFile = useWebContainerStore((s) => s.activeFile);
    const openFiles = useWebContainerStore((s) => s.openFiles);
    const fileContents = useWebContainerStore((s) => s.fileContents);
    const updateFileContent = useWebContainerStore((s) => s.updateFileContent);
    const setActiveFile = useWebContainerStore((s) => s.setActiveFile);
    const closeFile = useWebContainerStore((s) => s.closeFile);

    const debounceRef = useRef(null);


    useEffect(() => {
        if (!activeFile || !instance) return;

        if (fileContents[activeFile] === undefined) {
            instance.fs.readFile(activeFile, 'utf-8')
                .then((content) => updateFileContent(activeFile, content))
                .catch((err) => {
                    console.warn('Не удалось прочитать файл (возможно это директория или бинарник):', err);
                });
        }
    }, [activeFile, instance, fileContents, updateFileContent]);

    // Дебаунс записи в WebContainer fs — пишем не на каждый keystroke,
    // а через 300мс паузы, чтобы не заваливать виртуальную ФС и не
    // триггерить Fast Refresh/пересборку Next.js слишком часто.
    const writeToContainer = useCallback(
        (path, content) => {
            if (!instance) return;

            if (debounceRef.current) clearTimeout(debounceRef.current);

            debounceRef.current = setTimeout(() => {
                // WebContainer fs API работает с путями относительно корня
                // проекта и ожидает путь без ведущего слеша неоднозначности —
                // но /app/page.js как абсолютный путь от корня контейнера
                // тоже валиден для writeFile.
                instance.fs.writeFile(path, content).catch((err) => {
                    console.error('Ошибка записи файла в WebContainer:', err);
                });
            }, 300);
        },
        [instance]
    );

    useEffect(() => {
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, []);

    const handleChange = (value) => {
        const content = value ?? '';
        // 1. Обновляем UI-стейт немедленно (без задержки — редактор должен
        //    реагировать мгновенно). Это же сохраняет файл в IndexedDB
        //    (см. schedulePersist внутри updateFileContent).
        updateFileContent(activeFile, content);
        // 2. Пишем в реальную ФС контейнера с дебаунсом
        writeToContainer(activeFile, content);
    };

    const currentContent = activeFile ? fileContents[activeFile] ?? '' : '';

    if (!activeFile) {
        return (
            <div className="flex h-full items-center justify-center bg-editor-bg text-sm text-neutral-500">
                Нет открытых файлов
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col bg-editor-bg">
            <TabBar
                openFiles={openFiles}
                activeFile={activeFile}
                onSelect={setActiveFile}
                onClose={closeFile}
            />
            <div className="min-h-0 flex-1">
                <MonacoEditor
                    key={activeFile}
                    height="100%"
                    language={getLanguageFromPath(activeFile)}

                    value={currentContent}
                    onChange={handleChange}
                    theme="vs-dark"
                    options={{
                        fontFamily: 'var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                        fontSize: 13,
                        lineHeight: 24,
                        minimap: { enabled: false },
                        automaticLayout: true,
                        scrollBeyondLastLine: false,
                        smoothScrolling: true,
                        cursorBlinking: 'smooth',
                        cursorSmoothCaretAnimation: 'on',
                        formatOnPaste: true,
                        padding: { top: 16, bottom: 16 },
                        // Переопределяем дефолтные цвета Monaco под палитру Tailwind zinc
                        'editor.background': '#121212',
                    }}


                />
            </div>
        </div>
    );
}