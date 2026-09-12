'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import JSZip from 'jszip';
import {
    ChevronDown,
    ChevronRight,
    File,
    FilePlus,
    Folder,
    FolderOpen,
    FolderPlus,
    Loader2,
    Pencil,
    Trash2,
    Upload,
    FolderUp,
    Download
} from 'lucide-react';
import { useWebContainerStore } from '/store/useWebContainerStore';
import { buildDisplayTree, pathExistsInTree } from '/lib/fileTree';

function sortEntries(entries) {
    return entries.sort(([nameA, nodeA], [nameB, nodeB]) => {
        const isDirA = 'directory' in nodeA;
        const isDirB = 'directory' in nodeB;
        if (isDirA !== isDirB) return isDirA ? -1 : 1;
        return nameA.localeCompare(nameB, undefined, { numeric: true });
    });
}

function joinPath(parentPath, name) {
    return parentPath === '/' ? `/${name}` : `${parentPath}/${name}`;
}

function parentOf(path) {
    const idx = path.lastIndexOf('/');
    if (idx <= 0) return '/';
    return path.slice(0, idx);
}

function pathIsDirectoryInTree(tree, path) {
    const parts = path.split('/').filter(Boolean);
    let cursor = tree;
    let node = null;
    for (const part of parts) {
        node = cursor?.[part];
        if (!node) return false;
        cursor = node.directory;
    }
    return !!node?.directory;
}

function InlineNameInput({ initialValue, depth, icon, onConfirm, onCancel }) {
    const [value, setValue] = useState(initialValue);
    const inputRef = useRef(null);
    const paddingLeft = 8 + depth * 14 + 16;

    useEffect(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
    }, []);

    const commit = () => {
        const trimmed = value.trim();
        if (!trimmed || trimmed.includes('/')) {
            onCancel();
            return;
        }
        onConfirm(trimmed);
    };

    return (
        <div className="flex items-center gap-1.5 py-1" style={{ paddingLeft }}>
            {icon}
            <input
                ref={inputRef}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') commit();
                    if (e.key === 'Escape') onCancel();
                    e.stopPropagation();
                }}
                onBlur={commit}
                className="min-w-0 flex-1 rounded border border-blue-500 bg-editor-bg px-1 py-0.5 text-xs text-neutral-100 outline-none"
            />
        </div>
    );
}

function ContextMenu({ x, y, items, onClose }) {
    const ref = useRef(null);

    useEffect(() => {
        const handleClick = (e) => {
            if (ref.current && !ref.current.contains(e.target)) onClose();
        };
        const handleKey = (e) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('mousedown', handleClick);
        document.addEventListener('keydown', handleKey);
        return () => {
            document.removeEventListener('mousedown', handleClick);
            document.removeEventListener('keydown', handleKey);
        };
    }, [onClose]);

    return (
        <div
            ref={ref}
            style={{ top: y, left: x }}
            className="fixed z-50 min-w-[160px] overflow-hidden rounded-md border border-editor-border bg-editor-panel py-1 text-xs shadow-xl"
        >
            {items.map((item, i) =>
                item.separator ? (
                    <div key={i} className="my-1 border-t border-editor-border" />
                ) : (
                    <button
                        key={i}
                        onClick={() => {
                            item.onClick();
                            onClose();
                        }}
                        disabled={item.disabled}
                        className={`flex w-full items-center gap-2 px-3 py-1.5 text-left ${
                            item.danger
                                ? 'text-red-400 hover:bg-red-500/10'
                                : 'text-neutral-200 hover:bg-white/5'
                        } ${
                            item.disabled
                                ? 'cursor-not-allowed opacity-40 hover:bg-transparent'
                                : ''
                        }`}
                    >
                        {item.icon}
                        {item.label}
                    </button>
                )
            )}
        </div>
    );
}

function TreeNode({
                      name,
                      node,
                      path,
                      depth,
                      expanded,
                      onToggle,
                      activeFile,
                      onOpenFile,
                      editingPath,
                      creatingIn,
                      onCommitRename,
                      onCancelRename,
                      onCommitCreate,
                      onCancelCreate,
                      onContextMenu,
                      draggedPath,
                      onDragStart,
                      onDragOver,
                      onDrop,
                      dragOverPath,
                  }) {
    const isDirectory = 'directory' in node;
    const isExpanded = expanded.has(path);
    const paddingLeft = 8 + depth * 14;
    const isBeingRenamed = editingPath === path;
    const isDropTarget = isDirectory && dragOverPath === path;

    if (isBeingRenamed) {
        return (
            <InlineNameInput
                initialValue={name}
                depth={depth}
                icon={
                    isDirectory ? (
                        <Folder size={14} className="shrink-0 text-blue-300/80" />
                    ) : (
                        <File size={13} className="shrink-0 opacity-70" />
                    )
                }
                onConfirm={(newName) => onCommitRename(path, newName, isDirectory)}
                onCancel={onCancelRename}
            />
        );
    }

    if (isDirectory) {
        const children = sortEntries(Object.entries(node.directory));
        const isCreatingHere = creatingIn?.parentPath === path;

        return (
            <div>
                <button
                    onClick={() => onToggle(path)}
                    onContextMenu={(e) => onContextMenu(e, path, name, true)}
                    draggable
                    onDragStart={(e) => onDragStart(e, path)}
                    onDragOver={(e) => onDragOver(e, path)}
                    onDrop={(e) => onDrop(e, path, true)}
                    className={`flex w-full items-center gap-1.5 py-1 text-left text-xs text-neutral-300 hover:bg-white/5 ${
                        isDropTarget ? 'bg-blue-500/20 outline outline-1 outline-blue-500' : ''
                    } ${draggedPath === path ? 'opacity-40' : ''}`}
                    style={{ paddingLeft }}
                >
                    {isExpanded ? (
                        <ChevronDown size={12} className="shrink-0 opacity-60" />
                    ) : (
                        <ChevronRight size={12} className="shrink-0 opacity-60" />
                    )}
                    {isExpanded ? (
                        <FolderOpen size={14} className="shrink-0 text-blue-300/80" />
                    ) : (
                        <Folder size={14} className="shrink-0 text-blue-300/80" />
                    )}
                    <span className="truncate">{name}</span>
                </button>
                {isExpanded && (
                    <>
                        {children.map(([childName, childNode]) => (
                            <TreeNode
                                key={`${path}/${childName}`}
                                name={childName}
                                node={childNode}
                                path={`${path}/${childName}`}
                                depth={depth + 1}
                                expanded={expanded}
                                onToggle={onToggle}
                                activeFile={activeFile}
                                onOpenFile={onOpenFile}
                                editingPath={editingPath}
                                creatingIn={creatingIn}
                                onCommitRename={onCommitRename}
                                onCancelRename={onCancelRename}
                                onCommitCreate={onCommitCreate}
                                onCancelCreate={onCancelCreate}
                                onContextMenu={onContextMenu}
                                draggedPath={draggedPath}
                                onDragStart={onDragStart}
                                onDragOver={onDragOver}
                                onDrop={onDrop}
                                dragOverPath={dragOverPath}
                            />
                        ))}
                        {isCreatingHere && (
                            <InlineNameInput
                                initialValue={creatingIn.kind === 'folder' ? 'new-folder' : 'new-file.js'}
                                depth={depth + 1}
                                icon={
                                    creatingIn.kind === 'folder' ? (
                                        <Folder size={14} className="shrink-0 text-blue-300/80" />
                                    ) : (
                                        <File size={13} className="shrink-0 opacity-70" />
                                    )
                                }
                                onConfirm={(newName) => onCommitCreate(path, newName, creatingIn.kind)}
                                onCancel={onCancelCreate}
                            />
                        )}
                    </>
                )}
            </div>
        );
    }

    const isActive = path === activeFile;
    return (
        <button
            onClick={() => onOpenFile(path)}
            onContextMenu={(e) => onContextMenu(e, path, name, false)}
            draggable
            onDragStart={(e) => onDragStart(e, path)}
            onDragOver={(e) => onDragOver(e, parentOf(path))}
            className={`flex w-full items-center gap-1.5 py-1 text-left text-xs transition-colors ${
                isActive ? 'bg-blue-600/20 text-blue-300' : 'text-neutral-300 hover:bg-white/5'
            } ${draggedPath === path ? 'opacity-40' : ''}`}
            style={{ paddingLeft: paddingLeft + 16 }}
            title={path}
        >
            <File size={13} className="shrink-0 opacity-70" />
            <span className="truncate">{name}</span>
        </button>
    );
}

export default function FileExplorer() {
    const instance = useWebContainerStore((s) => s.instance);
    const fileContents = useWebContainerStore((s) => s.fileContents);
    const folders = useWebContainerStore((s) => s.folders);
    const containerTree = useWebContainerStore((s) => s.containerTree);
    const isScanning = useWebContainerStore((s) => s.isScanning);
    const activeFile = useWebContainerStore((s) => s.activeFile);
    const openFile = useWebContainerStore((s) => s.openFile);
    const createFile = useWebContainerStore((s) => s.createFile);
    const createFolder = useWebContainerStore((s) => s.createFolder);
    const deletePath = useWebContainerStore((s) => s.deletePath);
    const renamePath = useWebContainerStore((s) => s.renamePath);

    const fallbackTree = useMemo(() => buildDisplayTree(fileContents, folders), [fileContents, folders]);
    const tree = containerTree ?? fallbackTree;

    const topLevelPaths = useMemo(() => Object.keys(tree).map((name) => `/${name}`), [tree]);

    const [expanded, setExpanded] = useState(() => new Set(topLevelPaths));
    const hadContainerTree = useRef(false);

    const fileInputRef = useRef(null);
    const folderInputRef = useRef(null);

    useEffect(() => {
        if (containerTree === null || hadContainerTree.current) return;
        hadContainerTree.current = true;
        setExpanded((prev) => {
            const next = new Set(prev);
            for (const p of topLevelPaths) {
                if (p === '/node_modules') continue;
                next.add(p);
            }
            return next;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [containerTree]);

    const toggle = (path) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(path)) next.delete(path);
            else next.add(path);
            return next;
        });
    };

    const [menu, setMenu] = useState(null);
    const [editingPath, setEditingPath] = useState(null);
    const [creatingIn, setCreatingIn] = useState(null);

    const openMenu = (e, path, name, isDirectory) => {
        e.preventDefault();
        e.stopPropagation();
        setMenu({ x: e.clientX, y: e.clientY, path, name, isDirectory });
    };

    const startCreate = (parentPath, kind) => {
        setExpanded((prev) => new Set(prev).add(parentPath));
        setCreatingIn({ parentPath, kind });
    };

    const commitCreate = (parentPath, name, kind) => {
        const path = joinPath(parentPath, name);
        if (pathExistsInTree(tree, path)) {
            window.alert(`«${name}» уже существует в этой папке`);
            setCreatingIn(null);
            return;
        }
        if (kind === 'folder') createFolder(path);
        else createFile(path, '');
        setCreatingIn(null);
    };

    const commitRename = (oldPath, newName, isDirectory) => {
        const newPath = joinPath(parentOf(oldPath), newName);
        if (newPath !== oldPath && pathExistsInTree(tree, newPath)) {
            window.alert(`«${newName}» уже существует в этой папке`);
            setEditingPath(null);
            return;
        }
        if (newPath !== oldPath) renamePath(oldPath, newPath, isDirectory);
        setEditingPath(null);
    };

    const handleDelete = (path, name, isDirectory) => {
        const confirmed = window.confirm(
            isDirectory ? `Удалить папку «${name}» со всем содержимым?` : `Удалить файл «${name}»?`
        );
        if (confirmed) deletePath(path, isDirectory);
    };

    const handleUpload = async (e) => {
        const files = e.target.files;
        if (!files || files.length === 0 || !instance) return;

        for (const file of files) {
            const path = file.webkitRelativePath ? `/${file.webkitRelativePath}` : `/${file.name}`;
            const parts = path.split('/').filter(Boolean);
            let currentPath = '';
            for (let i = 0; i < parts.length - 1; i++) {
                currentPath += `/${parts[i]}`;
                if (!pathExistsInTree(tree, currentPath)) {
                    createFolder(currentPath);
                }
            }
            const text = await file.text();
            createFile(path, text);
        }
        e.target.value = '';
    };

    const handleDownloadZip = async () => {
        if (!instance) return;
        const zip = new JSZip();

        const addFilesToZip = async (dirPath, zipFolder) => {
            const entries = await instance.fs.readdir(dirPath, { withFileTypes: true });
            for (const entry of entries) {
                if (['node_modules', '.next', '.git'].includes(entry.name)) continue;
                const fullPath = dirPath === '/' ? `/${entry.name}` : `${dirPath}/${entry.name}`;
                if (entry.isDirectory()) {
                    const newZipFolder = zipFolder.folder(entry.name);
                    await addFilesToZip(fullPath, newZipFolder);
                } else {
                    const content = await instance.fs.readFile(fullPath);
                    zipFolder.file(entry.name, content);
                }
            }
        };

        try {
            await addFilesToZip('/', zip);
            const blob = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'project.zip';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Ошибка создания архива:', err);
            window.alert('Не удалось собрать ZIP-архив.');
        }
    };

    // --- DRAG AND DROP (Внутренний + С ПК) ---
    const [draggedPath, setDraggedPath] = useState(null);
    const [dragOverPath, setDragOverPath] = useState(null);

    const handleDragStart = (e, path) => {
        e.stopPropagation();
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', path);
        setDraggedPath(path);
    };

    const handleDragOver = (e, overPath) => {
        e.preventDefault();
        e.stopPropagation();

        // 1. Внешние файлы (с ПК)
        if (e.dataTransfer.types.includes('Files')) {
            setDragOverPath(overPath);
            e.dataTransfer.dropEffect = 'copy';
            return;
        }

        // 2. Внутренние файлы (перемещение внутри IDE)
        if (!draggedPath) return;
        if (overPath === draggedPath || overPath.startsWith(`${draggedPath}/`)) return;
        setDragOverPath(overPath);
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = async (e, targetDirPath) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOverPath(null);

        // 1. ДРОП ФАЙЛОВ/ПАПОК ИЗ ОПЕРАЦИОННОЙ СИСТЕМЫ
        if (e.dataTransfer.types.includes('Files') && !draggedPath) {
            const items = e.dataTransfer.items;
            if (!items) return;

            // Рекурсивное чтение папок через DataTransferItem API
            const processEntry = (entry, currentPath) => {
                if (entry.isFile) {
                    entry.file(async (file) => {
                        const text = await file.text();
                        const filePath = joinPath(currentPath, file.name);
                        createFile(filePath, text);
                    });
                } else if (entry.isDirectory) {
                    const dirPath = joinPath(currentPath, entry.name);
                    if (!pathExistsInTree(tree, dirPath)) createFolder(dirPath);

                    const dirReader = entry.createReader();
                    // Читаем всё содержимое папки
                    dirReader.readEntries((entries) => {
                        entries.forEach(e => processEntry(e, dirPath));
                    });
                }
            };

            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (item.kind === 'file') {
                    const entry = item.webkitGetAsEntry();
                    if (entry) processEntry(entry, targetDirPath);
                }
            }

            setExpanded((prev) => new Set(prev).add(targetDirPath));
            return;
        }

        // 2. ВНУТРЕННЕЕ ПЕРЕМЕЩЕНИЕ (Drag & Drop)
        const sourcePath = draggedPath;
        setDraggedPath(null);
        if (!sourcePath) return;
        if (targetDirPath === sourcePath || targetDirPath.startsWith(`${sourcePath}/`)) return;
        if (parentOf(sourcePath) === targetDirPath) return;

        const name = sourcePath.split('/').pop();
        const newPath = joinPath(targetDirPath, name);
        if (pathExistsInTree(tree, newPath)) {
            window.alert(`«${name}» уже существует в целевой папке`);
            return;
        }

        const wasDirectory = pathIsDirectoryInTree(tree, sourcePath);
        renamePath(sourcePath, newPath, wasDirectory);
        setExpanded((prev) => new Set(prev).add(targetDirPath));
    };

    const entries = sortEntries(Object.entries(tree));

    const menuItems = menu
        ? menu.isDirectory
            ? [
                { label: 'Новый файл', icon: <FilePlus size={13} />, onClick: () => startCreate(menu.path, 'file') },
                { label: 'Новая папка', icon: <FolderPlus size={13} />, onClick: () => startCreate(menu.path, 'folder') },
                { separator: true },
                { label: 'Переименовать', icon: <Pencil size={13} />, onClick: () => setEditingPath(menu.path), disabled: menu.path === '/' },
                { label: 'Удалить', icon: <Trash2 size={13} />, danger: true, onClick: () => handleDelete(menu.path, menu.name, true), disabled: menu.path === '/' },
            ]
            : [
                { label: 'Переименовать', icon: <Pencil size={13} />, onClick: () => setEditingPath(menu.path) },
                { label: 'Удалить', icon: <Trash2 size={13} />, danger: true, onClick: () => handleDelete(menu.path, menu.name, false) },
            ]
        : [];

    return (
        <div className="flex h-full flex-col bg-editor-panel text-sm" onDragEnd={() => { setDraggedPath(null); setDragOverPath(null); }}>
            <input type="file" multiple ref={fileInputRef} className="hidden" onChange={handleUpload} />
            <input type="file" webkitdirectory="" directory="" ref={folderInputRef} className="hidden" onChange={handleUpload} />

            <div className="flex items-center justify-between border-b border-editor-border px-3 py-1.5 text-xs text-neutral-400">
                <span className="flex items-center gap-1.5">
                    Explorer
                    {isScanning && <Loader2 size={11} className="animate-spin opacity-60" />}
                </span>
                <div className="flex items-center gap-0.5">
                    <button title="Загрузить файлы" onClick={() => fileInputRef.current?.click()} className="rounded p-1 hover:bg-white/10 text-blue-400">
                        <Upload size={13} />
                    </button>
                    <button title="Загрузить папку" onClick={() => folderInputRef.current?.click()} className="rounded p-1 hover:bg-white/10 text-blue-400">
                        <FolderUp size={13} />
                    </button>
                    <button title="Скачать проект (ZIP)" onClick={handleDownloadZip} className="rounded p-1 hover:bg-white/10 text-green-400 ml-1">
                        <Download size={13} />
                    </button>
                    <div className="w-[1px] h-3 bg-editor-border mx-1"></div>
                    <button title="Новый файл в корне" onClick={() => startCreate('/', 'file')} className="rounded p-1 hover:bg-white/10">
                        <FilePlus size={13} />
                    </button>
                    <button title="Новая папка в корне" onClick={() => startCreate('/', 'folder')} className="rounded p-1 hover:bg-white/10">
                        <FolderPlus size={13} />
                    </button>
                </div>
            </div>

            {/* ГЛАВНАЯ ЗОНА DROP ДЛЯ КОРНЯ */}
            <div
                className="flex-1 overflow-y-auto py-1"
                onDragOver={(e) => handleDragOver(e, '/')}
                onDrop={(e) => handleDrop(e, '/')}
                onContextMenu={(e) => { if (e.target === e.currentTarget) openMenu(e, '/', 'root', true); }}
            >
                {entries.length === 0 && !creatingIn && (
                    <div className="px-3 py-2 text-xs text-neutral-500 pointer-events-none">
                        {containerTree === null ? 'Загрузка файлов...' : 'Перетащите файлы сюда'}
                    </div>
                )}

                {entries.map(([name, node]) => (
                    <TreeNode
                        key={name}
                        name={name}
                        node={node}
                        path={`/${name}`}
                        depth={0}
                        expanded={expanded}
                        onToggle={toggle}
                        activeFile={activeFile}
                        onOpenFile={openFile}
                        editingPath={editingPath}
                        creatingIn={creatingIn}
                        onCommitRename={commitRename}
                        onCancelRename={() => setEditingPath(null)}
                        onCommitCreate={commitCreate}
                        onCancelCreate={() => setCreatingIn(null)}
                        onContextMenu={openMenu}
                        draggedPath={draggedPath}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        dragOverPath={dragOverPath}
                    />
                ))}
                {creatingIn?.parentPath === '/' && (
                    <InlineNameInput
                        initialValue={creatingIn.kind === 'folder' ? 'new-folder' : 'new-file.js'}
                        depth={0}
                        icon={
                            creatingIn.kind === 'folder' ? (
                                <Folder size={14} className="shrink-0 text-blue-300/80" />
                            ) : (
                                <File size={13} className="shrink-0 opacity-70" />
                            )
                        }
                        onConfirm={(newName) => commitCreate('/', newName, creatingIn.kind)}
                        onCancel={() => setCreatingIn(null)}
                    />
                )}
            </div>
            {menu && <ContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={() => setMenu(null)} />}
        </div>
    );
}