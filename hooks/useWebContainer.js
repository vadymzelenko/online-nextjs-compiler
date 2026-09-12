'use client';

import { useEffect, useRef } from 'react';
import { getWebContainerInstance } from '/lib/webcontainer-singleton';
import { files } from '/lib/files';
import { useWebContainerStore } from '/store/useWebContainerStore';
import { flattenFileTree, buildFileTree } from '/lib/fileTree';
import { loadProjectState } from '/lib/persistence';

async function scanFS(instance, dirPath = '/') {
  const entries = await instance.fs.readdir(dirPath, { withFileTypes: true });
  const tree = {};
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (['node_modules', '.next', '.git'].includes(entry.name)) {
        tree[entry.name] = { directory: {} };
      } else {
        const subPath = dirPath === '/' ? `/${entry.name}` : `${dirPath}/${entry.name}`;
        tree[entry.name] = { directory: await scanFS(instance, subPath) };
      }
    } else {
      tree[entry.name] = { file: {} };
    }
  }
  return tree;
}

export function useWebContainer() {
  const hasStarted = useRef(false);

  const setInstance = useWebContainerStore((s) => s.setInstance);
  const setStatus = useWebContainerStore((s) => s.setStatus);
  const setError = useWebContainerStore((s) => s.setError);
  const setPreviewUrl = useWebContainerStore((s) => s.setPreviewUrl);

  // Экшены стейта
  const setInitialFileContents = useWebContainerStore((s) => s.setInitialFileContents);
  const setContainerTree = useWebContainerStore((s) => s.setContainerTree);
  const setIsScanning = useWebContainerStore((s) => s.setIsScanning);
  const setOpenFiles = useWebContainerStore((s) => s.setOpenFiles);
  const setActiveFile = useWebContainerStore((s) => s.setActiveFile);
  const setFolders = useWebContainerStore((s) => s.setFolders);

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    async function bootAndRun() {
      try {
        setStatus('booting');
        const instance = await getWebContainerInstance();
        setInstance(instance);

        setStatus('mounting');

        // 1. Пытаемся загрузить сохраненный стейт проекта из IndexedDB
        const savedState = await loadProjectState();
        let mountTree;

        if (savedState && savedState.fileContents) {
          // Восстанавливаем интерфейс
          setInitialFileContents(savedState.fileContents);
          if (savedState.folders) setFolders(savedState.folders);
          if (savedState.openFiles) setOpenFiles(savedState.openFiles);
          if (savedState.activeFile) setActiveFile(savedState.activeFile);

          // Восстанавливаем физические файлы для контейнера
          mountTree = buildFileTree(savedState.fileContents);
        } else {
          // Если сохранения нет, грузим дефолт из files.js
          setInitialFileContents(flattenFileTree(files));
          mountTree = files;
        }

        await instance.mount(mountTree);

        instance.on('server-ready', (port, url) => {
          setPreviewUrl(url);
        });

        instance.on('error', (err) => {
          setError(err.message);
        });

        setStatus('ready');

// Фоновое сканирование ФС каждые 3 секунды
        // Фоновое сканирование ФС каждые 3 секунды
        setInterval(async () => {
          setIsScanning(true);
          try {
            const tree = await scanFS(instance);
            setContainerTree(tree);

            const store = useWebContainerStore.getState();

            // 1. Авто-обновление package.json
            try {
              const freshPackageJson = await instance.fs.readFile('/package.json', 'utf-8');
              if (store.fileContents['/package.json'] !== freshPackageJson) {
                store.updateFileContent('/package.json', freshPackageJson);
              }
            } catch (fsErr) {}

            // 2. СИНХРОНИЗАЦИЯ УДАЛЕНИЙ (ОЧИСТКА СТЕЙТА)
            // flattenFileTree делает из дерева плоский объект,
            // Object.keys выдает массив путей всех реально существующих файлов
            const physicalFiles = Object.keys(flattenFileTree(tree));

            for (const statePath of Object.keys(store.fileContents)) {
              // Если файл есть в памяти IDE, но физически исчез из контейнера
              if (!physicalFiles.includes(statePath)) {
                // Метод deletePath безопасно уберет файл из интерфейса,
                // закроет его вкладку, если она открыта, и обновит IndexedDB
                store.deletePath(statePath, false);
              }
            }

          } catch (e) {
          } finally {
            setIsScanning(false);
          }
        }, 3000);

      } catch (err) {
        console.error(err);
        setError(err?.message ?? 'Unknown error');
      }
    }

    bootAndRun();
  }, []);
}