'use client';

import dynamic from 'next/dynamic';

// Monaco Editor и xterm.js обращаются к window/self на этапе импорта,
// поэтому компонент IDE обязан рендериться только на клиенте — иначе
// падает во время серверного пререндера страницы ("self is not defined").
const IDE = dynamic(() => import('/components/ide/IDE'), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-screen items-center justify-center bg-editor-bg text-sm text-neutral-400">
      Загрузка IDE...
    </div>
  ),
});

export default function Home() {
  return <IDE />;
}
