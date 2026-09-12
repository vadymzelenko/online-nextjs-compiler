/**
 * Стартовая файловая система, которая монтируется внутрь WebContainer
 * через webcontainerInstance.mount(files).
 *
 * Формат объекта — это FileSystemTree из @webcontainer/api:
 * {
 *   [name]: {
 *     directory: { ...вложенные файлы/папки... }
 *   } | {
 *     file: { contents: string }
 *   }
 * }
 *
 * ВАЖНО: это отдельный, независимый Node.js/Next.js проект, который будет
 * жить и собираться ВНУТРИ виртуальной ФС браузера. Его package.json и
 * зависимости не имеют ничего общего с package.json хост-приложения IDE.
 */

export const files = {
    'package.json': {
        file: {
            contents: JSON.stringify(
                {
                    name: 'sandbox-app',
                    version: '0.1.0',
                    private: true,
                    scripts: {
                        dev: 'next dev',
                        build: 'next build',
                        start: 'next start',
                    },
                    dependencies: {
                        next: '14.2.5',
                        react: '18.3.1',
                        'react-dom': '18.3.1',
                        'framer-motion': '^11.0.0',
                        'lucide-react': '^0.359.0',
                        'clsx': '^2.1.0',
                        'tailwind-merge': '^2.2.1'
                    },
                    devDependencies: {
                        tailwindcss: '^3.4.1',
                        postcss: '^8.4.35',
                        autoprefixer: '^10.4.17'
                    }
                },
                null,
                2
            ),
        },
    },

    'tailwind.config.js': {
        file: {
            contents: `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
`,
        },
    },

    'postcss.config.js': {
        file: {
            contents: `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`,
        },
    },

    'next.config.js': {
        file: {
            contents: `/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
};
`,
        },
    },

    '.gitignore': {
        file: {
            contents: `node_modules\n.next\n`,
        },
    },

    app: {
        directory: {
            'layout.js': {
                file: {
                    contents: `import './globals.css';

export const metadata = {
  title: 'WebContainer IDE',
  description: 'Running inside WebContainer',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased bg-neutral-950 text-white min-h-screen">
        {children}
      </body>
    </html>
  );
}
`,
                },
            },

            'page.js': {
                file: {
                    contents: `'use client';

import { Terminal } from 'lucide-react';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="flex items-center gap-4 mb-8">
        <div className="p-4 bg-blue-500/10 rounded-2xl text-blue-500">
          <Terminal size={40} />
        </div>
        <h1 className="text-4xl font-bold tracking-tight">Система активна</h1>
      </div>
      <p className="text-neutral-400 text-lg">
        Tailwind CSS, Next.js и Lucide Icons готовы к работе.
      </p>
    </main>
  );
}
`,
                },
            },

            'globals.css': {
                file: {
                    contents: `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n`,
                },
            },
        },
    },
};
