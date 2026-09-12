/**
 * Утилиты для конвертации между вложенным FileSystemTree (формат WebContainer
 * API для .mount()) и плоской картой { '/app/page.js': 'contents...' },
 * с которой удобно работать редактору, эксплореру и слою персистентности.
 *
 * Путь: /lib/fileTree.js
 */

// Вложенное дерево -> плоская карта путь->содержимое
export function flattenFileTree(tree, basePath = '') {
  let result = {};

  for (const [name, node] of Object.entries(tree)) {
    const path = `${basePath}/${name}`;

    if ('file' in node) {
      result[path] = node.file.contents;
    } else if ('directory' in node) {
      result = { ...result, ...flattenFileTree(node.directory, path) };
    }
  }

  return result;
}

// Плоская карта путь->содержимое -> вложенное дерево (для instance.mount())
export function buildFileTree(flatMap) {
  const tree = {};

  for (const [path, contents] of Object.entries(flatMap)) {
    const parts = path.split('/').filter(Boolean);
    let cursor = tree;

    parts.forEach((part, i) => {
      const isLast = i === parts.length - 1;

      if (isLast) {
        cursor[part] = { file: { contents } };
      } else {
        if (!cursor[part] || !cursor[part].directory) {
          cursor[part] = { directory: {} };
        }
        cursor = cursor[part].directory;
      }
    });
  }

  return tree;
}

// То же дерево, что buildFileTree, но дополнительно вставляет узлы-директории
// для путей из emptyFolders — папок, которые пользователь создал через
// эксплорер, но ещё не положил туда ни одного файла (в fileContents такая
// папка никак не отражена, потому что там хранятся только файлы).
// Нужно для отображения в файловом эксплорере.
export function buildDisplayTree(flatMap, emptyFolders = []) {
  const tree = buildFileTree(flatMap);

  for (const folderPath of emptyFolders) {
    const parts = folderPath.split('/').filter(Boolean);
    let cursor = tree;

    parts.forEach((part) => {
      if (!cursor[part] || !cursor[part].directory) {
        cursor[part] = { directory: {} };
      }
      cursor = cursor[part].directory;
    });
  }

  return tree;
}



// Проверяет, существует ли файл или папка по указанному пути в дереве WebContainer
export function pathExistsInTree(tree, path) {
  const parts = path.split('/').filter(Boolean);
  let cursor = tree;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const node = cursor[part];

    if (!node) return false;

    // Если это не последний элемент пути, мы должны провалиться в директорию
    if (i < parts.length - 1) {
      if (!node.directory) return false;
      cursor = node.directory;
    }
  }

  return true;
}

