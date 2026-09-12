'use client';

import { useState } from 'react';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import { FolderCode, TerminalSquare } from 'lucide-react';
import FileExplorer from './FileExplorer';
import Editor from './Editor';
import TerminalPanel from './Terminal';
import Preview from './Preview';
import { useWebContainer } from '/hooks/useWebContainer';

import { Folder, Code2, Terminal, Play } from 'lucide-react';



// Минималистичные разделители панелей в стиле VS Code / Linear
function ResizeHandle({ isVertical = false }) {
  return (
      <PanelResizeHandle
          className={`group flex items-center justify-center outline-none ${
              isVertical ? 'h-1.5 w-full cursor-row-resize' : 'w-1.5 h-full cursor-col-resize'
          }`}
      >
        <div
            className={`bg-white/5 transition-all duration-150 group-hover:bg-blue-500/50 group-data-[resize-handle-active]:bg-blue-500 ${
                isVertical ? 'h-[1px] w-full' : 'w-[1px] h-full'
            }`}
        />
      </PanelResizeHandle>
  );
}

export default function IDE() {
  useWebContainer();
  const [mobileTab, setMobileTab] = useState('editor');

  const navItems = [
    { id: 'explorer', label: 'Файлы', icon: Folder },
    { id: 'editor', label: 'Код', icon: Code2 },
    { id: 'terminal', label: 'Терминал', icon: Terminal },
    { id: 'preview', label: 'Превью', icon: Play },
  ];

  return (
      // Используем 100dvh для корректной работы на iOS/Safari
      <div className="flex h-[100dvh] w-screen flex-col overflow-hidden bg-[#0a0a0a] text-zinc-300 font-sans selection:bg-blue-500/30">

        {/* --- МОБИЛЬНЫЙ ИНТЕРФЕЙС (< 768px) --- */}
        <div className="relative flex min-h-0 flex-1 flex-col md:hidden">
          <div className={`absolute inset-0 ${mobileTab === 'explorer' ? 'block' : 'hidden'}`}>
            <FileExplorer />
          </div>
          <div className={`absolute inset-0 ${mobileTab === 'editor' ? 'block' : 'hidden'}`}>
            <Editor />
          </div>
          <div className={`absolute inset-0 ${mobileTab === 'terminal' ? 'block' : 'hidden'}`}>
            <TerminalPanel />
          </div>
          <div className={`absolute inset-0 ${mobileTab === 'preview' ? 'block' : 'hidden'}`}>
            <Preview />
          </div>
        </div>

        <nav className="flex shrink-0 items-center justify-around border-t border-white/10 bg-[#0a0a0a]/80 p-2 pb-safe backdrop-blur-md md:hidden">
          {navItems.map(({ id, label, icon: Icon }) => {
            const isActive = mobileTab === id;
            return (
                <button
                    key={id}
                    onClick={() => setMobileTab(id)}
                    className={`flex flex-col items-center gap-1 rounded-xl px-4 py-2 transition-all ${
                        isActive ? 'text-blue-400' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                >
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                  <span className="text-[10px] font-medium tracking-wide">{label}</span>
                </button>
            );
          })}
        </nav>

        {/* --- ДЕСКТОПНЫЙ ИНТЕРФЕЙС (>= 768px) --- */}
        <div className="hidden min-h-0 flex-1 md:flex">
          <PanelGroup direction="horizontal">
            <Panel defaultSize={18} minSize={12} maxSize={30}>
              <FileExplorer />
            </Panel>

            <ResizeHandle />

            <Panel defaultSize={45} minSize={25}>
              <PanelGroup direction="vertical">
                <Panel defaultSize={70} minSize={30}>
                  <Editor />
                </Panel>
                <ResizeHandle isVertical />
                <Panel defaultSize={30} minSize={15}>
                  <TerminalPanel />
                </Panel>
              </PanelGroup>
            </Panel>

            <ResizeHandle />

            <Panel defaultSize={37} minSize={20}>
              <Preview />
            </Panel>
          </PanelGroup>
        </div>
      </div>
  );
}