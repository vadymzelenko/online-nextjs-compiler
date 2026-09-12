'use client';

import { useEffect, useRef } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { Plus, X } from 'lucide-react';
import { useWebContainerStore } from '/store/useWebContainerStore';

// Отдельный процесс терминала
function TerminalInstance({ initialCommand, isActive }) {
  const containerRef = useRef(null);
  const instance = useWebContainerStore((s) => s.instance);
  const processRef = useRef(null);
  const fitAddonRef = useRef(null);
  const termRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !instance) return;

    const term = new XTerm({
      convertEol: true,
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      theme: { background: '#1e1e1e', foreground: '#d4d4d4', cursor: '#d4d4d4' },
    });
    termRef.current = term;

    const fitAddon = new FitAddon();
    fitAddonRef.current = fitAddon;
    term.loadAddon(fitAddon);
    term.open(containerRef.current);

    let isMounted = true;

    async function startShell() {
      const shellProcess = await instance.spawn('jsh', {
        terminal: { cols: term.cols || 80, rows: term.rows || 24 },
      });
      processRef.current = shellProcess;

      shellProcess.output.pipeTo(
          new WritableStream({
            write(chunk) {
              if (isMounted) term.write(chunk);
            },
          })
      );

      const input = shellProcess.input.getWriter();
      term.onData((data) => {
        input.write(data);
      });

      if (initialCommand) {
        input.write(initialCommand);
      }
    }

    startShell();

    const safeFit = () => {
      if (!isMounted || !containerRef.current) return;
      // Делаем fit, только если контейнер реально в пределах экрана
      // (clientWidth > 0 гарантирует, что это не убитый DOM-узел)
      if (containerRef.current.clientWidth > 0) {
        try {
          fitAddon.fit();
          if (processRef.current && term.cols && term.rows) {
            processRef.current.resize({ cols: term.cols, rows: term.rows });
          }
        } catch (e) {}
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(safeFit);
    });

    const initTimer = setTimeout(() => {
      if (isMounted && containerRef.current) {
        resizeObserver.observe(containerRef.current);
        safeFit();
      }
    }, 100);

    return () => {
      isMounted = false;
      clearTimeout(initTimer);
      resizeObserver.disconnect();
      if (processRef.current) processRef.current.kill();
      term.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instance]);

  useEffect(() => {
    if (isActive && fitAddonRef.current && termRef.current) {
      requestAnimationFrame(() => {
        setTimeout(() => {
          try {
            fitAddonRef.current.fit();
          } catch (e) {}
        }, 50);
      });
    }
  }, [isActive]);

  return (
      <div
          ref={containerRef}
          // ГЛАВНЫЙ ФИКС: Вместо display:none / invisible уносим контейнер
          // на 10 тысяч пикселей влево. Размеры остаются, баг исчезает.
          className={`absolute top-0 h-full w-full p-2 ${
              isActive
                  ? 'left-0 opacity-100 z-10 pointer-events-auto'
                  : '-left-[9999px] opacity-0 -z-10 pointer-events-none'
          }`}
      />
  );
}

export default function TerminalPanel() {
  const terminals = useWebContainerStore(s => s.terminals);
  const activeTerminalId = useWebContainerStore(s => s.activeTerminalId);
  const createTerminal = useWebContainerStore(s => s.createTerminal);
  const closeTerminal = useWebContainerStore(s => s.closeTerminal);
  const setActiveTerminal = useWebContainerStore(s => s.setActiveTerminal);

  return (
      <div className="flex h-full flex-col bg-editor-bg">
        {/* Панель вкладок терминалов */}
        <div className="flex items-center bg-editor-panel border-b border-editor-border text-xs">
          <div className="flex flex-1 overflow-x-auto">
            {terminals?.map((term) => (
                <div
                    key={term.id}
                    onClick={() => setActiveTerminal(term.id)}
                    className={`group flex shrink-0 cursor-pointer items-center gap-2 border-r border-editor-border px-3 py-1.5 font-mono ${
                        activeTerminalId === term.id
                            ? 'bg-editor-bg text-blue-300'
                            : 'text-neutral-400 hover:bg-white/5'
                    }`}
                >
                  <span>{term.name}</span>
                  <button
                      onClick={(e) => {
                        e.stopPropagation();
                        closeTerminal(term.id);
                      }}
                      className="rounded p-0.5 opacity-0 hover:bg-white/10 group-hover:opacity-100"
                      title="Закрыть"
                  >
                    <X size={12} />
                  </button>
                </div>
            ))}
          </div>
          <button
              onClick={createTerminal}
              className="shrink-0 p-1.5 text-neutral-400 hover:text-white"
              title="Новый терминал"
          >
            <Plus size={14} />
          </button>
        </div>

        {/* Контейнеры для XTerm */}
        <div className="min-h-0 flex-1 overflow-hidden relative">
          {terminals?.map((term) => (
              <TerminalInstance
                  key={term.id}
                  initialCommand={term.initialCommand}
                  isActive={activeTerminalId === term.id}
              />
          ))}
          {(!terminals || terminals.length === 0) && (
              <div className="flex h-full items-center justify-center text-sm text-neutral-500">
                Нет открытых терминалов
              </div>
          )}
        </div>
      </div>
  );
}