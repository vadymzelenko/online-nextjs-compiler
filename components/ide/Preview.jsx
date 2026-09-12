'use client';

import { RefreshCw, ExternalLink, Loader2 } from 'lucide-react';
import { useWebContainerStore } from '/store/useWebContainerStore';

const STATUS_LABEL = {
  idle: 'Ожидание...',
  booting: 'Загрузка WebContainer...',
  mounting: 'Монтирование файлов...',
  installing: 'npm install...',
  starting: 'Запуск dev-сервера...',
  ready: 'Готово',
  error: 'Ошибка',
};

export default function Preview() {
  const previewUrl = useWebContainerStore((s) => s.previewUrl);
  const status = useWebContainerStore((s) => s.status);
  const error = useWebContainerStore((s) => s.error);

  // Ключ на iframe меняем при каждом новом previewUrl, чтобы форсировать
  // полную перезагрузку айфрейма, если WebContainer выдаст новый origin/port
  // (например, после перезапуска dev-сервера).
  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-editor-border bg-editor-panel px-3 py-1.5 text-xs text-neutral-400">
        <div className="flex items-center gap-2 truncate">
          {status !== 'ready' && status !== 'error' && (
            <Loader2 size={12} className="animate-spin shrink-0" />
          )}
          <span className="truncate font-mono">
            {previewUrl ?? STATUS_LABEL[status]}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {previewUrl && (
            <>
              <button
                title="Обновить"
                onClick={() => {
                  const iframe = document.getElementById('wc-preview-iframe');
                  if (iframe) iframe.src = iframe.src;
                }}
                className="rounded p-1 hover:bg-white/10"
              >
                <RefreshCw size={13} />
              </button>
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Открыть в новой вкладке"
                className="rounded p-1 hover:bg-white/10"
              >
                <ExternalLink size={13} />
              </a>
            </>
          )}
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        {previewUrl ? (
          <iframe
            id="wc-preview-iframe"
            src={previewUrl}
            className="h-full w-full border-0"
            // sandbox намеренно НЕ ставим строгим — Next.js dev-серверу
            // внутри WebContainer нужны scripts/same-origin для HMR
            // через WebSocket. allow-same-origin + allow-scripts обязательны.
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
            title="WebContainer preview"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-neutral-400">
            {status === 'error' ? (
              <p className="max-w-sm text-center text-sm text-red-500">
                {error ?? 'Произошла неизвестная ошибка'}
              </p>
            ) : (
              <>
                <Loader2 size={24} className="animate-spin" />
                <p className="text-sm">{STATUS_LABEL[status]}</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
